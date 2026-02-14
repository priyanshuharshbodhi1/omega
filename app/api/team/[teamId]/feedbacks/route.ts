import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { esClient, getTeam } from "@/lib/elasticsearch";

export async function GET(
  req: Request,
  { params }: { params: { teamId: string } },
) {
  const teamId = params.teamId;

  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  // Check if team exists (now in Elastic)
  const team = await getTeam(teamId);

  if (!team) {
    return NextResponse.json(
      { success: false, message: "Team not found" },
      { status: 404 },
    );
  }

  /* OLD PRISMA QUERY
  const feedbacks = await prisma.feedback.findMany({
    where: {
      teamId: teamId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  */

  // New: Search feedbacks in Elasticsearch
  try {
    const result = await esClient.search({
      index: "feedback",
      query: {
        term: { teamId: teamId },
      },
      sort: [{ createdAt: "desc" }],
      size: 100, // Limit to 100 for now
    });

    const feedbacks = result.hits.hits.map((hit) => ({
      id: hit._id,
      ...(hit._source as any),
    }));

    return NextResponse.json({
      success: true,
      message: "Success to get team",
      data: feedbacks,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
