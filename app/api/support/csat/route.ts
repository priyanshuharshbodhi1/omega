import {
  getSupportConversationMessageById,
  upsertSupportAnswerFeedback,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const teamId = String(body?.teamId || "").trim();
    const sessionId = String(body?.sessionId || "").trim();
    const assistantMessageId = String(body?.assistantMessageId || "").trim();
    const rating = String(body?.rating || "").trim() as "up" | "down";

    if (!teamId || !sessionId || !assistantMessageId) {
      return NextResponse.json(
        { success: false, message: "Missing teamId, sessionId, or assistantMessageId." },
        { status: 400 },
      );
    }

    if (!["up", "down"].includes(rating)) {
      return NextResponse.json(
        { success: false, message: "Invalid rating. Use 'up' or 'down'." },
        { status: 400 },
      );
    }

    const message = await getSupportConversationMessageById(assistantMessageId);
    if (!message) {
      return NextResponse.json(
        { success: false, message: "Assistant message not found." },
        { status: 404 },
      );
    }

    if (
      message.role !== "assistant" ||
      message.teamId !== teamId ||
      message.sessionId !== sessionId
    ) {
      return NextResponse.json(
        { success: false, message: "CSAT target message validation failed." },
        { status: 400 },
      );
    }

    await upsertSupportAnswerFeedback({
      teamId,
      sessionId,
      assistantMessageId,
      rating,
    });

    return NextResponse.json({
      success: true,
      data: {
        assistantMessageId,
        rating,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to record CSAT rating." },
      { status: 500 },
    );
  }
}
