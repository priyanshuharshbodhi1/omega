"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants, Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/ui/info-tip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTeam } from "@/lib/store";
import { FileUp, Globe, Link, QrCode, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import toast from "react-hot-toast";

type IndexMode = "link" | "pdf";

type IndexProgress = {
  stage?: string;
  message?: string;
  progressPct?: number;
  pagesDiscovered?: number;
  pagesCrawled?: number;
  pagesIndexed?: number;
  chunksIndexed?: number;
  chunksTotal?: number;
  pdfPages?: number;
};

function parseSSEBlock(rawBlock: string) {
  const lines = String(rawBlock || "").split("\n");
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return null;

  const payloadText = dataLines.join("\n");
  try {
    return {
      eventName,
      payload: JSON.parse(payloadText),
    };
  } catch {
    return {
      eventName,
      payload: payloadText,
    };
  }
}

async function consumeSSE(
  response: Response,
  onProgress: (payload: IndexProgress) => void,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming not available in this browser.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let completion: any = null;
  let streamError: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
    let boundary = buffer.indexOf("\n\n");

    while (boundary !== -1) {
      const rawBlock = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      if (!rawBlock) continue;
      const parsed = parseSSEBlock(rawBlock);
      if (!parsed) continue;

      if (parsed.eventName === "progress") {
        onProgress((parsed.payload || {}) as IndexProgress);
      } else if (parsed.eventName === "complete") {
        completion = parsed.payload;
      } else if (parsed.eventName === "error") {
        const payload = parsed.payload as { message?: string };
        streamError = payload?.message || "Indexing failed.";
      }
    }
  }

  if (streamError) {
    throw new Error(streamError);
  }

  if (!completion) {
    throw new Error("Indexing finished without completion response.");
  }

  return completion;
}

export default function Dashboard() {
  const [link, setLink] = useState("");
  const [snippet, setSnippet] = useState("");
  const [copied, setCopied] = useState<"link" | "snippet" | "qr" | null>(null);

  const [indexMode, setIndexMode] = useState<IndexMode>("link");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfInputKey, setPdfInputKey] = useState(0);
  const [indexedSources, setIndexedSources] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [progressMeta, setProgressMeta] = useState<IndexProgress | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const team = useTeam((state) => state.team);

  const mode = useMemo(() => team?.style?.widget_mode || "feedback", [team]);

  const loadSources = useCallback(async () => {
    if (!team?.id) return;
    try {
      const response = await fetch(`/api/support/sources?teamId=${team.id}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setIndexedSources(data.data || []);
        return;
      }
      toast.error(data?.message || "Failed to load indexed sources.");
    } catch {
      toast.error("Failed to load indexed sources.");
    }
  }, [team?.id]);

  useEffect(() => {
    if (team) {
      setLink(`${process.env.NEXT_PUBLIC_BASE_URL}/collect/${team?.id}?mode=${mode}`);
      setSnippet(
        `<script src="${process.env.NEXT_PUBLIC_BASE_URL}/omega.js" omega-id="${team?.id}" omega-mode="${mode}"></script>`,
      );
      loadSources();
    }
  }, [team, mode, loadSources]);

  const handleCopy = async (value: string, key: "link" | "snippet" | "qr") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  const resetProgress = () => {
    setProgress(0);
    setProgressLabel("");
    setProgressMeta(null);
  };

  const applyProgress = useCallback((payload: IndexProgress) => {
    if (typeof payload.progressPct === "number") {
      const bounded = Math.max(1, Math.min(100, Math.round(payload.progressPct)));
      setProgress(bounded);
    }
    if (payload.message) {
      setProgressLabel(payload.message);
    }
    setProgressMeta((prev) => ({
      ...(prev || {}),
      ...payload,
    }));
  }, []);

  const parseErrorMessage = async (response: Response, fallback: string) => {
    try {
      const data = await response.json();
      return String(data?.message || fallback);
    } catch {
      return fallback;
    }
  };

  const handleIndexUrl = async () => {
    if (!team?.id) {
      toast.error("Team not found.");
      return;
    }
    if (!sourceName.trim()) {
      toast.error("Source name is required.");
      return;
    }
    if (!sourceUrl.trim()) {
      toast.error("Add a source URL first.");
      return;
    }

    setIsIndexing(true);
    setProgress(5);
    setProgressLabel("Starting website crawl...");
    setProgressMeta({
      pagesDiscovered: 0,
      pagesCrawled: 0,
      pagesIndexed: 0,
      chunksIndexed: 0,
    });

    try {
      const response = await fetch("/api/support/index-source?stream=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          source: {
            url: sourceUrl.trim(),
            name: sourceName.trim(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response, "Failed to index link"));
      }

      const contentType = String(response.headers.get("content-type") || "");
      let data: any = null;

      if (contentType.includes("text/event-stream")) {
        const completion = await consumeSSE(response, applyProgress);
        data = completion?.data || completion;
      } else {
        const payload = await response.json();
        if (!payload?.success) {
          throw new Error(payload?.message || "Failed to index link");
        }
        data = payload?.data;
      }

      setProgress(100);
      setProgressLabel("Indexing complete.");
      toast.success(
        `Indexed ${data?.pagesIndexed || 0} page(s) and ${data?.chunksIndexed || 0} chunk(s).`,
      );
      const truncatedSources = Array.isArray(data?.sources)
        ? data.sources.filter((source: any) => Boolean(source?.truncated))
        : [];
      if (truncatedSources.length > 0) {
        toast(
          "Crawl limit reached before finishing every route. Increase SUPPORT_CRAWL_MAX_PAGES if needed.",
        );
      }
      setSourceUrl("");
      setSourceName("");
      await loadSources();
    } catch (error: any) {
      toast.error(error?.message || "Failed to index link");
    } finally {
      setTimeout(() => {
        resetProgress();
      }, 1200);
      setIsIndexing(false);
    }
  };

  const handleIndexPdf = async () => {
    if (!team?.id) {
      toast.error("Team not found.");
      return;
    }
    if (!sourceName.trim()) {
      toast.error("Source name is required.");
      return;
    }
    if (!pdfFile) {
      toast.error("Select a PDF file first.");
      return;
    }

    setIsIndexing(true);
    setProgress(5);
    setProgressLabel("Uploading and parsing PDF...");
    setProgressMeta({
      chunksIndexed: 0,
      chunksTotal: 0,
      pdfPages: 0,
    });

    try {
      const formData = new FormData();
      formData.append("teamId", team.id);
      formData.append("name", sourceName.trim());
      formData.append("file", pdfFile);

      const response = await fetch("/api/support/index-pdf?stream=1", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response, "Failed to index PDF"));
      }

      const contentType = String(response.headers.get("content-type") || "");
      let data: any = null;

      if (contentType.includes("text/event-stream")) {
        const completion = await consumeSSE(response, applyProgress);
        data = completion?.data || completion;
      } else {
        const payload = await response.json();
        if (!payload?.success) {
          throw new Error(payload?.message || "Failed to index PDF");
        }
        data = payload?.data;
      }

      setProgress(100);
      setProgressLabel("Indexing complete.");
      toast.success(
        `Indexed ${data?.chunksIndexed || 0} chunk(s) from ${data?.pdfPages || "?"} PDF page(s).`,
      );
      setPdfFile(null);
      setPdfInputKey((prev) => prev + 1);
      setSourceName("");
      await loadSources();
    } catch (error: any) {
      toast.error(error?.message || "Failed to index PDF");
    } finally {
      setTimeout(() => {
        resetProgress();
      }, 1200);
      setIsIndexing(false);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!team?.id || !sourceId) return;

    const confirmed = window.confirm(
      "Delete this source? Omega will stop using it for future answers.",
    );
    if (!confirmed) return;

    setDeletingSourceId(sourceId);
    try {
      const response = await fetch(
        `/api/support/sources/${encodeURIComponent(sourceId)}?teamId=${encodeURIComponent(team.id)}`,
        {
          method: "DELETE",
        },
      );
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to delete source");
      }

      setIndexedSources((prev) =>
        prev.filter((item) => String(item?.sourceId) !== String(sourceId)),
      );
      toast.success(
        `Deleted source (${Number(data?.data?.chunksDeleted || 0)} chunk(s) removed).`,
      );
      await loadSources();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete source");
    } finally {
      setDeletingSourceId(null);
    }
  };

  return (
    <>
      <div className="mx-auto w-full max-w-6xl mt-10 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 justify-center">
          <div className="w-full bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl p-6 shadow-[0_12px_30px_rgba(55,40,25,0.12)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center">
                <QrCode className="size-5" />
              </div>
              <div className="flex items-center gap-2">
                <h5 className="text-[11px] font-bold uppercase tracking-widest text-violet-600">
                  QR Code
                </h5>
                <InfoTip text="Share this QR to open the currently selected widget mode instantly." />
              </div>
            </div>
            <p className="text-sm text-[#1F1A15] mb-4">
              Download & share QR code to open your current widget mode.
            </p>
            <AlertDialog>
              <AlertDialogTrigger className={buttonVariants({ variant: "dark", size: "sm" })}>
                Connect
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-lg rounded-2xl border border-[#D2C4B3] bg-[#FFFDF7] p-0 shadow-[0_20px_60px_rgba(30,20,10,0.25)]">
                <div className="px-6 pt-6 pb-4 border-b border-[#D2C4B3]">
                  <h3 className="text-lg font-semibold text-[#1F1A15]">QR Code</h3>
                  <p className="text-xs text-[#4B3F35] mt-1">Scan or share your widget link quickly.</p>
                </div>
                <div className="px-6 py-5">
                  <div className="mx-auto w-44 rounded-xl bg-[#FFFDF7] p-3 shadow-sm border border-[#D2C4B3]">
                    <QRCode size={176} style={{ height: "auto", maxWidth: "100%", width: "100%" }} value={link} viewBox={`0 0 256 256`} />
                  </div>
                </div>
                <div className="px-6 pb-6 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => handleCopy(link, "qr")} className="h-9 px-4 rounded-full border border-[#D9CDBA] text-[#1F1A15] text-xs font-semibold uppercase tracking-widest hover:bg-[#E6D8C6]">
                    {copied === "qr" ? "Copied" : "Copy Link"}
                  </button>
                  <AlertDialogCancel className="h-9 px-4 rounded-full border border-[#D9CDBA] text-[#1F1A15] hover:bg-[#E6D8C6]">Close</AlertDialogCancel>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="w-full bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl p-6 shadow-[0_12px_30px_rgba(55,40,25,0.12)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center">
                <Link className="size-5" />
              </div>
              <div className="flex items-center gap-2">
                <h5 className="text-[11px] font-bold uppercase tracking-widest text-violet-600">Quick Link</h5>
                <InfoTip text="Direct URL to launch your current widget mode." />
              </div>
            </div>
            <p className="text-sm text-[#1F1A15] mb-4">Share a quick link for your selected widget mode.</p>
            <AlertDialog>
              <AlertDialogTrigger className={buttonVariants({ variant: "dark", size: "sm" })}>
                Connect
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-lg rounded-2xl border border-[#D2C4B3] bg-[#FFFDF7] p-0 shadow-[0_20px_60px_rgba(30,20,10,0.25)]">
                <div className="px-6 pt-6 pb-4 border-b border-[#D2C4B3]">
                  <h3 className="text-lg font-semibold text-[#1F1A15]">Quick Link</h3>
                  <p className="text-xs text-[#4B3F35] mt-1">Direct URL to launch your current widget mode.</p>
                </div>
                <div className="px-6 py-5">
                  <Input value={link} readOnly className="h-11 rounded-full border-[#D9CDBA] bg-[#FFFDF7] px-4" />
                </div>
                <div className="px-6 pb-6 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => handleCopy(link, "link")} className="h-9 px-4 rounded-full border border-[#D9CDBA] text-[#1F1A15] text-xs font-semibold uppercase tracking-widest hover:bg-[#E6D8C6]">
                    {copied === "link" ? "Copied" : "Copy Link"}
                  </button>
                  <AlertDialogCancel className="h-9 px-4 rounded-full border border-[#D9CDBA] text-[#1F1A15] hover:bg-[#E6D8C6]">Close</AlertDialogCancel>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="w-full bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl p-6 shadow-[0_12px_30px_rgba(55,40,25,0.12)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center">
                <Globe className="size-5" />
              </div>
              <div className="flex items-center gap-2">
                <h5 className="text-[11px] font-bold uppercase tracking-widest text-violet-600">Website</h5>
                <InfoTip text="Embed this script in your website to load the Omega widget." />
              </div>
            </div>
            <p className="text-sm text-[#1F1A15] mb-4">Embed mode-aware widget on your website.</p>
            <AlertDialog>
              <AlertDialogTrigger className={buttonVariants({ variant: "dark", size: "sm" })}>
                Connect
              </AlertDialogTrigger>
              <AlertDialogContent className="w-full max-w-lg rounded-2xl border border-[#D2C4B3] bg-[#FFFDF7] p-0 shadow-[0_20px_60px_rgba(30,20,10,0.25)]">
                <div className="px-6 pt-6 pb-4 border-b border-[#D2C4B3]">
                  <h3 className="text-lg font-semibold text-[#1F1A15]">Website Widget Snippet</h3>
                  <p className="text-xs text-[#4B3F35] mt-1">Embed this script in your website to load the Omega widget.</p>
                </div>
                <div className="px-6 py-5">
                  <textarea value={snippet} readOnly rows={4} className="w-full rounded-xl border border-[#D9CDBA] bg-[#FFFDF7] px-4 py-3 text-xs text-[#1F1A15]" />
                </div>
                <div className="px-6 pb-6 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => handleCopy(snippet, "snippet")} className="h-9 px-4 rounded-full border border-[#D9CDBA] text-[#1F1A15] text-xs font-semibold uppercase tracking-widest hover:bg-[#E6D8C6]">
                    {copied === "snippet" ? "Copied" : "Copy Script"}
                  </button>
                  <AlertDialogCancel className="h-9 px-4 rounded-full border border-[#D9CDBA] text-[#1F1A15] hover:bg-[#E6D8C6]">Close</AlertDialogCancel>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl p-6 shadow-[0_12px_30px_rgba(55,40,25,0.12)] space-y-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35] flex items-center gap-2">
                Omega Knowledge Hub
                <InfoTip text="Index docs/links/PDFs here. Omega cites these sources when answering users." />
              </div>
              <h3 className="text-lg font-semibold text-[#1F1A15] mt-1">Index Links and PDFs</h3>
              <p className="text-xs text-[#4B3F35] mt-1">
                For docs links, Omega crawls internal routes and indexes each page with citations.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#4B3F35]">Source Name *</label>
              <Input
                placeholder="Slack Docs"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
              />
            </div>

            <Tabs
              value={indexMode}
              onValueChange={(value) => setIndexMode(value as IndexMode)}
              className="space-y-3"
            >
              <TabsList className="grid grid-cols-2 rounded-full bg-[#F4EBDE] p-1">
                <TabsTrigger value="link" className="text-xs uppercase tracking-widest">
                  Link
                </TabsTrigger>
                <TabsTrigger value="pdf" className="text-xs uppercase tracking-widest">
                  PDF
                </TabsTrigger>
              </TabsList>

              <TabsContent value="link" className="mt-0">
                <div className="space-y-2 rounded-xl border border-[#D2C4B3] p-3">
                  <label className="text-xs font-semibold text-[#4B3F35]">Index Website/Link</label>
                  <Input
                    placeholder="https://docs.yourapp.com/..."
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                  />
                  <Button
                    variant="dark"
                    size="sm"
                    disabled={isIndexing || !sourceName.trim() || !sourceUrl.trim()}
                    onClick={handleIndexUrl}
                  >
                    Index Link
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="pdf" className="mt-0">
                <div className="space-y-2 rounded-xl border border-[#D2C4B3] p-3">
                  <label className="text-xs font-semibold text-[#4B3F35]">Index PDF</label>
                  <Input
                    key={pdfInputKey}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  />
                  <Button
                    variant="dark"
                    size="sm"
                    disabled={isIndexing || !sourceName.trim() || !pdfFile}
                    onClick={handleIndexPdf}
                  >
                    <FileUp className="w-4 h-4 mr-1" /> Index PDF
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {progress > 0 ? (
              <div className="space-y-2 rounded-xl border border-[#D2C4B3] bg-[#FAF2E8] p-3">
                <div className="flex justify-between text-xs text-[#4B3F35]">
                  <span>{progressLabel}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#E6D8C6] overflow-hidden">
                  <div className="h-full bg-[#2D6A4F] transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#4B3F35]">
                  <div>Pages discovered: {progressMeta?.pagesDiscovered || 0}</div>
                  <div>Pages crawled: {progressMeta?.pagesCrawled || 0}</div>
                  <div>Pages indexed: {progressMeta?.pagesIndexed || 0}</div>
                  <div>
                    Chunks indexed: {progressMeta?.chunksIndexed || 0}
                    {typeof progressMeta?.chunksTotal === "number" && progressMeta.chunksTotal > 0
                      ? ` / ${progressMeta.chunksTotal}`
                      : ""}
                  </div>
                  {typeof progressMeta?.pdfPages === "number" && progressMeta.pdfPages > 0 ? (
                    <div>PDF pages parsed: {progressMeta.pdfPages}</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl p-6 shadow-[0_12px_30px_rgba(55,40,25,0.12)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35] flex items-center gap-2">
                  Indexed Sources
                  <InfoTip text="Knowledge sources currently indexed for this team and used by Omega retrieval." />
                </div>
                <h3 className="text-lg font-semibold text-[#1F1A15] mt-1">What Omega currently knows</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="dark" size="sm" onClick={loadSources}>Refresh</Button>
                <InfoTip text="Sync the latest indexed knowledge sources from the server." />
              </div>
            </div>

            {indexedSources.length === 0 ? (
              <p className="text-sm text-[#4B3F35]">No indexed sources yet.</p>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {indexedSources.map((item) => (
                  <div key={item.sourceId} className="rounded-xl border border-[#D2C4B3] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-[#1F1A15]">{item.title}</div>
                      <button
                        type="button"
                        disabled={deletingSourceId === item.sourceId}
                        onClick={() => handleDeleteSource(String(item.sourceId))}
                        className="h-7 min-w-7 px-2 rounded-md border border-[#E0B8B8] text-[#9B3030] hover:bg-[#F9E8E8] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center"
                        aria-label={`Delete source ${item.title || item.sourceId}`}
                        title="Delete source"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-xs text-[#4B3F35] mt-1">
                      Type: {item.sourceType} · Pages: {item.pages || 0} · Chunks: {item.chunks} · Updated: {String(item.updatedAt || "").split("T")[0] || "N/A"}
                    </div>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer" className="text-xs underline text-[#2D6A4F] mt-1 inline-block">
                        {item.url}
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
