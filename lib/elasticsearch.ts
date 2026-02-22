import { Client } from "@elastic/elasticsearch";

const endpoint =
  process.env.ELASTIC_ENDPOINT ||
  process.env.ENDPOINT ||
  process.env.ELASTICSEARCH_ENDPOINT;
const apiKey = process.env.ELASTIC_API_KEY;
const feedbackIndex = process.env.ELASTIC_FEEDBACK_INDEX || "feedback";
const feedbackPipeline =
  process.env.ELASTIC_FEEDBACK_INGEST_PIPELINE || "feedback-ingest-pipeline";
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
