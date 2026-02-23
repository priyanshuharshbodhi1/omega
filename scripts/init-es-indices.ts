import { Client } from "@elastic/elasticsearch";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const endpoint =
  process.env.ELASTIC_ENDPOINT ||
  process.env.ENDPOINT ||
  process.env.ELASTICSEARCH_ENDPOINT;
let apiKey = process.env.ELASTIC_API_KEY || "";
const feedbackPipelineId =
  process.env.ELASTIC_FEEDBACK_INGEST_PIPELINE || "feedback-ingest-pipeline";
const embeddingEndpointId =
  process.env.ELASTIC_EMBEDDING_ENDPOINT_ID || ".openai-text-embedding-3-small";
const embeddingDims = Number(process.env.ELASTIC_EMBEDDING_DIMS || "1536");

// Handle keys with prefixes like 'essu_' or 'ApiKey '
const client = new Client({
  node: endpoint,
  auth: {
    apiKey: apiKey,
  },
});

async function createIndices() {
  console.log("--- Creating Elasticsearch Indices ---");

  // 0. Feedback ingest pipeline (Elastic embedding inference at write-time)
  try {
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
    console.log(`✅ Upserted ingest pipeline: ${feedbackPipelineId}`);
  } catch (e: any) {
    console.error("❌ Error creating feedback ingest pipeline:", e.message || e);
  }

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
            updatedAt: { type: "date" },
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

  // 5. Support Knowledge Index
  try {
    await client.indices.create({
      index: process.env.ELASTIC_SUPPORT_DOCS_INDEX || "support_docs",
      body: {
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
      },
    });
    console.log("✅ Created index: support_docs");
  } catch (e: any) {
    if (e.meta?.body?.error?.type === "resource_already_exists_exception") {
      console.log('ℹ️ Index "support_docs" already exists.');
    } else {
      console.error("❌ Error creating support_docs index:", e.meta?.body || e);
    }
  }

  // 6. Support Conversations Index
  try {
    await client.indices.create({
      index:
        process.env.ELASTIC_SUPPORT_CONVERSATIONS_INDEX || "support_conversations",
      body: {
        mappings: {
          properties: {
            id: { type: "keyword" },
            teamId: { type: "keyword" },
            sessionId: { type: "keyword" },
            role: { type: "keyword" },
            message: { type: "text" },
            sourceRefs: { type: "object", enabled: false },
            createdAt: { type: "date" },
          },
        },
      },
    });
    console.log("✅ Created index: support_conversations");
  } catch (e: any) {
    if (e.meta?.body?.error?.type === "resource_already_exists_exception") {
      console.log('ℹ️ Index "support_conversations" already exists.');
    } else {
      console.error(
        "❌ Error creating support_conversations index:",
        e.meta?.body || e,
      );
    }
  }

  // 7. Issue Clusters Index
  try {
    await client.indices.create({
      index: process.env.ELASTIC_ISSUE_CLUSTERS_INDEX || "issue_clusters",
      body: {
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
      },
    });
    console.log("✅ Created index: issue_clusters");
  } catch (e: any) {
    if (e.meta?.body?.error?.type === "resource_already_exists_exception") {
      console.log('ℹ️ Index "issue_clusters" already exists.');
    } else {
      console.error("❌ Error creating issue_clusters index:", e.meta?.body || e);
    }
  }

  // 9. Support Tickets Index
  try {
    await client.indices.create({
      index: process.env.ELASTIC_SUPPORT_TICKETS_INDEX || "support_tickets",
      body: {
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
      },
    });
    console.log("✅ Created index: support_tickets");
  } catch (e: any) {
    if (e.meta?.body?.error?.type === "resource_already_exists_exception") {
      console.log('ℹ️ Index "support_tickets" already exists.');
    } else {
      console.error("❌ Error creating support_tickets index:", e.meta?.body || e);
    }
  }

  // 8. Action Audit Log Index
  try {
    await client.indices.create({
      index: process.env.ELASTIC_ACTION_AUDIT_INDEX || "action_audit_log",
      body: {
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
      },
    });
    console.log("✅ Created index: action_audit_log");
  } catch (e: any) {
    if (e.meta?.body?.error?.type === "resource_already_exists_exception") {
      console.log('ℹ️ Index "action_audit_log" already exists.');
    } else {
      console.error("❌ Error creating action_audit_log index:", e.meta?.body || e);
    }
  }

  console.log("--- Index initialization complete ---");
}

createIndices().catch(console.error);
