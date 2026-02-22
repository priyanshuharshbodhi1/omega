import { NextResponse } from "next/server";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createFeedback, runElasticCompletion } from "@/lib/elasticsearch";
import { getChatModel } from "@/lib/llm";
import { SENTIMENT_CLASSIFY, FEEDBACK_AI_RESPONSE } from "@/prompts";

// Prompts are now centralized in @/prompts/index.ts

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const promptClassify = ChatPromptTemplate.fromTemplate(SENTIMENT_CLASSIFY);
    const formattedPromptClassify = await promptClassify.format({
      input: body.text,
    });
    const promptResponse =
      ChatPromptTemplate.fromTemplate(FEEDBACK_AI_RESPONSE);
    const formattedPromptResponse = await promptResponse.format({
      input: body.text,
    });

    // Elastic-first path: run both inference requests in parallel.
    let [sentimentRaw, aiResponseRaw] = await Promise.all([
      runElasticCompletion(formattedPromptClassify),
      runElasticCompletion(formattedPromptResponse),
    ]);

    // Fallback model if completion endpoint is unavailable.
    if (!sentimentRaw || !aiResponseRaw) {
      const modelClassify = getChatModel(0.2);
      const modelResponse = getChatModel(0.7);
      const [textClassify, textResponse] = await Promise.all([
        modelClassify.invoke(formattedPromptClassify),
        modelResponse.invoke(formattedPromptResponse),
      ]);
      sentimentRaw = String(textClassify.content || "");
      aiResponseRaw = String(textResponse.content || "");
    }

    // Sanitize sentiment extraction
    let sentiment = sentimentRaw.toLowerCase().trim();
    if (sentiment.includes("positive")) sentiment = "positive";
    else if (sentiment.includes("negative")) sentiment = "negative";
    else if (sentiment.includes("neutral")) sentiment = "neutral";
    else sentiment = "neutral"; // Default to neutral if unsure

    // Save Feedback to Elasticsearch
    const feedbackData: any = {
      teamId: body.teamId,
      rate: body.rate,
      description: body.text,
      aiResponse: aiResponseRaw.trim(),
      sentiment: sentiment,
      isResolved: false,
      customerName: body.customerName || null,
      customerEmail: body.customerEmail || null,
      customerPhone: body.customerPhone || null,
    };

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
