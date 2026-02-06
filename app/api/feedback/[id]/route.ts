import { auth } from "@/auth";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PrismaClient } from "@prisma/client";
import { PrismaTiDBCloud } from "@tidbcloud/prisma-adapter";
import { connect } from "@tidbcloud/serverless";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  const connection = connect({ url: process.env.DATABASE_URL });
  const adapter = new PrismaTiDBCloud(connection);
  const prisma = new PrismaClient({ adapter });
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const feedback = await prisma.feedback.findUnique({
    where: {
      id: id,
    },
  });

  const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    dimensions: 1536,
  });
  const vectorData = await embeddings.embedDocuments([feedback?.description!]);

  const relateds = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, content, metadata, vec_cosine_distance(embedding, '[${vectorData}]') AS distance FROM EmbeddedDocument ORDER BY distance LIMIT 6`
  );

  return NextResponse.json({ success: true, message: "Success to get feedback", data: {...feedback, relateds} }, { status: 200 });
}
