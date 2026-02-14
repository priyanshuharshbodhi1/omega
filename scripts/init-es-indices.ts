import { Client } from "@elastic/elasticsearch";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const endpoint =
  process.env.ELASTIC_ENDPOINT ||
  process.env.ENDPOINT ||
  process.env.ELASTICSEARCH_ENDPOINT;
let apiKey = process.env.ELASTIC_API_KEY || "";

// Handle keys with prefixes like 'essu_' or 'ApiKey '
const client = new Client({
  node: endpoint,
  auth: {
    apiKey: apiKey,
  },
});

async function createIndices() {
  console.log("--- Creating Elasticsearch Indices ---");

  // 1. Feedback Index
  try {
    await client.indices.create({
      index: "feedback",
      body: {
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
            createdAt: { type: "date" },
            updatedAt: { type: "date" },
            embedding: {
              type: "dense_vector",
              dims: 1536,
              index: true,
              similarity: "cosine",
            },
          },
        },
      },
    });
    console.log("✅ Created index: feedback");
  } catch (e: any) {
    if (e.meta?.body?.error?.type === "resource_already_exists_exception") {
      console.log('ℹ️ Index "feedback" already exists.');
    } else {
      console.error("❌ Error creating feedback index:", e.meta?.body || e);
    }
  }

  // 2. Customers Index
  try {
    await client.indices.create({
      index: "customers",
      body: {
        mappings: {
          properties: {
            id: { type: "keyword" },
            teamId: { type: "keyword" },
            name: { type: "text" },
            email: { type: "keyword" },
            phone: { type: "keyword" },
            isVerified: { type: "boolean" },
            createdAt: { type: "date" },
          },
        },
      },
    });
    console.log("✅ Created index: customers");
  } catch (e: any) {
    if (e.meta?.body?.error?.type === "resource_already_exists_exception") {
      console.log('ℹ️ Index "customers" already exists.');
    } else {
      console.error("❌ Error creating customers index:", e.meta?.body || e);
    }
  }

  // 3. Teams Index
  try {
    await client.indices.create({
      index: "teams",
      body: {
        mappings: {
          properties: {
            id: { type: "keyword" },
            name: { type: "text" },
            description: { type: "text" },
            style: { type: "object", enabled: false },
            createdAt: { type: "date" },
          },
        },
      },
    });
    console.log("✅ Created index: teams");
  } catch (e: any) {
    if (e.meta?.body?.error?.type === "resource_already_exists_exception") {
      console.log('ℹ️ Index "teams" already exists.');
    } else {
      console.error("❌ Error creating teams index:", e.meta?.body || e);
    }
  }

  // 4. Users Index (for Auth)
  try {
    await client.indices.create({
      index: "users",
      body: {
        mappings: {
          properties: {
            id: { type: "keyword" },
            name: { type: "text" },
            email: { type: "keyword" },
            password: { type: "keyword", index: false }, // Use keyword but don't index for search
            currentTeamId: { type: "keyword" },
            createdAt: { type: "date" },
            updatedAt: { type: "date" },
          },
        },
      },
    });
    console.log("✅ Created index: users");
  } catch (e: any) {
    if (e.meta?.body?.error?.type === "resource_already_exists_exception") {
      console.log('ℹ️ Index "users" already exists.');
    } else {
      console.error("❌ Error creating users index:", e.meta?.body || e);
    }
  }

  console.log("--- Index initialization complete ---");
}

createIndices().catch(console.error);
