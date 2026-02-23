import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { esClient, runESQL } from "@/lib/elasticsearch";

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

  const supportConversationsIndex =
    process.env.ELASTIC_SUPPORT_CONVERSATIONS_INDEX || "support_conversations";
  const supportDocsIndex = process.env.ELASTIC_SUPPORT_DOCS_INDEX || "support_docs";
  const supportTicketsIndex =
    process.env.ELASTIC_SUPPORT_TICKETS_INDEX || "support_tickets";

  try {
    const [statsResult, sentimentResult, support7d, docsSources, ticketsOpen] =
      await Promise.all([
        runESQL(esqlQuery),
        runESQL(sentimentEsql),
        esClient.search({
          index: supportConversationsIndex,
          size: 0,
          query: {
            bool: {
              filter: [
                { term: { teamId } },
                { range: { createdAt: { gte: "now-7d/d" } } },
              ],
            },
          },
          aggs: {
            sessions: { cardinality: { field: "sessionId" } },
            user_messages: {
              filter: {
                term: { role: "user" },
              },
            },
          },
        }),
        esClient.search({
          index: supportDocsIndex,
          size: 0,
          query: { term: { teamId } },
          aggs: {
            sources: { cardinality: { field: "sourceId" } },
          },
        }),
        esClient.search({
          index: supportTicketsIndex,
          size: 0,
          query: {
            bool: {
              filter: [{ term: { teamId } }, { term: { status: "open" } }],
            },
          },
        }).catch(() => ({ hits: { total: { value: 0 } } } as any)),
      ]);

    const stats = statsResult.values?.[0] || [0, 0, 0, null];
    const total = Number(stats[0]);

    // Map sentiment results to expected format
    // ES|QL returns columns as [count, sentiment] based on STATS order
    const sentimentData = (sentimentResult.values || []).map((row: any) => {
      const count = Number(row[0]);
      const sent = row[1];
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
      supportSessions7d: Number((support7d.aggregations as any)?.sessions?.value || 0),
      supportMessages7d: Number(
        (support7d.aggregations as any)?.user_messages?.doc_count || 0,
      ),
      knowledgeSources: Number((docsSources.aggregations as any)?.sources?.value || 0),
      openSupportTickets: Number((ticketsOpen as any)?.hits?.total?.value || 0),
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
