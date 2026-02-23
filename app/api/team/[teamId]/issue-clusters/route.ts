import { auth } from "@/auth";
import { getTeam, listIssueClusters } from "@/lib/elasticsearch";
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
    const clusters = await listIssueClusters(teamId, 30);
    return NextResponse.json({ success: true, data: clusters });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to fetch issue clusters." },
      { status: 500 },
    );
  }
}
