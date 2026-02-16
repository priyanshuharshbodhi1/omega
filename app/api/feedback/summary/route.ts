import { auth } from "@/auth";
import { getChatModel } from "@/lib/llm";
import { NextResponse } from "next/server";
import { esClient } from "@/lib/elasticsearch";
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

    const agentId = "omega_summarizer";
    const strategicInstructions = getSummaryPrompt(
      sentiment || "all",
      feedbacks.join("\n"),
    );

    // OPTIMIZATION: We provide a dual-mode strategy.
    // 'deep' uses the Elastic Agent Builder for full orchestration.
    // 'fast' uses the Direct Agent logic for ~3s low-latency response.
    const mode: string = "fast";

    try {
      if (mode === "deep") {
        const response = await invokeAgent({
          agentId,
          message: strategicInstructions,
        });
        return NextResponse.json({
          success: true,
          message: "Strategic summary completed (Deep Mode)",
          data: response.message,
        });
      }

      // Fast Agent Path: Matches Agent instructions but optimizes for speed
      const model = getChatModel(0.3); // Lower temperature for professional summaries
      const res = await model.invoke(strategicInstructions);

      return NextResponse.json({
        success: true,
        message: "Strategic summary completed",
        data: res.content,
      });
    } catch (error) {
      console.error("Omega Agent Error:", error);
      // Absolute fallback if everything fails
      const model = getChatModel(0.7);
      const res = await model.invoke(
        `Summarize these customer feedbacks for business: ${feedbacks.join("\n")}`,
      );
      return NextResponse.json({
        success: true,
        message: "Summary completed (Fallback)",
        data: res.content,
      });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
