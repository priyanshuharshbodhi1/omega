import { createSupportTicket, getTeam } from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const teamId = String(body?.teamId || "").trim();
    const customerName = String(body?.customerName || "").trim();
    const customerEmail = String(body?.customerEmail || "").trim();
    const customerPhone = String(body?.customerPhone || "").trim();
    const subject = String(body?.subject || "").trim();
    const description = String(body?.description || "").trim();
    const sessionId = String(body?.sessionId || "").trim();
    const language = String(body?.language || "en").trim().toLowerCase();
    const attachmentName = String(body?.attachmentName || "").trim();
    const attachmentContentType = String(body?.attachmentContentType || "").trim();
    const attachmentDataUrl = String(body?.attachmentDataUrl || "").trim();

    if (!teamId || !customerName || !customerEmail || !subject || !description) {
      return NextResponse.json(
        { success: false, message: "Missing required fields." },
        { status: 400 },
      );
    }

    if (!EMAIL_REGEX.test(customerEmail)) {
      return NextResponse.json(
        { success: false, message: "Invalid email address." },
        { status: 400 },
      );
    }

    if (attachmentDataUrl && attachmentDataUrl.length > 2_000_000) {
      return NextResponse.json(
        { success: false, message: "Attachment is too large. Keep it under 2MB." },
        { status: 400 },
      );
    }

    const team = await getTeam(teamId);
    if (!team) {
      return NextResponse.json(
        { success: false, message: "Team not found." },
        { status: 404 },
      );
    }

    const ticket = await createSupportTicket({
      teamId,
      source: "arya_escalation",
      sessionId: sessionId || null,
      language,
      customerName,
      customerEmail,
      customerPhone: customerPhone || null,
      subject,
      description,
      attachmentName: attachmentName || null,
      attachmentContentType: attachmentContentType || null,
      attachmentDataUrl: attachmentDataUrl || null,
    });

    return NextResponse.json({
      success: true,
      message: "Support request submitted successfully.",
      data: {
        ticketId: ticket.id,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to submit support request." },
      { status: 500 },
    );
  }
}
