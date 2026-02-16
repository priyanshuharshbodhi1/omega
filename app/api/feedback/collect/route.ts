import { NextResponse } from "next/server";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createFeedback } from "@/lib/elasticsearch";
import { getChatModel, getEmbeddings } from "@/lib/llm";
import { SENTIMENT_CLASSIFY, FEEDBACK_AI_RESPONSE } from "@/prompts";

// Prompts are now centralized in @/prompts/index.ts

export async function POST(req: Request) {
  const body = await req.json();

  try {
    // Classify Text using Fallback Model
    const promptClassify = ChatPromptTemplate.fromTemplate(SENTIMENT_CLASSIFY);
    const formattedPromptClassify = await promptClassify.format({
      input: body.text,
    });
    const modelClassify = getChatModel(0.2);
    const textClassify = await modelClassify.invoke(formattedPromptClassify);

    // aiResponse feedback using Fallback Model
    const promptResponse =
      ChatPromptTemplate.fromTemplate(FEEDBACK_AI_RESPONSE);
    const formattedPromptResponse = await promptResponse.format({
      input: body.text,
    });
    const modelResponse = getChatModel(0.7);
    const textResponse = await modelResponse.invoke(formattedPromptResponse);

    // Handle Optional Embeddings
    const vectorData = await getEmbeddings(body.text);

    // Sanitize sentiment extraction
    let sentiment = (textClassify.content as string).toLowerCase().trim();
    if (sentiment.includes("positive")) sentiment = "positive";
    else if (sentiment.includes("negative")) sentiment = "negative";
    else if (sentiment.includes("neutral")) sentiment = "neutral";
    else sentiment = "neutral"; // Default to neutral if unsure

    // Save Feedback to Elasticsearch
    const feedbackData: any = {
      teamId: body.teamId,
      rate: body.rate,
      description: body.text,
      aiResponse: (textResponse.content as string).trim(),
      sentiment: sentiment,
      isResolved: false,
      customerName: body.customerName || null,
      customerEmail: body.customerEmail || null,
      customerPhone: body.customerPhone || null,
    };

    if (vectorData && vectorData[0]) {
      feedbackData.embedding = vectorData[0];
    }

    const feedbackStored = await createFeedback(feedbackData);

    /* OLD PRISMA CREATE
    const feedbackStored = await prisma.feedback.create({
      data: {
        teamId: body.teamId,
        rate: body.rate,
        description: body.text,
        aiResponse: (textResponse.content as String).trim(),
        sentiment: (textClassify.content as String).trim(),
      },
    });
    */

    // Split Text and handle tags (We'll skip manual tags for now or move them to a 'tags' index later)
    // For now, let's just keep the feedback collection simple as ES can handle keyword search easily
    /* OLD TAG LOGIC
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
    */

    /* OLD EMBEDDING CREATION (Relied on SQL raw update)
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
    */

    return NextResponse.json(
      { success: true, message: "Success send feedback", data: feedbackStored },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
