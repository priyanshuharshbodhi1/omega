import { auth } from "@/auth";
import { getTeam, listSupportTickets } from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

const ALLOWED_SOURCES = new Set(["omega_escalation", "manual", "arya_dissatisfied"]);

export async function GET(
  req: Request,
  { params }: { params: { teamId: string } },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const teamId = params.teamId;
  const team = await getTeam(teamId);
  if (!team) {
    return NextResponse.json(
      { success: false, message: "Team not found" },
      { status: 404 },
    );
  }

  try {
    const requestUrl = new URL(req.url);
    const sourceParam = String(requestUrl.searchParams.get("source") || "")
      .trim()
      .toLowerCase();
    const source = ALLOWED_SOURCES.has(sourceParam)
      ? (sourceParam as "omega_escalation" | "manual" | "arya_dissatisfied")
      : undefined;

    const tickets = await listSupportTickets({ teamId, size: 200, source });
    return NextResponse.json({ success: true, data: tickets });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to fetch support tickets." },
      { status: 500 },
    );
  }
}
