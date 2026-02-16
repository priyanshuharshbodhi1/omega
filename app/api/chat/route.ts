import { streamText, convertToCoreMessages } from "ai";
import { esClient } from "@/lib/elasticsearch";
import { getAISDKModel } from "@/lib/llm"; // REMOVED getEmbeddings
import { CHAT_SYSTEM_PROMPT } from "@/prompts";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, team, session } = await req.json();
  const teamId = team?.id;

  const currentMessageContent = messages[messages.length - 1].content;

  try {
    // 🚀 NEW: Use ELSER (Sparse Vector) for Semantic Search
    // No need for OpenAI embeddings!
    const result_es = await esClient.search({
      index: "feedback",
      query: {
        bool: {
          must: [
            { term: { teamId: teamId } }, // Filter by team first
            {
              text_expansion: {
                "ml.tokens": {
                  model_id: ".elser_model_2_linux-x86_64", // Built-in ELSER model
                  model_text: currentMessageContent,
                },
              },
            },
          ],
        },
      },
      size: 10, // Get top 10 semantic matches
      _source: ["description", "sentiment", "rate", "createdAt"],
    });

    const relateds = result_es.hits.hits.map((hit: any) => ({
      content: hit._source.description,
      sentiment: hit._source.sentiment,
      rate: hit._source.rate,
      date: hit._source.createdAt,
    }));

    // Format context for the LLM
    const context = relateds
      .map(
        (r) =>
          `- [${r.date?.split("T")[0]}] (${r.sentiment}, ${r.rate}★): ${r.content}`,
      )
      .join("\n");

    const model = getAISDKModel();

    const result = await streamText({
      model: model as any,
      messages: convertToCoreMessages(messages),
      system: CHAT_SYSTEM_PROMPT(session?.user?.name, context),
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat error:", error);
    // Fallback if ES search fails
    const model = getAISDKModel();
    const result = await streamText({
      model: model as any,
      messages: convertToCoreMessages(messages),
      system: `You are a smart assistant. (Note: Feedback search currently unavailable) \n- Name: ${session?.user?.name}`,
    });
    return result.toDataStreamResponse();
  }
}
