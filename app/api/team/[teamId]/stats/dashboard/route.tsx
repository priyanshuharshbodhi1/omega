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

  const counts = await prisma.$transaction([
    prisma.feedback.count({
      where: {
        teamId: teamId,
      },
    }),
    prisma.feedback.count({
      where: {
        teamId: teamId,
        isResolved: false,
      },
    }),
    prisma.feedback.count({
      where: {
        teamId: teamId,
        isResolved: true,
      },
    }),
    prisma.feedback.aggregate({
      where: {
        teamId: teamId,
        rate: {
          not: null,
        },
      },
      _avg: {
        rate: true,
      },
    }),
  ]);

  const sentiment = await prisma.feedback.groupBy({
    by: ["sentiment"],
    where: {
      teamId: teamId,
    },
    _count: {
      sentiment: true,
    },
  });

  const data = {
    total: counts[0],
    open: counts[1],
    resolved: counts[2],
    ratingAverage: counts[3]?._avg?.rate,
    sentiment: sentiment.map((o) => ({ name: o.sentiment, count: o._count.sentiment, percentage: (o._count.sentiment / counts[0]) * 100 })),
  };

  return NextResponse.json({ success: true, message: "Success to get team", data: data });
}
