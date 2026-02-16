import dotenv from "dotenv";
dotenv.config();

const KIBANA_URL = process.env.ELASTIC_KIBANA_URL;
const API_KEY = process.env.ELASTIC_API_KEY;

const teamId = "hgl9jjg0uv7";
const feedbacks = [
  "- Its helping me a lot, Thank you! But can u improve latency time.",
  "- The site lags a lot, please fix it.",
  "- Everything is good just needs some improvement in chat feature",
  "- Your customer service service guys dont responds fast. Else the procut is good.",
  "- The customer service is very bad",
  "- Hey the product is really great",
];

const sentiments = ["all", "positive", "neutral", "negative"];

async function testAgentBuilder(sentiment: string) {
  const start = Date.now();
  const msg = `Summarize these ${sentiment === "all" ? "" : sentiment + " "}feedbacks for Omega: ${feedbacks.join("\n")}`;
  try {
    const url = `${KIBANA_URL}/api/agent_builder/converse`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${API_KEY}`,
        "Content-Type": "application/json",
        "kbn-xsrf": "true",
      },
      body: JSON.stringify({
        agent_id: "omega_summarizer",
        input: msg,
      }),
    });
    const result = await response.json();
    const end = Date.now();
    return {
      success: response.ok,
      status: response.status,
      duration: end - start,
      content: result.message || JSON.stringify(result),
    };
  } catch (e: any) {
    return { success: false, error: e.message, duration: Date.now() - start };
  }
}

async function testBasicLLM(sentiment: string) {
  const start = Date.now();
  try {
    const response = await fetch(
      `http://localhost:3000/api/feedback/summary?teamId=${teamId}&sentiment=${sentiment}&force_fallback=true`,
    );
    const result = await response.json();
    const end = Date.now();
    return {
      success: response.ok,
      duration: end - start,
      content: result.data,
    };
  } catch (e: any) {
    return { success: false, error: e.message, duration: Date.now() - start };
  }
}

async function runBenchmark() {
  console.log("--- Comprehensive Performance Benchmark: Omega Summarizer ---");

  for (const sentiment of sentiments) {
    console.log(`\n>>> Testing Sentiment: [${sentiment.toUpperCase()}]`);

    console.log("Running Agent Builder...");
    const agentResults = await testAgentBuilder(sentiment);
    console.log(
      `Status: ${agentResults.status} | Time: ${agentResults.duration}ms`,
    );

    console.log("Running Basic LLM...");
    const fallbackResults = await testBasicLLM(sentiment);
    console.log(
      `Status: ${fallbackResults.success ? "200" : "500"} | Time: ${fallbackResults.duration}ms`,
    );

    console.log("\n[Summary Output Comparison]");
    console.log(
      `Agent: ${agentResults.success ? agentResults.content.substring(0, 150) : "FAILED"}`,
    );
    console.log(
      `Basic: ${fallbackResults.success ? fallbackResults.content.substring(0, 150) : "FAILED"}`,
    );
  }
}

runBenchmark();
