import dotenv from "dotenv";
dotenv.config();

const KIBANA_URL = process.env.ELASTIC_KIBANA_URL;
const API_KEY = process.env.ELASTIC_API_KEY;

const agentId = "omega_summarizer";

const configs = [
  {
    path: `/s/default/api/agent_builder/converse`,
    body: { message: "ping", agent_id: agentId },
  },
  {
    path: `/api/agent_builder/converse`,
    body: { agent_id: agentId, message: { text: "ping" } },
  },
  { path: `/api/agent_builder/converse`, body: { agent_id: agentId } },
];

async function discover() {
  console.log(`Checking Kibana at: ${KIBANA_URL}`);

  for (const config of configs) {
    try {
      const url = `${KIBANA_URL}${config.path}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `ApiKey ${API_KEY}`,
          "Content-Type": "application/json",
          "kbn-xsrf": "true",
        },
        body: JSON.stringify(config.body),
      });

      console.log(
        `Path: ${config.path} | Body: ${Object.keys(config.body)} -> Status: ${response.status}`,
      );
      const text = await response.text();
      console.log(`Response: ${text.substring(0, 150)}`);
    } catch (e: any) {
      console.log(`Error on ${config.path}: ${e.message}`);
    }
  }
}

discover();
