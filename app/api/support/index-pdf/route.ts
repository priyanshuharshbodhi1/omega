import { auth } from "@/auth";
import {
  generateId,
  getTeam,
  indexSupportKnowledgeDoc,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";
import pdfParse from "pdf-parse/lib/pdf-parse";

export const maxDuration = 300;

type PdfProgressPayload = {
  stage: "starting" | "extracting" | "indexing" | "complete";
  message: string;
  progressPct: number;
  chunksIndexed: number;
  chunksTotal: number;
  pdfPages: number;
};

type PdfProgressEmitter = (payload: PdfProgressPayload) => void;

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

function toSSE(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

async function indexPdfSource(params: {
  teamId: string;
  name: string;
  file: File;
  emitProgress?: PdfProgressEmitter;
}) {
  const { teamId, name, file, emitProgress } = params;

  emitProgress?.({
    stage: "starting",
    message: "Uploading and parsing PDF...",
    progressPct: 5,
    chunksIndexed: 0,
    chunksTotal: 0,
    pdfPages: 0,
  });

  const bytes = await file.arrayBuffer();
  const parsed = (await pdfParse(Buffer.from(bytes))) as {
    text?: string;
    numpages?: number;
  };
  const text = String(parsed?.text || "").replace(/\s+/g, " ").trim();
  const pdfPages = Number(parsed?.numpages || 0);

  if (!text) {
    throw new Error("Could not extract text from PDF.");
  }

  const sourceId = generateId();
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    throw new Error("No content was indexed from this PDF.");
  }

  emitProgress?.({
    stage: "extracting",
    message: `Extracted text from ${pdfPages || "?"} PDF page(s).`,
    progressPct: 18,
    chunksIndexed: 0,
    chunksTotal: chunks.length,
    pdfPages,
  });

  let indexed = 0;
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    await indexSupportKnowledgeDoc({
      teamId,
      sourceId,
      sourceType: "pdf",
      title: name,
      url: null,
      content: chunk,
      contentSnippet: chunk.slice(0, 220),
      chunk: i,
      embeddingText: `${name}\n${chunk}`,
    });
    indexed += 1;

    const pct = 20 + Math.round((indexed / chunks.length) * 75);
    emitProgress?.({
      stage: "indexing",
      message: `Indexed chunk ${indexed}/${chunks.length}`,
      progressPct: Math.min(95, pct),
      chunksIndexed: indexed,
      chunksTotal: chunks.length,
      pdfPages,
    });
  }

  const result = {
    sourceId,
    chunksIndexed: indexed,
    chunksTotal: chunks.length,
    title: name,
    pdfPages,
  };

  emitProgress?.({
    stage: "complete",
    message: "PDF indexing complete.",
    progressPct: 100,
    chunksIndexed: indexed,
    chunksTotal: chunks.length,
    pdfPages,
  });

  return result;
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
    const requestUrl = new URL(req.url);
    const wantsStream = requestUrl.searchParams.get("stream") === "1";

    const formData = await req.formData();
    const teamId = String(formData.get("teamId") || "").trim();
    const name = String(formData.get("name") || formData.get("title") || "").trim();
    const file = formData.get("file") as File | null;

    if (!teamId || !file || !name) {
      return NextResponse.json(
        { success: false, message: "Missing teamId, source name, or PDF file." },
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

    if (wantsStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const emitProgress: PdfProgressEmitter = (payload) => {
            controller.enqueue(encoder.encode(toSSE("progress", payload)));
          };

          void (async () => {
            try {
              const data = await indexPdfSource({
                teamId,
                name,
                file,
                emitProgress,
              });
              controller.enqueue(
                encoder.encode(toSSE("complete", { success: true, data })),
              );
            } catch (error: any) {
              controller.enqueue(
                encoder.encode(
                  toSSE("error", {
                    message: error?.message || "Failed to index PDF.",
                  }),
                ),
              );
            } finally {
              controller.close();
            }
          })();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const data = await indexPdfSource({
      teamId,
      name,
      file,
    });

    return NextResponse.json({
      success: true,
      message: "PDF indexed successfully.",
      data,
    });
  } catch (error: any) {
    const message = String(error?.message || "Failed to index PDF.");
    const status = /required|missing|invalid|no content|extract/i.test(message) ? 400 : 500;
    return NextResponse.json(
      { success: false, message },
      { status },
    );
  }
}
