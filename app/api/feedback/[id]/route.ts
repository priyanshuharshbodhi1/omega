import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  esClient,
  findRelatedFeedbackByVector,
  getElasticTextEmbedding,
} from "@/lib/elasticsearch";

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
    const fbResult = await esClient.get({
      index: "feedback",
      id: id,
    });
    const feedback = { id: fbResult._id, ...(fbResult._source as any) };

    let relateds: any[] = [];
    let queryVector: number[] | null = null;

    if (Array.isArray(feedback.embedding) && feedback.embedding.length > 0) {
      queryVector = feedback.embedding;
    } else if (feedback.description) {
      queryVector = await getElasticTextEmbedding(feedback.description);
    }

    if (queryVector) {
      relateds = await findRelatedFeedbackByVector({
        queryVector,
        teamId: feedback.teamId,
        excludeId: id,
        size: 6,
      });
    }

    // Fallback when vector similarity is unavailable.
    if (relateds.length === 0 && feedback.description) {
      const mustQueries: any[] = [
        {
          more_like_this: {
            fields: ["description"],
            like: feedback.description,
            min_term_freq: 1,
            max_query_terms: 25,
          },
        },
      ];

      if (feedback.teamId) {
        mustQueries.push({ term: { teamId: feedback.teamId } });
      }

      const relatedFallback = await esClient.search({
        index: "feedback",
        size: 6,
        query: {
          bool: {
            must: mustQueries,
            must_not: [{ ids: { values: [id] } }],
          },
        },
        _source: {
          excludes: ["embedding"],
        },
      });

      relateds = relatedFallback.hits.hits.map((hit) => ({
        id: hit._id,
        description: (hit._source as any).description,
        sentiment: (hit._source as any).sentiment || "neutral",
        rate: (hit._source as any).rate ?? null,
        createdAt: (hit._source as any).createdAt || null,
        teamId: (hit._source as any).teamId || null,
        score: hit._score ?? null,
        source: hit._source,
      }));
    }

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
