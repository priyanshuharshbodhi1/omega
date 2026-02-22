export async function invokeAgent({
  agentId,
  message,
  conversationId,
  configurationOverrides,
}: {
  agentId: string;
  message: string;
  conversationId?: string;
  configurationOverrides?: {
    instructions?: string;
    tools?: Array<{ tool_ids: string[] }>;
  };
}) {
  const KIBANA_URL = process.env.ELASTIC_KIBANA_URL;
  const API_KEY = process.env.ELASTIC_API_KEY;
  const spaceId = process.env.ELASTIC_KIBANA_SPACE_ID;

  if (!KIBANA_URL || !API_KEY) {
    throw new Error("Missing ELASTIC_KIBANA_URL or ELASTIC_API_KEY");
  }

  const basePath =
    spaceId && spaceId !== "default"
      ? `/s/${spaceId}/api/agent_builder/converse`
      : "/api/agent_builder/converse";

  const response = await fetch(`${KIBANA_URL}${basePath}`, {
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
      configuration_overrides: configurationOverrides,
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
