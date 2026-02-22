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

async function main() {
  await ensureFeedbackIndex();
  await upsertPipeline();
  await backfillEmbeddings();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
