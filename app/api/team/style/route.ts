import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { esClient, getTeam } from "@/lib/elasticsearch";

export async function POST(req: Request) {
  const body = await req.json();

  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  /* OLD PRISMA QUERY
  const team = await prisma.team.findUnique({
    where: {
      id: body.teamId,
    },
  });
  */

  // New: Use Elasticsearch
  const team = await getTeam(body.teamId);

  if (!team) {
    return NextResponse.json(
      { success: false, message: "Team not found" },
      { status: 404 },
    );
  }

  /* OLD PRISMA UPDATE
  const updatedTeam = await prisma.team.update({
    where: {
      id: team.id,
    },
    data: {
      style: body.style,
    },
  });
  */

  // New: Update Team in Elasticsearch
  try {
    await esClient.update({
      index: "teams",
      id: body.teamId,
      doc: {
        style: body.style,
        updatedAt: new Date().toISOString(),
      },
      refresh: true,
    });

    const updatedTeam = { ...team, style: body.style };

    return NextResponse.json(
      { success: true, message: "Successfully updated", data: updatedTeam },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
