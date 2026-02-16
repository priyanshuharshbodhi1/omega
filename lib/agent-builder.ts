export async function invokeAgent({
  agentId,
  message,
  conversationId,
}: {
  agentId: string;
  message: string;
  conversationId?: string;
}) {
  const KIBANA_URL = process.env.ELASTIC_KIBANA_URL;
  const API_KEY = process.env.ELASTIC_API_KEY;

  if (!KIBANA_URL || !API_KEY) {
    throw new Error("Missing ELASTIC_KIBANA_URL or ELASTIC_API_KEY");
  }

  const response = await fetch(`${KIBANA_URL}/api/agent_builder/converse`, {
    method: "POST",
    headers: {
      Authorization: `ApiKey ${API_KEY}`,
      "Content-Type": "application/json",
      "kbn-xsrf": "true",
    },
    body: JSON.stringify({
      agent_id: agentId,
      input: message,
      conversation_id: conversationId,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Agent Builder API error: ${response.status} - ${errorBody}`,
    );
  }

  return response.json();
}
