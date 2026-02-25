import { auth } from "@/auth";
import {
  deleteSupportKnowledgeSource,
  getTeam,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  { params }: { params: { sourceId: string } },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const sourceId = decodeURIComponent(String(params?.sourceId || "")).trim();
  const url = new URL(req.url);
  const teamId = String(url.searchParams.get("teamId") || "").trim();

  if (!teamId || !sourceId) {
    return NextResponse.json(
      { success: false, message: "Missing teamId or sourceId." },
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

  try {
    const chunksDeleted = await deleteSupportKnowledgeSource({ teamId, sourceId });
    if (chunksDeleted <= 0) {
      return NextResponse.json(
        { success: false, message: "Source not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Source deleted successfully.",
      data: {
        sourceId,
        chunksDeleted,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to delete source." },
      { status: 500 },
    );
  }
}

