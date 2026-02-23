import { auth } from "@/auth";
import { getTeam, listSupportTickets } from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

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
    const tickets = await listSupportTickets({ teamId, size: 200 });
    return NextResponse.json({ success: true, data: tickets });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to fetch support tickets." },
      { status: 500 },
    );
  }
}
