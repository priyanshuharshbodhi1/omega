import { auth } from "@/auth";
import { OpenAIEmbeddings } from "@langchain/openai";
import { NextResponse } from "next/server";
import { esClient } from "@/lib/elasticsearch";

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = params.id;

  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  /* OLD PRISMA QUERY
  const feedback = await prisma.feedback.findUnique({
    where: {
      id: id,
    },
  });
  */

  try {
    // New: Get Feedback from Elasticsearch
    const fbResult = await esClient.get({
      index: "feedback",
      id: id,
    });
    const feedback = { id: fbResult._id, ...(fbResult._source as any) };

    // New: Use Elasticsearch kNN search for related feedbacks
    // The 'embedding' field is already stored in the document
    let relateds: any[] = [];

    if (feedback.embedding && feedback.embedding.length > 0) {
      const relatedResult = await esClient.search({
        index: "feedback",
        knn: {
          field: "embedding",
          query_vector: feedback.embedding,
          k: 6,
          num_candidates: 100,
          filter: {
            bool: {
              must_not: { term: { _id: id } }, // Exclude current feedback
            },
          },
        },
        _source: {
          excludes: ["embedding"], // Don't return the huge vector
        },
      });

      relateds = relatedResult.hits.hits.map((hit) => ({
        id: hit._id,
        content: (hit._source as any).description,
        metadata: hit._source,
        distance: hit._score, // Use score as a proxy for distance
      }));
    }

    /* OLD VECTOR SEARCH
    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
      dimensions: 1536,
    });
    const vectorData = await embeddings.embedDocuments([feedback?.description!]);

    const relateds = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, content, metadata, vec_cosine_distance(embedding, '[${vectorData}]') AS distance FROM EmbeddedDocument ORDER BY distance LIMIT 6`
    );
    */

    return NextResponse.json(
      {
        success: true,
        message: "Success to get feedback",
        data: { ...feedback, relateds },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
