import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { runESQL } from "@/lib/elasticsearch";

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

  /* OLD PRISMA STATS
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
  */

  // New: Using ES|QL for efficient stats
  const esqlQuery = `
    FROM feedback
    | WHERE teamId == "${teamId}"
    | STATS 
        total = COUNT(*),
        open = COUNT(*) WHERE isResolved == false,
        resolved = COUNT(*) WHERE isResolved == true,
        avg_rate = AVG(rate)
  `;

  const sentimentEsql = `
    FROM feedback
    | WHERE teamId == "${teamId}"
    | STATS count = COUNT(*) BY sentiment
  `;

  try {
    const statsResult = await runESQL(esqlQuery);
    const sentimentResult = await runESQL(sentimentEsql);

    const stats = statsResult.values?.[0] || [0, 0, 0, null];
    const total = Number(stats[0]);

    // Map sentiment results to expected format
    const sentimentData = (sentimentResult.values || []).map((row: any) => {
      const sent = row[0];
      const count = Number(row[1]);
      return {
        name: sent,
        count: count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      };
    });

    const data = {
      total: total,
      open: Number(stats[1]),
      resolved: Number(stats[2]),
      ratingAverage: stats[3] !== null ? Number(stats[3]) : null,
      sentiment: sentimentData,
    };

    return NextResponse.json({
      success: true,
      message: "Success to get team",
      data: data,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
