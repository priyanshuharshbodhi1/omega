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

    const result = await esClient.search({
      index: "feedback",
      query: query,
      sort: [{ createdAt: "desc" }],
      size: 40,
      _source: ["description"],
    });

    const feedbacks = result.hits.hits.map(
      (hit: any) => "- " + hit._source.description,
    );

    if (feedbacks.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No feedback found",
        data: "No feedback available to summarize.",
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
          message: strategicInstructions,
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

      const res = await runElasticCompletion(strategicInstructions);

      return NextResponse.json({
        success: true,
        message: "Strategic summary completed",
        data: res || "No summary generated.",
      });
    } catch (error) {
      console.error("Omega Agent Error:", error);
      const res = await runElasticCompletion(
        `Summarize these customer feedbacks for business: ${feedbacks.join("\n")}`,
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
