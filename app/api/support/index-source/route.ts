import { auth } from "@/auth";
import {
  generateId,
  getTeam,
  indexSupportKnowledgeDoc,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

export const maxDuration = 300;

const FETCH_TIMEOUT_MS = 15000;
const DEFAULT_MAX_CRAWL_PAGES = 500;
const ASSET_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".ico",
  ".css",
  ".js",
  ".map",
  ".json",
  ".xml",
  ".txt",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".zip",
  ".gz",
  ".pdf",
  ".mp4",
  ".mp3",
] as const;

type IndexProgressPayload = {
  stage: "starting" | "crawling" | "indexing" | "complete";
  message: string;
  progressPct: number;
  pagesDiscovered: number;
  pagesCrawled: number;
  pagesIndexed: number;
  chunksIndexed: number;
};

type ProgressEmitter = (payload: IndexProgressPayload) => void;

type RawSourceInput = {
  url?: string;
  content?: string;
  name?: string;
  title?: string;
};

type CrawledPage = {
  url: string;
  title: string;
  content: string;
};

function clampProgress(value: number) {
  return Math.max(1, Math.min(100, Math.round(value)));
}

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

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

function decodeHtmlEntities(value: string) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .trim();
}

function extractHtmlTitle(html: string) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return "";
  return decodeHtmlEntities(match[1]).replace(/\s+/g, " ").trim();
}

function normalizePathname(pathname: string) {
  const compact = String(pathname || "/").replace(/\/{2,}/g, "/");
  if (!compact || compact === "/") return "/";
  return compact.endsWith("/") ? compact.slice(0, -1) : compact;
}

function resolveScopePath(pathname: string) {
  const normalized = normalizePathname(pathname);
  if (normalized === "/") return "/";
  const lastSegment = normalized.split("/").pop() || "";
  if (!lastSegment.includes(".")) return normalized;

  const cutAt = normalized.lastIndexOf("/");
  if (cutAt <= 0) return "/";
  return normalized.slice(0, cutAt);
}

function normalizeCrawlUrl(rawUrl: string, baseUrl?: string) {
  try {
    const parsed = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = normalizePathname(parsed.pathname);
    return parsed.toString();
  } catch {
    return null;
  }
}

function isAssetPath(pathname: string) {
  const lower = String(pathname || "").toLowerCase();
  return ASSET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isInScope(url: string, seed: URL, scopePath: string) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== seed.origin) return false;
    if (isAssetPath(parsed.pathname)) return false;

    const candidatePath = normalizePathname(parsed.pathname);
    if (scopePath === "/") return true;
    return (
      candidatePath === scopePath || candidatePath.startsWith(`${scopePath}/`)
    );
  } catch {
    return false;
  }
}

function extractLinksFromHtml(html: string, pageUrl: string) {
  const links = new Set<string>();
  const regex = /\bhref\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(String(html || "")))) {
    const href = String(match[1] || "").trim();
    if (!href) continue;
    if (href.startsWith("#")) continue;
    if (/^(mailto|tel|javascript|data):/i.test(href)) continue;

    const normalized = normalizeCrawlUrl(href, pageUrl);
    if (!normalized) continue;
    links.add(normalized);
  }

  return Array.from(links);
}

async function fetchPage(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "OmegaSupportIndexer/1.0",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const resolvedUrl = normalizeCrawlUrl(response.url) || normalizeCrawlUrl(url);
    const contentType = String(response.headers.get("content-type") || "");
    const raw = await response.text();

    if (!resolvedUrl) {
      return {
        url,
        title: "",
        content: "",
        links: [] as string[],
      };
    }

    const title = extractHtmlTitle(raw);
    const links = /text\/html|application\/xhtml\+xml/i.test(contentType)
      ? extractLinksFromHtml(raw, resolvedUrl)
      : [];
    const content =
      /text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)
        ? stripHtml(raw)
        : "";

    return {
      url: resolvedUrl,
      title,
      content,
      links,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function crawlWebsite(
  seedUrl: string,
  maxPages: number,
  onProgress?: (event: {
    pagesDiscovered: number;
    pagesCrawled: number;
    message: string;
  }) => void,
) {
  const seed = new URL(seedUrl);
  const scopePath = resolveScopePath(seed.pathname);
  const queue: string[] = [seedUrl];
  const discovered = new Set<string>(queue);
  const visited = new Set<string>();
  const pages: CrawledPage[] = [];
  const failedPages: string[] = [];

  while (queue.length > 0 && visited.size < maxPages) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    try {
      const fetched = await fetchPage(current);
      const currentUrl = normalizeCrawlUrl(fetched.url) || current;

      if (!isInScope(currentUrl, seed, scopePath)) {
        onProgress?.({
          pagesDiscovered: discovered.size,
          pagesCrawled: visited.size,
          message: `Skipped out-of-scope page ${currentUrl}`,
        });
        continue;
      }

      if (fetched.content) {
        pages.push({
          url: currentUrl,
          title: fetched.title,
          content: fetched.content,
        });
      }

      for (const link of fetched.links) {
        if (!isInScope(link, seed, scopePath)) continue;
        if (visited.has(link) || discovered.has(link)) continue;
        discovered.add(link);
        queue.push(link);
      }

      onProgress?.({
        pagesDiscovered: discovered.size,
        pagesCrawled: visited.size,
        message: `Crawled ${currentUrl}`,
      });
    } catch {
      failedPages.push(current);
      onProgress?.({
        pagesDiscovered: discovered.size,
        pagesCrawled: visited.size,
        message: `Skipped unreachable page ${current}`,
      });
    }
  }

  return {
    pages,
    pagesCrawled: visited.size,
    pagesDiscovered: discovered.size,
    failedPages,
    truncated: queue.length > 0,
  };
}

function toSSE(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

async function indexSources(params: {
  teamId: string;
  sources: RawSourceInput[];
  maxCrawlPages: number;
  emitProgress?: ProgressEmitter;
}) {
  const { teamId, sources, maxCrawlPages, emitProgress } = params;

  let chunksIndexed = 0;
  let pagesDiscovered = 0;
  let pagesCrawled = 0;
  let pagesIndexed = 0;

  const sourceSummaries: Array<{
    sourceId: string;
    name: string;
    chunks: number;
    pagesIndexed: number;
    pagesCrawled: number;
    pagesDiscovered: number;
    url: string | null;
    failedPages: number;
    truncated: boolean;
    sampleUrls: string[];
  }> = [];

  emitProgress?.({
    stage: "starting",
    message: "Starting indexing...",
    progressPct: 5,
    pagesDiscovered,
    pagesCrawled,
    pagesIndexed,
    chunksIndexed,
  });

  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    const source = sources[sourceIndex];
    const sourceId = generateId();
    const sourceUrl = String(source?.url || "").trim();
    const sourceName = String(source?.name || source?.title || "").trim();
    const inlineContent = String(source?.content || "").trim();

    if (!sourceName) {
      throw new Error("Source name is required.");
    }

    if (!sourceUrl && !inlineContent) {
      throw new Error("Source payload must include either a URL or text content.");
    }

    if (sourceUrl) {
      const normalizedSeed = normalizeCrawlUrl(sourceUrl);
      if (!normalizedSeed) {
        throw new Error(`Invalid URL: ${sourceUrl}`);
      }

      emitProgress?.({
        stage: "crawling",
        message: `Discovering routes from ${normalizedSeed}`,
        progressPct: 8,
        pagesDiscovered,
        pagesCrawled,
        pagesIndexed,
        chunksIndexed,
      });

      const crawlResult = await crawlWebsite(
        normalizedSeed,
        maxCrawlPages,
        (crawlProgress) => {
          const localPct =
            8 +
            Math.round(
              (Math.min(crawlProgress.pagesCrawled, crawlProgress.pagesDiscovered) /
                Math.max(crawlProgress.pagesDiscovered, 1)) *
                44,
            );
          emitProgress?.({
            stage: "crawling",
            message: crawlProgress.message,
            progressPct: clampProgress(Math.min(localPct, 52)),
            pagesDiscovered: pagesDiscovered + crawlProgress.pagesDiscovered,
            pagesCrawled: pagesCrawled + crawlProgress.pagesCrawled,
            pagesIndexed,
            chunksIndexed,
          });
        },
      );

      pagesDiscovered += crawlResult.pagesDiscovered;
      pagesCrawled += crawlResult.pagesCrawled;

      if (crawlResult.pages.length === 0) {
        continue;
      }

      let localChunks = 0;
      let localPagesIndexed = 0;
      const totalPagesToIndex = crawlResult.pages.length;
      const sampleUrls = crawlResult.pages.slice(0, 8).map((page) => page.url);

      for (let pageIdx = 0; pageIdx < crawlResult.pages.length; pageIdx += 1) {
        const page = crawlResult.pages[pageIdx];
        const pageChunks = chunkText(page.content);
        if (pageChunks.length === 0) continue;

        const pageTitle = page.title || page.url;
        const docTitle = `${sourceName} | ${pageTitle}`;

        for (let chunkIdx = 0; chunkIdx < pageChunks.length; chunkIdx += 1) {
          const chunk = pageChunks[chunkIdx];
          await indexSupportKnowledgeDoc({
            teamId,
            sourceId,
            sourceType: "website",
            title: docTitle,
            url: page.url,
            content: chunk,
            contentSnippet: chunk.slice(0, 220),
            chunk: chunkIdx,
            embeddingText: `${sourceName}\n${pageTitle}\n${chunk}`,
          });

          chunksIndexed += 1;
          localChunks += 1;
        }

        localPagesIndexed += 1;
        pagesIndexed += 1;
        const localPct = 55 + Math.round((localPagesIndexed / totalPagesToIndex) * 40);
        emitProgress?.({
          stage: "indexing",
          message: `Indexed page ${localPagesIndexed}/${totalPagesToIndex}: ${page.url}`,
          progressPct: clampProgress(Math.min(localPct, 95)),
          pagesDiscovered,
          pagesCrawled,
          pagesIndexed,
          chunksIndexed,
        });
      }

      sourceSummaries.push({
        sourceId,
        name: sourceName,
        chunks: localChunks,
        pagesIndexed: localPagesIndexed,
        pagesCrawled: crawlResult.pagesCrawled,
        pagesDiscovered: crawlResult.pagesDiscovered,
        url: normalizedSeed,
        failedPages: crawlResult.failedPages.length,
        truncated: crawlResult.truncated,
        sampleUrls,
      });
      continue;
    }

    const chunks = chunkText(inlineContent);
    if (chunks.length === 0) continue;

    let localChunks = 0;
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      await indexSupportKnowledgeDoc({
        teamId,
        sourceId,
        sourceType: "text",
        title: sourceName,
        url: null,
        content: chunk,
        contentSnippet: chunk.slice(0, 220),
        chunk: i,
        embeddingText: `${sourceName}\n${chunk}`,
      });
      localChunks += 1;
      chunksIndexed += 1;
      const localPct = 55 + Math.round(((i + 1) / chunks.length) * 40);
      emitProgress?.({
        stage: "indexing",
        message: `Indexed chunk ${i + 1}/${chunks.length}`,
        progressPct: clampProgress(Math.min(localPct, 95)),
        pagesDiscovered,
        pagesCrawled,
        pagesIndexed,
        chunksIndexed,
      });
    }

    sourceSummaries.push({
      sourceId,
      name: sourceName,
      chunks: localChunks,
      pagesIndexed: 0,
      pagesCrawled: 0,
      pagesDiscovered: 0,
      url: null,
      failedPages: 0,
      truncated: false,
      sampleUrls: [],
    });
  }

  if (chunksIndexed === 0) {
    throw new Error("No content was indexed. Check source URL/name input.");
  }

  const result = {
    chunksIndexed,
    pagesDiscovered,
    pagesCrawled,
    pagesIndexed,
    sources: sourceSummaries,
  };

  emitProgress?.({
    stage: "complete",
    message: "Indexing complete.",
    progressPct: 100,
    pagesDiscovered,
    pagesCrawled,
    pagesIndexed,
    chunksIndexed,
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

    const maxCrawlPages = parsePositiveInt(
      body?.maxPages,
      parsePositiveInt(process.env.SUPPORT_CRAWL_MAX_PAGES, DEFAULT_MAX_CRAWL_PAGES),
    );

    if (wantsStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const emitProgress: ProgressEmitter = (payload) => {
            controller.enqueue(encoder.encode(toSSE("progress", payload)));
          };

          void (async () => {
            try {
              const data = await indexSources({
                teamId,
                sources: rawSources,
                maxCrawlPages,
                emitProgress,
              });
              controller.enqueue(
                encoder.encode(toSSE("complete", { success: true, data })),
              );
            } catch (error: any) {
              controller.enqueue(
                encoder.encode(
                  toSSE("error", {
                    message: error?.message || "Failed to index source.",
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

    const data = await indexSources({
      teamId,
      sources: rawSources,
      maxCrawlPages,
    });

    return NextResponse.json({
      success: true,
      message: "Knowledge source indexed successfully.",
      data,
    });
  } catch (error: any) {
    const message = String(error?.message || "Failed to index source.");
    const status = /required|missing|invalid|no content/i.test(message) ? 400 : 500;
    return NextResponse.json(
      { success: false, message },
      { status },
    );
  }
}
