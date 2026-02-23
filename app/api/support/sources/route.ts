import { auth } from "@/auth";
import { getTeam, listSupportKnowledgeSources } from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const teamId = String(url.searchParams.get("teamId") || "").trim();
  if (!teamId) {
    return NextResponse.json(
      { success: false, message: "Missing teamId" },
      { status: 400 },
    );
  }

  const team = await getTeam(teamId);
  if (!team) {
    return NextResponse.json(
      { success: false, message: "Team not found" },
      { status: 404 },
    );
  }

  try {
    const sources = await listSupportKnowledgeSources({ teamId });
    return NextResponse.json({ success: true, data: sources });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to fetch sources" },
      { status: 500 },
    );
  }
}
