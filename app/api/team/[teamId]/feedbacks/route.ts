import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";
import { PrismaTiDBCloud } from "@tidbcloud/prisma-adapter";
import { connect } from "@tidbcloud/serverless";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: { teamId: string } }) {
  const teamId = params.teamId;

  const connection = connect({ url: process.env.DATABASE_URL });
  const adapter = new PrismaTiDBCloud(connection);
  const prisma = new PrismaClient({ adapter });
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const team = await prisma.team.findUnique({
    where: {
      id: teamId,
    },
  });

  if (!team) {
    return NextResponse.json({ success: false, message: "Team not found" }, { status: 404 });
  }

  const feedbacks = await prisma.feedback.findMany({
    where: {
      teamId: teamId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({ success: true, message: "Success to get team", data: feedbacks });
}
