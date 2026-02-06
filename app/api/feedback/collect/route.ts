import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaTiDBCloud } from "@tidbcloud/prisma-adapter";
import { connect } from "@tidbcloud/serverless";
import { NextResponse } from "next/server";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { stopWords } from "@/lib/stop-words";

const TEXT_CLASIFY = `Classify the sentiment of the message
Input: I had a terrible experience with this store. The clothes were of poor quality and overpriced.
Output: negative

Input: The clothing selection is decent, but the customer service needs improvement. It was just an okay experience.
Output: neutral

Input: I absolutely love shopping here! The staff is so helpful, and I always find stylish and affordable clothes.
Output: positive

Input: {input}
Output:
`;

const AI_RESPONSE = `User given feedback for us, please provide a summary or suggestion how to address common issues raised to act for us as company. Format the results in markdown. Here is the feedback: {input}`;

export async function POST(req: Request) {
  const connection = connect({ url: process.env.DATABASE_URL });
  const adapter = new PrismaTiDBCloud(connection);
  const prisma = new PrismaClient({ adapter });
  const body = await req.json();

  try {
    // Classify Text
    const promptClassify = ChatPromptTemplate.fromTemplate(TEXT_CLASIFY);
    const formattedPromptClassify = await promptClassify.format({
      input: body.text,
    });
    const modelClassify = new ChatOpenAI({
      temperature: 0.2,
    });
    const textClassify = await modelClassify.invoke(formattedPromptClassify);

    // aiResponse feedback
    const promptResponse = ChatPromptTemplate.fromTemplate(AI_RESPONSE);
    const formattedPromptResponse = await promptResponse.format({
      input: body.text,
    });
    const modelResponse = new ChatOpenAI({
      temperature: 0.7,
    });
    const textResponse = await modelResponse.invoke(formattedPromptResponse);

    const feedbackStored = await prisma.feedback.create({
      data: {
        teamId: body.teamId,
        rate: body.rate,
        description: body.text,
        aiResponse: (textResponse.content as String).trim(),
        sentiment: (textClassify.content as String).trim(),
      },
    });

    // Split Text
    const textSplitted = body.text
      .toLowerCase()
      .replace(/[.,?!]/g, "")
      .split(/\s+/);

    textSplitted.map(async (ts: string) => {
      const excludeWords = stopWords;
      if (!excludeWords.includes(ts.trim().toLowerCase())) {
        const wordTag = await prisma.feedbackTag.findFirst({
          where: {
            teamId: body.teamId,
            name: ts.trim(),
          },
        });

        if (wordTag) {
          await prisma.feedbackTag.update({
            where: {
              id: wordTag.id,
            },
            data: {
              total: wordTag.total + 1,
            },
          });
        } else {
          await prisma.feedbackTag.create({
            data: {
              teamId: body.teamId,
              name: ts.trim(),
              total: 1,
            },
          });
        }
      }
    });

    const texts = [`${body.text}`];

    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
      dimensions: 1536,
    });

    const vectorData = await embeddings.embedDocuments(texts);

    const embeddedDocument = await prisma.embeddedDocument.create({
      data: {
        teamId: body.teamId,
        content: texts[0],
        metadata: { type: "feedback", sentiment: (textClassify.content as String).trim(), feedbackId: feedbackStored.id, teamId: body.teamId },
      },
    });

    await prisma.$executeRawUnsafe(
      `UPDATE EmbeddedDocument SET embedding = '[${vectorData}]' WHERE id = '${embeddedDocument.id}'`
    );

    return NextResponse.json({ success: true, message: "Success send feedback", data: feedbackStored }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
