import { streamText, convertToCoreMessages } from "ai";
import { esClient } from "@/lib/elasticsearch";
import { getAISDKModel, getEmbeddings } from "@/lib/llm";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const formatMessage = (message: any) => {
  return `${message.role}: ${message.content}`;
};

export async function POST(req: Request) {
  const { messages, team, session } = await req.json();
  const teamId = team?.id;

  const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
  const currentMessageContent = messages[messages.length - 1].content;

  try {
    // Attempt to generate embeddings for kNN search
    const vectorData = await getEmbeddings(currentMessageContent);

    let relateds: any[] = [];

    if (vectorData && vectorData[0]) {
      // Use Elasticsearch kNN search for feedback context
      const result_es = await esClient.search({
        index: "feedback",
        knn: {
          field: "embedding",
          query_vector: vectorData[0],
          k: 40,
          num_candidates: 200,
          filter: {
            term: { teamId: teamId },
          },
        },
        _source: ["description"],
      });
      relateds = result_es.hits.hits.map((hit: any) => ({
        content: hit._source.description,
      }));
    } else {
      // Fallback: Use standard text search if no embeddings
      const result_es = await esClient.search({
        index: "feedback",
        query: {
          bool: {
            must: [
              { match: { description: currentMessageContent } },
              { term: { teamId: teamId } },
            ],
          },
        },
        size: 20,
        _source: ["description"],
      });
      relateds = result_es.hits.hits.map((hit: any) => ({
        content: hit._source.description,
      }));
    }

    const context = relateds.map((r) => r.content).join("\n- ");

    const model = getAISDKModel();

    const result = await streamText({
      model: model as any,
      messages: convertToCoreMessages(messages),
      system: `You are a smart assistant who helps users analyze feedback for their company. Here is the user profile: \n- Name: ${session?.user?.name}\n\n
      Here is the feedback list the company has received:
      ${context || "No specific feedback found for this query."}

      Rules:
      - Format the results in markdown
      - If you don't know the answer, just say you don't know. Don't try to make up an answer
      - Answer concisely & in detail`,
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
