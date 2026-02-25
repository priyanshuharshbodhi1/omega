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
  const supportAnswerFeedbackIndex =
    process.env.ELASTIC_SUPPORT_ANSWER_FEEDBACK_INDEX || "support_answer_feedback";

  try {
    const [
      statsResult,
      sentimentResult,
      support7d,
      docsSources,
      ticketsOpen,
      ticketsEscalated7d,
      csat7d,
    ] =
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
        esClient.search({
          index: supportTicketsIndex,
          size: 0,
          query: {
            bool: {
              filter: [
                { term: { teamId } },
                { range: { createdAt: { gte: "now-7d/d" } } },
                { exists: { field: "sessionId" } },
              ],
            },
          },
          aggs: {
            sessions: { cardinality: { field: "sessionId" } },
          },
        }).catch(() => ({ aggregations: { sessions: { value: 0 } } } as any)),
        esClient.search({
          index: supportAnswerFeedbackIndex,
          size: 0,
          query: {
            bool: {
              filter: [{ term: { teamId } }, { range: { updatedAt: { gte: "now-7d/d" } } }],
            },
          },
          aggs: {
            total: { value_count: { field: "rating" } },
            positive: { filter: { term: { rating: "up" } } },
          },
        }).catch(
          () =>
            ({
              aggregations: {
                total: { value: 0 },
                positive: { doc_count: 0 },
              },
            }) as any,
        ),
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

    const supportSessions7d = Number((support7d.aggregations as any)?.sessions?.value || 0);
    const escalatedSessions7d = Number(
      (ticketsEscalated7d.aggregations as any)?.sessions?.value || 0,
    );
    const resolvedWithoutEscalation7d = Math.max(
      supportSessions7d - escalatedSessions7d,
      0,
    );
    const resolutionRate7d =
      supportSessions7d > 0
        ? (resolvedWithoutEscalation7d / supportSessions7d) * 100
        : 0;

    const csatTotal7d = Number((csat7d.aggregations as any)?.total?.value || 0);
    const csatPositive7d = Number((csat7d.aggregations as any)?.positive?.doc_count || 0);
    const botCsatPositiveRate7d =
      csatTotal7d > 0 ? (csatPositive7d / csatTotal7d) * 100 : null;

    const data = {
      total: total,
      open: Number(stats[1]),
      resolved: Number(stats[2]),
      ratingAverage: stats[3] !== null ? Number(stats[3]) : null,
      sentiment: sentimentData,
      supportSessions7d,
      supportMessages7d: Number(
        (support7d.aggregations as any)?.user_messages?.doc_count || 0,
      ),
      knowledgeSources: Number((docsSources.aggregations as any)?.sources?.value || 0),
      openSupportTickets: Number((ticketsOpen as any)?.hits?.total?.value || 0),
      escalatedSessions7d,
      resolvedWithoutEscalation7d,
      resolutionRate7d: Math.round(resolutionRate7d * 10) / 10,
      botCsatPositiveRate7d:
        botCsatPositiveRate7d === null
          ? null
          : Math.round(botCsatPositiveRate7d * 10) / 10,
      botCsatResponses7d: csatTotal7d,
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
