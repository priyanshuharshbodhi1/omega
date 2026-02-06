import { openai } from "@ai-sdk/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PrismaClient } from "@prisma/client";
import { PrismaTiDBCloud } from "@tidbcloud/prisma-adapter";
import { connect } from "@tidbcloud/serverless";
import { streamText, convertToCoreMessages } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const formatMessage = (message: any) => {
  return `${message.role}: ${message.content}`;
};

export async function POST(req: Request) {
  const { messages, team, session } = await req.json();
  const connection = connect({ url: process.env.DATABASE_URL });
  const adapter = new PrismaTiDBCloud(connection);
  const prisma = new PrismaClient({ adapter });

  const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
  const currentMessageContent = messages[messages.length - 1].content;

  const texts = [currentMessageContent];
  const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    dimensions: 1536,
  });
  const vectorData = await embeddings.embedDocuments(texts);

  const relateds = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, content, vec_cosine_distance(embedding, '[${vectorData}]') AS distance FROM EmbeddedDocument ORDER BY distance LIMIT 40`
  );
  const context = relateds.map((r) => r.content).join("\n- ");

  const result = await streamText({
    model: openai("gpt-4o-mini"),
    messages: convertToCoreMessages(messages),
    system: `You are a smart assistant who helps users analyze feedback for their company. Here is the user profile: \n- Name: ${session?.user?.name}\n\n
    Here is the feedback list the company has received:
    ${context}

    Rules:
    - Format the results in markdown
    - If you don't know the answer, just say you don't know. Don't try to make up an answer
    - Answer concisely & in detail`,
  });

  return result.toDataStreamResponse();
}
