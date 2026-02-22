import Groq from "groq-sdk";
import { esClient, getTeam } from "@/lib/elasticsearch";
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
                  model_id: ".elser-2-elasticsearch", // Built-in ELSER model
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

    // Fetch team details to get preferences
    const teamDetails = await getTeam(teamId);
    const issueTracker = teamDetails?.issueTracker || "github"; // Default to GitHub

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `${CHAT_SYSTEM_PROMPT(session?.user?.name, context)}
          
          SYSTEM CONTEXT:
          - Preferred Issue Tracker: ${issueTracker}
          - If the user asks to "file a bug" or "create a ticket", confirm the details and then say you are using the ${issueTracker} tool.
          `,
        },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ],
      model: "llama-3.3-70b-versatile",
    });

    const text = completion.choices[0]?.message?.content || "";
    return new Response(text);
  } catch (error) {
    console.error("Chat error:", error);
    // Fallback if ES search fails
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a smart assistant. (Note: Feedback search currently unavailable) \n- Name: ${session?.user?.name}`,
        },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ],
      model: "llama-3.3-70b-versatile",
    });

    const text = completion.choices[0]?.message?.content || "";
    return new Response(text);
  }
}
