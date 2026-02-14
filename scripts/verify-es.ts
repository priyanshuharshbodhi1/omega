import { Client } from "@elastic/elasticsearch";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function verify() {
  const endpoint = process.env.ELASTIC_ENDPOINT;
  const apiKey = process.env.ELASTIC_API_KEY;

  if (!endpoint || !apiKey) {
    console.error("Missing ELASTIC_ENDPOINT or ELASTIC_API_KEY in .env");
    return;
  }

  const client = new Client({
    node: endpoint,
    auth: { apiKey },
  });

  const indices = ["users", "teams", "feedback", "customers"];
  console.log("--- Standalone ES Verification ---");
  for (const index of indices) {
    try {
      const count = await client.count({ index });
      console.log(`Index: ${index}, Count: ${count.count}`);
    } catch (e) {
      console.log(`Index: ${index} not found or error: ${e.message}`);
    }
  }
}

verify();
