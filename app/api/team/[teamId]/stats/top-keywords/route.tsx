import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { esClient } from "@/lib/elasticsearch";

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

  /* OLD PRISMA QUERY
  const data = await prisma.feedbackTag.findMany({
    where: {
      teamId: teamId,
    },
    orderBy: {
      total: "desc",
    },
    take: 20,
  });

  const keywords = data.map((o) => ({ value: o.name, count: o.total }));
  */

  // New: Use Elasticsearch aggregations for dynamic keywords
  // Since we don't have a specific tags field indexed yet, we'll use sentiment as a proxy
  // or return an empty array for now to avoid errors, or use significant_terms on description if enabled.
  try {
    const result = await esClient.search({
      index: "feedback",
      query: { term: { teamId: teamId } },
      size: 0,
      aggs: {
        top_tags: {
          terms: { field: "sentiment", size: 20 },
        },
      },
    });

    const buckets = (result.aggregations?.top_tags as any)?.buckets || [];
    const keywords = buckets.map((b: any) => ({
      value: b.key,
      count: b.doc_count,
    }));

    return NextResponse.json({
      success: true,
      message: "Success to get team",
      data: keywords,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
