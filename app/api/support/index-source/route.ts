import { auth } from "@/auth";
import {
  generateId,
  getTeam,
  indexSupportKnowledgeDoc,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

function stripHtml(input: string) {
  return String(input || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text: string, size = 1200, overlap = 150) {
  const value = String(text || "").trim();
  if (!value) return [];
  if (value.length <= size) return [value];

  const chunks: string[] = [];
  let start = 0;
  while (start < value.length) {
    const end = Math.min(value.length, start + size);
    chunks.push(value.slice(start, end));
    if (end >= value.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

async function fetchUrlContent(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ZapfeedSupportIndexer/1.0",
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }
    const html = await response.text();
    return stripHtml(html);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = await req.json();
    const teamId = String(body?.teamId || "").trim();
    const rawSources = Array.isArray(body?.sources)
      ? body.sources
      : body?.source
        ? [body.source]
        : [];

    if (!teamId || rawSources.length === 0) {
      return NextResponse.json(
        { success: false, message: "Missing teamId or source payload." },
        { status: 400 },
      );
    }

    const team = await getTeam(teamId);
    if (!team) {
      return NextResponse.json(
        { success: false, message: "Team not found." },
        { status: 404 },
      );
    }

    let chunksIndexed = 0;
    const sourceSummaries: Array<{ sourceId: string; chunks: number }> = [];

    for (const source of rawSources) {
      const sourceId = generateId();
      const sourceUrl = String(source?.url || "").trim();
      const sourceTitle = String(source?.title || "").trim();
      const sourceType = sourceUrl ? "url" : "text";

      let content = String(source?.content || "").trim();
      if (!content && sourceUrl) {
        content = await fetchUrlContent(sourceUrl);
      }

      if (!content) {
        continue;
      }

      const chunks = chunkText(content);
      let localChunks = 0;
      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i];
        const title = sourceTitle || sourceUrl || `Knowledge source ${sourceId}`;

        await indexSupportKnowledgeDoc({
          teamId,
          sourceId,
          sourceType,
          title,
          url: sourceUrl || null,
          content: chunk,
          contentSnippet: chunk.slice(0, 220),
          chunk: i,
          embeddingText: `${title}\n${chunk}`,
        });

        chunksIndexed += 1;
        localChunks += 1;
      }

      sourceSummaries.push({ sourceId, chunks: localChunks });
    }

    if (chunksIndexed === 0) {
      return NextResponse.json(
        { success: false, message: "No content was indexed. Check URL/text input." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Knowledge source indexed successfully.",
      data: {
        chunksIndexed,
        sources: sourceSummaries,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to index source." },
      { status: 500 },
    );
  }
}
