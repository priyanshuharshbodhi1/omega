import { auth } from "@/auth";
import {
  createActionAuditLog,
  getSupportTicketById,
  updateSupportTicketStatus,
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
  const body = await req.json().catch(() => ({}));
  const status = String(body?.status || "").trim() as
    | "open"
    | "in_progress"
    | "resolved";

  if (!["open", "in_progress", "resolved"].includes(status)) {
    return NextResponse.json(
      { success: false, message: "Invalid status." },
      { status: 400 },
    );
  }

  const ticket = await getSupportTicketById(ticketId);
  if (!ticket) {
    return NextResponse.json(
      { success: false, message: "Support ticket not found." },
      { status: 404 },
    );
  }

  try {
    await updateSupportTicketStatus({ ticketId, status });
    await createActionAuditLog({
      teamId: String(ticket.teamId),
      action: "support_ticket_status_update",
      status: "success",
      detail: `ticket=${ticketId}, status=${status}`,
      actorEmail: session.user?.email || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Support ticket status updated.",
      data: { ticketId, status },
    });
  } catch (error: any) {
    await createActionAuditLog({
      teamId: String(ticket.teamId),
      action: "support_ticket_status_update",
      status: "failed",
      detail: error?.message || "Failed to update support ticket status",
      actorEmail: session.user?.email || undefined,
    });

    return NextResponse.json(
      { success: false, message: error?.message || "Failed to update status." },
      { status: 500 },
    );
  }
}
