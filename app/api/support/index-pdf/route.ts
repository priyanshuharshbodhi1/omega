import { auth } from "@/auth";
import {
  generateId,
  getTeam,
  indexSupportKnowledgeDoc,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";
import pdfParse from "pdf-parse/lib/pdf-parse";

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

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const formData = await req.formData();
    const teamId = String(formData.get("teamId") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const file = formData.get("file") as File | null;

    if (!teamId || !file) {
      return NextResponse.json(
        { success: false, message: "Missing teamId or PDF file." },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { success: false, message: "Only PDF files are supported." },
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

    const bytes = await file.arrayBuffer();
    const parsed = await pdfParse(Buffer.from(bytes));
    const text = String(parsed?.text || "").replace(/\s+/g, " ").trim();
    if (!text) {
      return NextResponse.json(
        { success: false, message: "Could not extract text from PDF." },
        { status: 400 },
      );
    }

    const sourceId = generateId();
    const chunks = chunkText(text);
    let indexed = 0;
    const resolvedTitle = title || file.name || `PDF source ${sourceId}`;

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      await indexSupportKnowledgeDoc({
        teamId,
        sourceId,
        sourceType: "pdf",
        title: resolvedTitle,
        url: null,
        content: chunk,
        contentSnippet: chunk.slice(0, 220),
        chunk: i,
        embeddingText: `${resolvedTitle}\n${chunk}`,
      });
      indexed += 1;
    }

    return NextResponse.json({
      success: true,
      message: "PDF indexed successfully.",
      data: {
        sourceId,
        chunksIndexed: indexed,
        title: resolvedTitle,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to index PDF." },
      { status: 500 },
    );
  }
}
