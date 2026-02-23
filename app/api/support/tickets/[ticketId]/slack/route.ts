import { auth } from "@/auth";
import {
  createActionAuditLog,
  getSupportTicketById,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { ticketId: string } },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const ticketId = decodeURIComponent(params.ticketId);
  const ticket = await getSupportTicketById(ticketId);
  if (!ticket) {
    return NextResponse.json(
      { success: false, message: "Support ticket not found." },
      { status: 404 },
    );
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { success: false, message: "Missing SLACK_WEBHOOK_URL in environment." },
      { status: 400 },
    );
  }

  try {
    const payload = {
      text: `Zapfeed support escalation: ${ticket.subject}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Zapfeed Support Escalation*\n*${ticket.subject}*\nStatus: ${ticket.status} | Team: ${ticket.teamId}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Customer*\n${ticket.customerName} (${ticket.customerEmail})${ticket.customerPhone ? `\n${ticket.customerPhone}` : ""}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Description*\n${String(ticket.description || "").slice(0, 900)}`,
          },
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Slack webhook failed: ${response.status} ${text}`);
    }

    await createActionAuditLog({
      teamId: String(ticket.teamId),
      action: "support_ticket_send_slack",
      status: "success",
      detail: `ticket=${ticketId}`,
      actorEmail: session.user?.email || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Support ticket forwarded to Slack.",
    });
  } catch (error: any) {
    await createActionAuditLog({
      teamId: String(ticket.teamId),
      action: "support_ticket_send_slack",
      status: "failed",
      detail: error?.message || "Failed to send support ticket to Slack",
      actorEmail: session.user?.email || undefined,
    });

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to send ticket to Slack.",
      },
      { status: 500 },
    );
  }
}
