import { auth } from "@/auth";
import { getTeam, listIssueClusters } from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

type RouteParams = { teamId: string };

export async function GET(
  req: Request,
  { params }: { params: RouteParams | Promise<RouteParams> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { teamId } = await Promise.resolve(params);
  const team = await getTeam(teamId);
  if (!team) {
    return NextResponse.json(
      { success: false, message: "Team not found" },
      { status: 404 },
    );
  }

  try {
    const clusters = (await listIssueClusters(teamId, 60))
      .filter((cluster: any) => {
        const status = String(cluster?.status || "open");
        const clusterKey = String(cluster?.clusterKey || "");
        const count = Number(cluster?.count || 0);
        return status !== "closed" && clusterKey !== "other" && count > 0;
      })
      .slice(0, 30);

    return NextResponse.json({ success: true, data: clusters });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to fetch issue clusters." },
      { status: 500 },
    );
  }
}
