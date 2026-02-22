import { Client } from "@elastic/elasticsearch";

const endpoint =
  process.env.ELASTIC_ENDPOINT ||
  process.env.ENDPOINT ||
  process.env.ELASTICSEARCH_ENDPOINT;
const apiKey = process.env.ELASTIC_API_KEY;

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

  await esClient.index({
    index: "feedback",
    id: id,
    document: feedback,
    pipeline: "elser-feedback-pipeline", // Auto-generate ELSER tokens
    refresh: true,
  });

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
