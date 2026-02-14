import { auth } from "@/auth";
import { getChatModel } from "@/lib/llm";
import { NextResponse } from "next/server";
import { esClient } from "@/lib/elasticsearch";

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

    const model = getChatModel(0.5);
    const res = await model.invoke(
      `The following is a list of feedback from customers for my business. Help me to create a summary in one to two sentences. And then give the conclusion of the summary:${feedbacks.join("\n")}`,
    );

    return NextResponse.json({
      success: true,
      message: "Success to summarized data",
      data: res.content,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
