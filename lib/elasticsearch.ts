import { Client } from "@elastic/elasticsearch";

const endpoint =
  process.env.ELASTIC_ENDPOINT ||
  process.env.ENDPOINT ||
  process.env.ELASTICSEARCH_ENDPOINT;
const apiKey = process.env.ELASTIC_API_KEY;
const feedbackIndex = process.env.ELASTIC_FEEDBACK_INDEX || "feedback";
const feedbackPipeline =
  process.env.ELASTIC_FEEDBACK_INGEST_PIPELINE || "feedback-ingest-pipeline";
const supportDocsIndex = process.env.ELASTIC_SUPPORT_DOCS_INDEX || "support_docs";
const supportConversationsIndex =
  process.env.ELASTIC_SUPPORT_CONVERSATIONS_INDEX || "support_conversations";
const issueClustersIndex = process.env.ELASTIC_ISSUE_CLUSTERS_INDEX || "issue_clusters";
const actionAuditLogIndex = process.env.ELASTIC_ACTION_AUDIT_INDEX || "action_audit_log";
const supportTicketsIndex = process.env.ELASTIC_SUPPORT_TICKETS_INDEX || "support_tickets";
const embeddingEndpointId =
  process.env.ELASTIC_EMBEDDING_ENDPOINT_ID || ".openai-text-embedding-3-small";
const completionEndpointId =
  process.env.ELASTIC_COMPLETION_ENDPOINT_ID || ".openai-gpt-4.1-mini-completion";

export const esClient = new Client({
  node: endpoint,
  auth: {
    apiKey: apiKey!,
  },
});

// Helper for ES|QL queries
export async function runESQL(query: string) {
  return esClient.esql.query({
    query: query,
  });
}

// Generate a random ID since we're not using Prisma's cuid() for these
export const generateId = () => Math.random().toString(36).substring(2, 15);

export interface Team {
  id: string;
  name: string;
  description?: string;
  style?: any;
  issueTracker?: "github" | "linear";
  createdAt: string;
  updatedAt: string;
}

export async function createTeam(data: Partial<Team>) {
  const id = data.id || generateId();
  const now = new Date().toISOString();
  const team = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  await esClient.index({
    index: "teams",
    id: id,
    document: team,
    refresh: true,
  });

  return team;
}

export async function updateTeam(id: string, data: Partial<Team>) {
  const now = new Date().toISOString();
  const doc = {
    ...data,
    updatedAt: now,
  };

  await esClient.update({
    index: "teams",
    id: id,
    doc: doc,
    refresh: true,
  });

  return { id, ...doc };
}

export async function getTeam(id: string) {
  try {
    const result = await esClient.get({
      index: "teams",
      id: id,
    });
    return result._source as Team;
  } catch (error) {
    return null;
  }
}

export async function createFeedback(data: any) {
  const id = generateId();
  const now = new Date().toISOString();
  const feedback = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await esClient.index({
      index: feedbackIndex,
      id: id,
      document: feedback,
      pipeline: feedbackPipeline,
      refresh: true,
    });
  } catch (error) {
    // Keep ingestion resilient if the pipeline is temporarily unavailable.
    await esClient.index({
      index: feedbackIndex,
      id: id,
      document: feedback,
      refresh: true,
    });
  }

  return feedback;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  currentTeamId?: string;
  createdAt: string;
  updatedAt: string;
}

export async function createUser(data: Partial<User>) {
  const id = data.id || generateId();
  const now = new Date().toISOString();
  // Ensure email is lowercased
  if (data.email) data.email = data.email.toLowerCase();

  const user = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  await esClient.index({
    index: "users",
    id: id,
    document: user,
    refresh: true,
  });

  return user;
}

export async function getUserByEmail(email: string) {
  try {
    const result = await esClient.search({
      index: "users",
      query: {
        match: { email: email.toLowerCase() },
      },
    });
    if (result.hits.total === 0 || (result.hits.total as any).value === 0)
      return null;
    const hit = result.hits.hits[0];
    return { id: hit._id, ...(hit._source as any) } as User;
  } catch (error) {
    return null;
  }
}

export async function getUserById(id: string) {
  try {
    const result = await esClient.get({
      index: "users",
      id: id,
    });
    return { id: result._id, ...(result._source as any) } as User;
  } catch (error) {
    return null;
  }
}

export async function getElasticTextEmbedding(text: string) {
  const cleanText = String(text || "").trim();
  if (!cleanText) return null;

  try {
    const result = await esClient.inference.textEmbedding({
      inference_id: embeddingEndpointId,
      input: cleanText,
      timeout: "20s",
    });

    const embedding = result.text_embedding?.[0]?.embedding;
    return Array.isArray(embedding) ? embedding : null;
  } catch (error) {
    return null;
  }
}

export async function findRelatedFeedbackByVector(params: {
  queryVector: number[];
  teamId?: string;
  excludeId?: string;
  size?: number;
}) {
  const { queryVector, teamId, excludeId, size = 6 } = params;

  if (!Array.isArray(queryVector) || queryVector.length === 0) {
    return [];
  }

  const filterQuery: any = {
    bool: {
      filter: [] as any[],
      must_not: [] as any[],
    },
  };
  if (teamId) {
    filterQuery.bool.filter.push({ term: { teamId } });
  }
  if (excludeId) {
    filterQuery.bool.must_not.push({ ids: { values: [excludeId] } });
  }
  const hasFilter =
    filterQuery.bool.filter.length > 0 || filterQuery.bool.must_not.length > 0;

  const result = await esClient.search({
    index: feedbackIndex,
    knn: {
      field: "embedding",
      query_vector: queryVector,
      k: size,
      num_candidates: Math.max(size * 12, 60),
      ...(hasFilter ? { filter: filterQuery } : {}),
    },
    _source: {
      excludes: ["embedding"],
    },
  });

  return result.hits.hits.map((hit) => {
    const source = (hit._source as any) || {};
    return {
      id: hit._id,
      description: source.description || "",
      sentiment: source.sentiment || "neutral",
      rate: source.rate ?? null,
      createdAt: source.createdAt || null,
      teamId: source.teamId || null,
      score: hit._score ?? null,
      source,
    };
  });
}

export async function runElasticCompletion(input: string) {
  const text = String(input || "").trim();
  if (!text) return "";

  try {
    const result = await esClient.inference.completion({
      inference_id: completionEndpointId,
      input: text,
      timeout: "20s",
    });
    return result.completion?.[0]?.result?.trim() || "";
  } catch (error) {
    return "";
  }
}

export interface SupportKnowledgeDoc {
  id: string;
  teamId: string;
  sourceId: string;
  sourceType: "url" | "website" | "text" | "pdf";
  title: string;
  url?: string | null;
  content: string;
  contentSnippet: string;
  chunk: number;
  createdAt: string;
  updatedAt: string;
  embedding?: number[] | null;
}

export async function indexSupportKnowledgeDoc(
  data: Omit<SupportKnowledgeDoc, "id" | "createdAt" | "updatedAt" | "embedding"> & {
    embeddingText?: string;
  },
) {
  const id = generateId();
  const now = new Date().toISOString();
  const embedding = await getElasticTextEmbedding(data.embeddingText || data.content);

  const doc: SupportKnowledgeDoc = {
    id,
    teamId: data.teamId,
    sourceId: data.sourceId,
    sourceType: data.sourceType,
    title: data.title,
    url: data.url || null,
    content: data.content,
    contentSnippet: data.contentSnippet,
    chunk: data.chunk,
    createdAt: now,
    updatedAt: now,
    embedding,
  };

  await esClient.index({
    index: supportDocsIndex,
    id,
    document: doc,
    refresh: true,
  });

  return doc;
}

export async function searchSupportKnowledge(params: {
  teamId: string;
  query: string;
  size?: number;
}) {
  const { teamId, query, size = 5 } = params;
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) return [];

  const lexical = await esClient.search({
    index: supportDocsIndex,
    size,
    query: {
      bool: {
        filter: [{ term: { teamId } }],
        must: [
          {
            multi_match: {
              query: cleanQuery,
              fields: ["title^3", "content^2", "contentSnippet"],
              type: "best_fields",
            },
          },
        ],
      },
    },
    _source: ["title", "url", "contentSnippet", "sourceType", "sourceId", "chunk"],
  });

  return lexical.hits.hits.map((hit) => {
    const source = (hit._source as any) || {};
    return {
      id: hit._id,
      title: source.title || "Untitled source",
      url: source.url || null,
      snippet: source.contentSnippet || "",
      sourceType: source.sourceType || "text",
      sourceId: source.sourceId || null,
      chunk: source.chunk ?? 0,
      score: hit._score ?? null,
    };
  });
}

export async function listSupportKnowledgeSources(params: {
  teamId: string;
  size?: number;
}) {
  const { teamId, size = 100 } = params;
  const result = await esClient.search({
    index: supportDocsIndex,
    size,
    query: {
      term: { teamId },
    },
    sort: [{ updatedAt: "desc" }],
    _source: [
      "sourceId",
      "sourceType",
      "title",
      "url",
      "chunk",
      "updatedAt",
      "createdAt",
    ],
  });

  const grouped = new Map<
    string,
    {
      sourceId: string;
      sourceType: string;
      title: string;
      url: string | null;
      chunks: number;
      updatedAt: string | null;
    }
  >();

  for (const hit of result.hits.hits) {
    const source = (hit._source as any) || {};
    const sourceId = String(source.sourceId || hit._id);
    const existing = grouped.get(sourceId) || {
      sourceId,
      sourceType: String(source.sourceType || "text"),
      title: String(source.title || "Untitled source"),
      url: source.url ? String(source.url) : null,
      chunks: 0,
      updatedAt: source.updatedAt ? String(source.updatedAt) : null,
    };
    existing.chunks += 1;
    if (source.updatedAt && (!existing.updatedAt || source.updatedAt > existing.updatedAt)) {
      existing.updatedAt = String(source.updatedAt);
    }
    grouped.set(sourceId, existing);
  }

  return Array.from(grouped.values()).sort((a, b) =>
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
  );
}

export interface SupportConversationMessage {
  id: string;
  teamId: string;
  sessionId: string;
  role: "user" | "assistant";
  message: string;
  sourceRefs?: Array<{ id: string; title: string; url?: string | null }>;
  createdAt: string;
}

export async function createSupportConversationMessage(
  data: Omit<SupportConversationMessage, "id" | "createdAt">,
) {
  const id = generateId();
  const now = new Date().toISOString();
  const doc: SupportConversationMessage = {
    id,
    teamId: data.teamId,
    sessionId: data.sessionId,
    role: data.role,
    message: data.message,
    sourceRefs: data.sourceRefs || [],
    createdAt: now,
  };

  await esClient.index({
    index: supportConversationsIndex,
    id,
    document: doc,
    refresh: true,
  });

  return doc;
}

export async function upsertIssueCluster(data: {
  teamId: string;
  clusterKey: string;
  title: string;
  count: number;
  sampleMessages: string[];
  status?: "open" | "verified" | "closed";
  lastSeenAt?: string;
}) {
  const now = new Date().toISOString();
  const id = `${data.teamId}:${data.clusterKey}`;
  const doc = {
    id,
    teamId: data.teamId,
    clusterKey: data.clusterKey,
    title: data.title,
    count: data.count,
    sampleMessages: data.sampleMessages,
    status: data.status || "open",
    lastSeenAt: data.lastSeenAt || now,
    updatedAt: now,
  };

  await esClient.index({
    index: issueClustersIndex,
    id,
    document: doc,
    refresh: true,
  });

  return doc;
}

export async function listIssueClusters(teamId: string, size = 20) {
  const result = await esClient.search({
    index: issueClustersIndex,
    size,
    query: {
      term: { teamId },
    },
    sort: [{ count: "desc" }, { lastSeenAt: "desc" }],
  });

  return result.hits.hits.map((hit) => ({
    id: hit._id,
    ...(hit._source as any),
  }));
}

export async function getIssueClusterById(clusterId: string) {
  try {
    const result = await esClient.get({
      index: issueClustersIndex,
      id: clusterId,
    });
    return { id: result._id, ...(result._source as any) };
  } catch {
    return null;
  }
}

export async function updateIssueClusterStatus(params: {
  clusterId: string;
  status: "open" | "verified" | "closed";
}) {
  const { clusterId, status } = params;
  const now = new Date().toISOString();
  await esClient.update({
    index: issueClustersIndex,
    id: clusterId,
    doc: {
      status,
      updatedAt: now,
    },
    refresh: true,
  });
}

export async function createActionAuditLog(data: {
  teamId: string;
  clusterId?: string;
  action: string;
  status: "success" | "failed";
  detail?: string;
  actorEmail?: string;
}) {
  const id = generateId();
  const now = new Date().toISOString();
  const doc = {
    id,
    teamId: data.teamId,
    clusterId: data.clusterId || null,
    action: data.action,
    status: data.status,
    detail: data.detail || null,
    actorEmail: data.actorEmail || null,
    createdAt: now,
  };

  await esClient.index({
    index: actionAuditLogIndex,
    id,
    document: doc,
    refresh: true,
  });
  return doc;
}

export interface SupportTicket {
  id: string;
  teamId: string;
  source: "arya_escalation" | "manual";
  sessionId?: string | null;
  language?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  subject: string;
  description: string;
  attachmentName?: string | null;
  attachmentContentType?: string | null;
  attachmentDataUrl?: string | null;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  updatedAt: string;
}

export async function createSupportTicket(
  data: Omit<SupportTicket, "id" | "status" | "createdAt" | "updatedAt"> & {
    status?: SupportTicket["status"];
  },
) {
  const id = generateId();
  const now = new Date().toISOString();
  const doc: SupportTicket = {
    id,
    teamId: data.teamId,
    source: data.source,
    sessionId: data.sessionId || null,
    language: data.language || "en",
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    customerPhone: data.customerPhone || null,
    subject: data.subject,
    description: data.description,
    attachmentName: data.attachmentName || null,
    attachmentContentType: data.attachmentContentType || null,
    attachmentDataUrl: data.attachmentDataUrl || null,
    status: data.status || "open",
    createdAt: now,
    updatedAt: now,
  };

  await esClient.index({
    index: supportTicketsIndex,
    id,
    document: doc,
    refresh: true,
  });

  return doc;
}

export async function listSupportTickets(params: {
  teamId: string;
  size?: number;
}) {
  const { teamId, size = 100 } = params;
  const result = await esClient.search({
    index: supportTicketsIndex,
    size,
    query: {
      term: { teamId },
    },
    sort: [{ createdAt: "desc" }],
  });

  return result.hits.hits.map((hit) => ({
    id: hit._id,
    ...(hit._source as any),
  }));
}

export async function getSupportTicketById(ticketId: string) {
  try {
    const result = await esClient.get({
      index: supportTicketsIndex,
      id: ticketId,
    });
    return { id: result._id, ...(result._source as any) };
  } catch {
    return null;
  }
}

export async function updateSupportTicketStatus(params: {
  ticketId: string;
  status: "open" | "in_progress" | "resolved";
}) {
  const { ticketId, status } = params;
  const now = new Date().toISOString();
  await esClient.update({
    index: supportTicketsIndex,
    id: ticketId,
    doc: {
      status,
      updatedAt: now,
    },
    refresh: true,
  });
}
