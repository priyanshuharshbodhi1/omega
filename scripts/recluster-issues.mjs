import dotenv from "dotenv";
import { Client } from "@elastic/elasticsearch";

dotenv.config();

const endpoint =
  process.env.ELASTIC_ENDPOINT ||
  process.env.ENDPOINT ||
  process.env.ELASTICSEARCH_ENDPOINT;
const apiKey = process.env.ELASTIC_API_KEY;
const feedbackIndex = process.env.ELASTIC_FEEDBACK_INDEX || "feedback";
const supportConversationsIndex =
  process.env.ELASTIC_SUPPORT_CONVERSATIONS_INDEX || "support_conversations";
const issueClustersIndex = process.env.ELASTIC_ISSUE_CLUSTERS_INDEX || "issue_clusters";

if (!endpoint || !apiKey) {
  console.error("Missing ELASTIC endpoint/API key.");
  process.exit(1);
}

const client = new Client({ node: endpoint, auth: { apiKey } });

function classifyIssue(text) {
  const value = String(text || "").toLowerCase();
  if (/(customer service|support|respond|response time|slow support)/.test(value)) {
    return { key: "support-response", title: "Support Response & Quality" };
  }
  if (/(lag|latency|slow|performance)/.test(value)) {
    return { key: "performance", title: "Performance & Latency" };
  }
  if (/(billing|payment|invoice|charge|subscription)/.test(value)) {
    return { key: "billing", title: "Billing & Payments" };
  }
  if (/(bug|crash|error|broken|fail)/.test(value)) {
    return { key: "bugs", title: "Bugs & Errors" };
  }
  if (/(feature|request|add|missing)/.test(value)) {
    return { key: "feature-requests", title: "Feature Requests" };
  }
  if (/(ui|ux|design|confusing|hard to use)/.test(value)) {
    return { key: "ux", title: "UX & Usability" };
  }
  return { key: "other", title: "Other Customer Issues" };
}

async function recluster(teamId) {
  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [feedbackRes, supportRes] = await Promise.all([
    client.search({
      index: feedbackIndex,
      size: 300,
      query: {
        bool: {
          filter: [{ term: { teamId } }, { range: { createdAt: { gte: sinceIso } } }],
          should: [{ term: { sentiment: "negative" } }, { range: { rate: { lte: 3 } } }],
          minimum_should_match: 1,
        },
      },
      _source: ["description", "createdAt"],
    }),
    client.search({
      index: supportConversationsIndex,
      size: 300,
      query: {
        bool: {
          filter: [
            { term: { teamId } },
            { term: { role: "user" } },
            { range: { createdAt: { gte: sinceIso } } },
          ],
        },
      },
      _source: ["message", "createdAt"],
    }),
  ]);

  const items = [];
  for (const hit of feedbackRes.hits.hits) {
    const src = hit._source || {};
    if (src.description) {
      items.push({ text: String(src.description), createdAt: src.createdAt || sinceIso });
    }
  }
  for (const hit of supportRes.hits.hits) {
    const src = hit._source || {};
    if (src.message) {
      items.push({ text: String(src.message), createdAt: src.createdAt || sinceIso });
    }
  }

  const map = new Map();
  for (const item of items) {
    const cluster = classifyIssue(item.text);
    const existing = map.get(cluster.key) || {
      title: cluster.title,
      count: 0,
      sampleMessages: [],
      lastSeenAt: item.createdAt,
    };
    existing.count += 1;
    if (existing.sampleMessages.length < 4) {
      existing.sampleMessages.push(item.text.slice(0, 220));
    }
    if (item.createdAt > existing.lastSeenAt) {
      existing.lastSeenAt = item.createdAt;
    }
    map.set(cluster.key, existing);
  }

  for (const [clusterKey, value] of map.entries()) {
    const id = `${teamId}:${clusterKey}`;
    await client.index({
      index: issueClustersIndex,
      id,
      document: {
        id,
        teamId,
        clusterKey,
        title: value.title,
        count: value.count,
        sampleMessages: value.sampleMessages,
        status: "open",
        lastSeenAt: value.lastSeenAt,
        updatedAt: new Date().toISOString(),
      },
      refresh: true,
    });
  }

  const clusters = await client.search({
    index: issueClustersIndex,
    size: 20,
    query: { term: { teamId } },
    sort: [{ count: "desc" }, { lastSeenAt: "desc" }],
  });

  console.log(
    JSON.stringify(
      {
        teamId,
        scanned: items.length,
        clusters: clusters.hits.hits.map((h) => h._source),
      },
      null,
      2,
    ),
  );
}

const teamId = process.argv[2] || "hgl9jjg0uv7";
recluster(teamId).catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
