import { auth } from "@/auth";
import { ChatOpenAI } from "@langchain/openai";
import { PrismaClient } from "@prisma/client";
import { PrismaTiDBCloud } from "@tidbcloud/prisma-adapter";
import { connect } from "@tidbcloud/serverless";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const connection = connect({ url: process.env.DATABASE_URL });
  const adapter = new PrismaTiDBCloud(connection);
  const prisma = new PrismaClient({ adapter });
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  let data;
  if (searchParams.get("sentiment") === "all") {
    data = await prisma.feedback.findMany({
      select: {
        description: true,
      },
      where: {
        teamId: searchParams.get("teamId")!,
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
        teamId: searchParams.get("teamId")!,
        sentiment: searchParams.get("sentiment"),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 40,
    });
  }

  const feedbacks = data.map((i) => "- " + i.description);

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.5,
  });
  const res = await model.invoke(`The following is a list of feedback from customers for my business. Help me to create a summary in one to two sentences. And then give the conclusion of the summary:${feedbacks.join("\n")}`);

  return NextResponse.json({ success: true, message: "Success to summarized data", data: res.content });
}
