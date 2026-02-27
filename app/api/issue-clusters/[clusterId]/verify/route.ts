import { auth } from "@/auth";
import {
  createActionAuditLog,
  getIssueClusterById,
  updateIssueClusterStatus,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

type RouteParams = { clusterId: string };

export async function POST(
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

  const { clusterId: clusterIdParam } = await Promise.resolve(params);
  const clusterId = decodeURIComponent(clusterIdParam);
  const cluster = await getIssueClusterById(clusterId);
  if (!cluster) {
    return NextResponse.json(
      { success: false, message: "Issue cluster not found" },
      { status: 404 },
    );
  }

  try {
    await updateIssueClusterStatus({ clusterId, status: "verified" });
    await createActionAuditLog({
      teamId: String(cluster.teamId),
      clusterId,
      action: "verify_cluster",
      status: "success",
      detail: "Cluster verified by admin",
      actorEmail: session.user?.email || undefined,
    });

    return NextResponse.json({ success: true, message: "Cluster verified." });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to verify cluster." },
      { status: 500 },
    );
  }
}
