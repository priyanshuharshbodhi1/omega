import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { esClient, runElasticCompletion } from "@/lib/elasticsearch";
import { getSummaryPrompt } from "@/prompts";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId")!;
  const sentiment = searchParams.get("sentiment");

  /* OLD TIDB CONNECTION
  const connection = connect({ url: process.env.DATABASE_URL });
  const adapter = new PrismaTiDBCloud(connection);
  const prisma = new PrismaClient({ adapter });
  */

  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  /* OLD PRISMA QUERY
  let data;
  if (searchParams.get("sentiment") === "all") {
    data = await prisma.feedback.findMany({
      select: {
        description: true,
      },
      where: {
        teamId: teamId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 40,
    });
  } else {
    data = await prisma.feedback.findMany({
      select: {
        description: true,
      },
      where: {
        teamId: teamId,
        sentiment: sentiment,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 40,
    });
  }
  */

  // New: Use Elasticsearch
  try {
    const query: any = {
      bool: {
        must: [{ term: { teamId: teamId } }],
      },
    };

    if (sentiment && sentiment !== "all") {
      query.bool.must.push({ term: { sentiment: sentiment } });
    }

    const [feedbackResult, supportResult] = await Promise.all([
      esClient.search({
        index: "feedback",
        query: query,
        sort: [{ createdAt: "desc" }],
        size: 40,
        _source: ["description", "createdAt", "sentiment"],
      }),
      esClient.search({
        index:
          process.env.ELASTIC_SUPPORT_CONVERSATIONS_INDEX || "support_conversations",
        query: {
          bool: {
            filter: [{ term: { teamId } }, { term: { role: "user" } }],
          },
        },
        sort: [{ createdAt: "desc" }],
        size: 30,
        _source: ["message", "createdAt"],
      }),
    ]);

    const feedbacks = feedbackResult.hits.hits.map((hit: any) => {
      const source = hit._source || {};
      return `- [feedback ${String(source.createdAt || "").split("T")[0] || "N/A"}] (${source.sentiment || "neutral"}) ${source.description}`;
    });
    const supportMessages = supportResult.hits.hits.map((hit: any) => {
      const source = hit._source || {};
      return `- [support ${String(source.createdAt || "").split("T")[0] || "N/A"}] ${source.message}`;
    });

    if (feedbacks.length === 0 && supportMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No data found",
        data: "No feedback or support-chat data available to summarize.",
      });
    }

    // Use Omega Strategic Analysis
    const { invokeAgent } = await import("@/lib/agent-builder");

    const agentId =
      process.env.ELASTIC_SUMMARY_AGENT_ID || "omega_summary_agent_v2";
    const strategicInstructions = getSummaryPrompt(
      sentiment || "all",
      feedbacks.join("\n"),
    );

    // Keep mode configurable so hackathon demos can run fully through Agent Builder.
    // Set ELASTIC_SUMMARY_MODE=fast for low-latency local fallback.
    const mode = (process.env.ELASTIC_SUMMARY_MODE || "deep").toLowerCase();

    try {
      if (mode === "deep") {
        const response = await invokeAgent({
          agentId,
          message: `${strategicInstructions}

Recent support chat evidence:
${supportMessages.join("\n") || "- none"}`,
        });
        const message =
          (response as any)?.response?.message ||
          (response as any)?.message ||
          "No summary returned by agent.";
        return NextResponse.json({
          success: true,
          message: "Strategic summary completed (Deep Mode)",
          data: message,
        });
      }

      const res = await runElasticCompletion(
        `${strategicInstructions}

Also include these support chat issues:
${supportMessages.join("\n") || "- none"}

Output as:
## Executive Summary
## Key Problems
## Recommended Actions
## Risks / Missing Data`,
      );

      return NextResponse.json({
        success: true,
        message: "Strategic summary completed",
        data: res || "No summary generated.",
      });
    } catch (error) {
      console.error("Omega Agent Error:", error);
      const res = await runElasticCompletion(
        `Summarize these customer insights for business:
Feedback:
${feedbacks.join("\n")}

Support chat:
${supportMessages.join("\n")}`,
      );
      return NextResponse.json({
        success: true,
        message: "Summary completed (Fallback)",
        data: res || "No summary generated.",
      });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
