import dotenv from "dotenv";

dotenv.config();

const kibanaUrl = process.env.ELASTIC_KIBANA_URL;
const apiKey = process.env.ELASTIC_API_KEY;
const agentId = process.env.ELASTIC_CHAT_AGENT_ID || "zapfeed_insights_agent_v1";
const teamId = process.env.EVAL_TEAM_ID || "hgl9jjg0uv7";

const questions = [
  "Give me a 2-line summary of customer sentiment right now.",
  "What are the top 3 issues and how many complaints for each?",
  "Show recent low-rating feedback snippets with dates.",
  "Are we improving or getting worse over time?",
  "What should I do in the next 7 days to reduce negative feedback?",
  "Give me an executive brief with the top risks and one KPI for next week.",
  "Show an urgent triage queue and what support should do in the next 24h.",
  "hello",
];

if (!kibanaUrl || !apiKey) {
  console.error("Missing ELASTIC_KIBANA_URL or ELASTIC_API_KEY in environment.");
  process.exit(1);
}

function scoreResponse(text) {
  const value = String(text || "").toLowerCase();
  const hasNumber = /\b\d+\b/.test(value);
  const hasDate = /\b20\d{2}-\d{2}-\d{2}\b/.test(value);
  const hasAction = value.includes("action") || value.includes("next") || value.includes("owner");
  const hasConfidence = value.includes("confidence");
  return {
    evidence: Number(hasNumber) + Number(hasDate),
    actionability: Number(hasAction),
    calibration: Number(hasConfidence),
  };
}

async function ask(question) {
  const body = {
    agent_id: agentId,
    input: `TEAM_ID=${teamId}\nUSER=Eval\nQUESTION=${question}`,
  };

  const startedAt = Date.now();
  const response = await fetch(`${kibanaUrl}/api/agent_builder/converse`, {
    method: "POST",
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      "Content-Type": "application/json",
      "kbn-xsrf": "true",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  const text = payload?.response?.message || payload?.message || "";
  const durationMs = Date.now() - startedAt;
  const score = scoreResponse(text);

  return {
    ok: response.ok,
    status: response.status,
    durationMs,
    question,
    text,
    score,
  };
}

async function main() {
  console.log(`Running chat eval for team ${teamId} with agent ${agentId}`);
  let total = { evidence: 0, actionability: 0, calibration: 0 };

  for (const question of questions) {
    const result = await ask(question);
    total.evidence += result.score.evidence;
    total.actionability += result.score.actionability;
    total.calibration += result.score.calibration;

    console.log("\n---");
    console.log(`Q: ${result.question}`);
    console.log(`Status: ${result.status} | Duration: ${result.durationMs}ms`);
    console.log(`Score => evidence:${result.score.evidence} action:${result.score.actionability} confidence:${result.score.calibration}`);
    console.log(String(result.text).slice(0, 800));
  }

  console.log("\n=== Aggregate Heuristic Score ===");
  console.log(
    `evidence=${total.evidence} actionability=${total.actionability} calibration=${total.calibration}`,
  );
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
