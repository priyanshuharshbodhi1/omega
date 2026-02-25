import dotenv from "dotenv";
import { Client } from "@elastic/elasticsearch";

dotenv.config();

const endpoint =
  process.env.ELASTIC_ENDPOINT ||
  process.env.ENDPOINT ||
  process.env.ELASTICSEARCH_ENDPOINT;
const apiKey = process.env.ELASTIC_API_KEY;

const feedbackPipelineId =
  process.env.ELASTIC_FEEDBACK_INGEST_PIPELINE || "feedback-ingest-pipeline";
const embeddingEndpointId =
  process.env.ELASTIC_EMBEDDING_ENDPOINT_ID || ".openai-text-embedding-3-small";
const embeddingDims = Number(process.env.ELASTIC_EMBEDDING_DIMS || "1536");

if (!endpoint || !apiKey) {
  console.error("Missing ELASTIC_ENDPOINT and/or ELASTIC_API_KEY.");
  process.exit(1);
}

const client = new Client({
  node: endpoint,
  auth: { apiKey },
});

async function ensureFeedbackIndex() {
  const exists = await client.indices.exists({ index: "feedback" });
  if (exists) {
    console.log('Index "feedback" already exists.');
    return;
  }

  await client.indices.create({
    index: "feedback",
    mappings: {
      properties: {
        id: { type: "keyword" },
        teamId: { type: "keyword" },
        customerId: { type: "keyword" },
        type: { type: "keyword" },
        rate: { type: "integer" },
        description: { type: "text" },
        aiResponse: { type: "text" },
        sentiment: { type: "keyword" },
        isResolved: { type: "boolean" },
        customerName: { type: "keyword" },
        customerEmail: { type: "keyword" },
        customerPhone: { type: "keyword" },
        githubIssueUrl: { type: "keyword", index: false },
        githubIssueNumber: { type: "integer" },
        githubIssueCreatedAt: { type: "date" },
        createdAt: { type: "date" },
        updatedAt: { type: "date" },
        embedding: {
          type: "dense_vector",
          dims: embeddingDims,
          index: true,
          similarity: "cosine",
        },
      },
    },
  });
  console.log('Created index "feedback".');
}

async function ensureSupportIndices() {
  const supportDocsIndex = process.env.ELASTIC_SUPPORT_DOCS_INDEX || "support_docs";
  const supportConversationsIndex =
    process.env.ELASTIC_SUPPORT_CONVERSATIONS_INDEX || "support_conversations";
  const issueClustersIndex = process.env.ELASTIC_ISSUE_CLUSTERS_INDEX || "issue_clusters";
  const actionAuditIndex = process.env.ELASTIC_ACTION_AUDIT_INDEX || "action_audit_log";
  const supportTicketsIndex =
    process.env.ELASTIC_SUPPORT_TICKETS_INDEX || "support_tickets";
  const supportAnswerFeedbackIndex =
    process.env.ELASTIC_SUPPORT_ANSWER_FEEDBACK_INDEX || "support_answer_feedback";

  const supportDocsExists = await client.indices.exists({ index: supportDocsIndex });
  if (!supportDocsExists) {
    await client.indices.create({
      index: supportDocsIndex,
      mappings: {
        properties: {
          id: { type: "keyword" },
          teamId: { type: "keyword" },
          sourceId: { type: "keyword" },
          sourceType: { type: "keyword" },
          title: { type: "text" },
          url: { type: "keyword" },
          content: { type: "text" },
          contentSnippet: { type: "text" },
          chunk: { type: "integer" },
          createdAt: { type: "date" },
          updatedAt: { type: "date" },
          embedding: {
            type: "dense_vector",
            dims: embeddingDims,
            index: true,
            similarity: "cosine",
          },
        },
      },
    });
    console.log(`Created index "${supportDocsIndex}".`);
  } else {
    console.log(`Index "${supportDocsIndex}" already exists.`);
  }

  const supportConversationsExists = await client.indices.exists({
    index: supportConversationsIndex,
  });
  if (!supportConversationsExists) {
    await client.indices.create({
      index: supportConversationsIndex,
      mappings: {
        properties: {
          id: { type: "keyword" },
          teamId: { type: "keyword" },
          sessionId: { type: "keyword" },
          role: { type: "keyword" },
          message: { type: "text" },
          sourceRefs: { type: "object", enabled: false },
          confidenceScore: { type: "integer" },
          followUpQuestions: { type: "text" },
          escalationSuggested: { type: "boolean" },
          csatRating: { type: "keyword" },
          createdAt: { type: "date" },
        },
      },
    });
    console.log(`Created index "${supportConversationsIndex}".`);
  } else {
    console.log(`Index "${supportConversationsIndex}" already exists.`);
  }

  const issueClustersExists = await client.indices.exists({ index: issueClustersIndex });
  if (!issueClustersExists) {
    await client.indices.create({
      index: issueClustersIndex,
      mappings: {
        properties: {
          id: { type: "keyword" },
          teamId: { type: "keyword" },
          clusterKey: { type: "keyword" },
          title: { type: "text" },
          count: { type: "integer" },
          sampleMessages: { type: "text" },
          status: { type: "keyword" },
          lastSeenAt: { type: "date" },
          updatedAt: { type: "date" },
        },
      },
    });
    console.log(`Created index "${issueClustersIndex}".`);
  } else {
    console.log(`Index "${issueClustersIndex}" already exists.`);
  }

  const actionAuditExists = await client.indices.exists({ index: actionAuditIndex });
  if (!actionAuditExists) {
    await client.indices.create({
      index: actionAuditIndex,
      mappings: {
        properties: {
          id: { type: "keyword" },
          teamId: { type: "keyword" },
          clusterId: { type: "keyword" },
          action: { type: "keyword" },
          status: { type: "keyword" },
          detail: { type: "text" },
          actorEmail: { type: "keyword" },
          createdAt: { type: "date" },
        },
      },
    });
    console.log(`Created index "${actionAuditIndex}".`);
  } else {
    console.log(`Index "${actionAuditIndex}" already exists.`);
  }

  const supportTicketsExists = await client.indices.exists({
    index: supportTicketsIndex,
  });
  if (!supportTicketsExists) {
    await client.indices.create({
      index: supportTicketsIndex,
      mappings: {
        properties: {
          id: { type: "keyword" },
          teamId: { type: "keyword" },
          source: { type: "keyword" },
          sessionId: { type: "keyword" },
          language: { type: "keyword" },
          customerName: { type: "text" },
          customerEmail: { type: "keyword" },
          customerPhone: { type: "keyword" },
          subject: { type: "text" },
          description: { type: "text" },
          attachmentName: { type: "keyword" },
          attachmentContentType: { type: "keyword" },
          attachmentDataUrl: { type: "keyword", index: false },
          status: { type: "keyword" },
          createdAt: { type: "date" },
          updatedAt: { type: "date" },
        },
      },
    });
    console.log(`Created index "${supportTicketsIndex}".`);
  } else {
    console.log(`Index "${supportTicketsIndex}" already exists.`);
  }

  const supportAnswerFeedbackExists = await client.indices.exists({
    index: supportAnswerFeedbackIndex,
  });
  if (!supportAnswerFeedbackExists) {
    await client.indices.create({
      index: supportAnswerFeedbackIndex,
      mappings: {
        properties: {
          id: { type: "keyword" },
          teamId: { type: "keyword" },
          sessionId: { type: "keyword" },
          assistantMessageId: { type: "keyword" },
          rating: { type: "keyword" },
          isHelpful: { type: "boolean" },
          createdAt: { type: "date" },
          updatedAt: { type: "date" },
        },
      },
    });
    console.log(`Created index "${supportAnswerFeedbackIndex}".`);
  } else {
    console.log(`Index "${supportAnswerFeedbackIndex}" already exists.`);
  }
}

async function upsertPipeline() {
  await client.ingest.putPipeline({
    id: feedbackPipelineId,
    processors: [
      {
        inference: {
          model_id: embeddingEndpointId,
          input_output: [
            {
              input_field: "description",
              output_field: "embedding",
            },
          ],
          ignore_missing: true,
          ignore_failure: true,
        },
      },
    ],
    on_failure: [
      {
        set: {
          field: "ingest_embedding_error",
          value: "{{ _ingest.on_failure_message }}",
        },
      },
    ],
  });
  console.log(`Upserted ingest pipeline "${feedbackPipelineId}".`);
}

async function backfillEmbeddings() {
  const result = await client.updateByQuery({
    index: "feedback",
    refresh: true,
    conflicts: "proceed",
    pipeline: feedbackPipelineId,
    query: {
      bool: {
        must_not: [{ exists: { field: "embedding" } }],
      },
    },
    script: {
      source: "ctx._source.updatedAt = params.now",
      lang: "painless",
      params: { now: new Date().toISOString() },
    },
  });

  console.log(
    `Backfill complete: updated=${result.updated}, total=${result.total}, failures=${(result.failures || []).length}`,
  );
}

async function ensureDailyStatsTransform() {
  const indexName = "feedback_daily_stats";
  const transformId = "feedback_daily_stats_transform";

  // Create destination index if it doesn't exist
  const indexExists = await client.indices.exists({ index: indexName });
  if (!indexExists) {
    await client.indices.create({
      index: indexName,
      mappings: {
        properties: {
          teamId: { type: "keyword" },
          day: { type: "date" },
          total: { type: "long" },
          avg_rating: { type: "float" },
          positive_count: { type: "long" },
          negative_count: { type: "long" },
          neutral_count: { type: "long" },
        },
      },
    });
    console.log(`Created index "${indexName}".`);
  } else {
    console.log(`Index "${indexName}" already exists.`);
  }

  // Delete existing transform if present (to allow re-creation)
  try {
    await client.transform.getTransform({ transform_id: transformId });
    // Transform exists – stop + delete so we can recreate with latest config
    try {
      await client.transform.stopTransform({
        transform_id: transformId,
        wait_for_completion: true,
        timeout: "30s",
      });
    } catch {
      // may already be stopped
    }
    await client.transform.deleteTransform({ transform_id: transformId });
    console.log(`Deleted existing transform "${transformId}".`);
  } catch {
    // Transform doesn't exist – that's fine
  }

  // Create the continuous transform
  await client.transform.putTransform({
    transform_id: transformId,
    source: {
      index: ["feedback"],
    },
    dest: {
      index: indexName,
    },
    pivot: {
      group_by: {
        teamId: { terms: { field: "teamId" } },
        day: { date_histogram: { field: "createdAt", calendar_interval: "1d" } },
      },
      aggregations: {
        total: { value_count: { field: "teamId" } },
        avg_rating: { avg: { field: "rate" } },
        positive_count: {
          filter: { term: { sentiment: "positive" } },
        },
        negative_count: {
          filter: { term: { sentiment: "negative" } },
        },
        neutral_count: {
          filter: { term: { sentiment: "neutral" } },
        },
      },
    },
    sync: {
      time: {
        field: "createdAt",
        delay: "60s",
      },
    },
    frequency: "1m",
    description:
      "Continuous transform: daily feedback stats per team (count, avg rating, sentiment breakdown)",
  });
  console.log(`Created continuous transform "${transformId}".`);

  // Start the transform
  await client.transform.startTransform({ transform_id: transformId });
  console.log(`Started transform "${transformId}".`);
}

async function ensureSentimentSpikeWatcher() {
  const watchId = "omega_sentiment_spike";

  try {
    await client.watcher.putWatch({
      id: watchId,
      trigger: {
        schedule: { interval: "5m" },
      },
      input: {
        search: {
          request: {
            indices: ["feedback"],
            body: {
              size: 0,
              query: {
                range: { createdAt: { gte: "now-1h" } },
              },
              aggs: {
                by_team: {
                  terms: { field: "teamId", size: 50 },
                  aggs: {
                    total: { value_count: { field: "sentiment" } },
                    negative: {
                      filter: { term: { sentiment: "negative" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      condition: {
        script: {
          source: `
            def buckets = ctx.payload.aggregations.by_team.buckets;
            for (bucket in buckets) {
              def total = bucket.total.value;
              def neg = bucket.negative.doc_count;
              if (total >= 3 && (neg * 1.0 / total) > 0.4) {
                return true;
              }
            }
            return false;
          `.trim(),
          lang: "painless",
        },
      },
      actions: {
        log_spike: {
          logging: {
            text: "Sentiment spike detected – negative rate > 40% in last hour for at least one team.",
          },
        },
      },
    });
    console.log(`Created/updated Watcher "${watchId}".`);
  } catch (err) {
    // Watcher API is unavailable on Elastic Serverless – graceful skip
    const msg = err?.message || String(err);
    if (
      msg.includes("action_request_validation_exception") ||
      msg.includes("watcher") ||
      msg.includes("x_content_parse_exception") ||
      msg.includes("404") ||
      msg.includes("not found")
    ) {
      console.log(
        `Watcher API not available (likely Serverless) – skipping "${watchId}". (${msg.slice(0, 100)})`,
      );
    } else {
      throw err;
    }
  }
}

async function main() {
  await ensureFeedbackIndex();
  await ensureSupportIndices();
  await upsertPipeline();
  await backfillEmbeddings();
  await ensureDailyStatsTransform();
  await ensureSentimentSpikeWatcher();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
