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
import { useTeam } from "@/lib/store";
import { FileUp, Globe, Link, QrCode } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import toast from "react-hot-toast";

export default function Dashboard() {
  const [link, setLink] = useState("");
  const [snippet, setSnippet] = useState("");
  const [copied, setCopied] = useState<"link" | "snippet" | "qr" | null>(null);

  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [indexedSources, setIndexedSources] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [isIndexing, setIsIndexing] = useState(false);
  const team = useTeam((state) => state.team);

  const mode = useMemo(() => team?.style?.widget_mode || "feedback", [team]);

  const loadSources = useCallback(async () => {
    if (!team?.id) return;
    try {
      const response = await fetch(`/api/support/sources?teamId=${team.id}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setIndexedSources(data.data || []);
      }
    } catch {}
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

  const startProgressSimulation = (label: string) => {
    setProgressLabel(label);
    setProgress(5);
    let pct = 5;
    const id = setInterval(() => {
      pct = Math.min(92, pct + Math.ceil(Math.random() * 9));
      setProgress(pct);
    }, 300);
    return id;
  };

  const handleIndexUrl = async () => {
    if (!team?.id || !sourceUrl.trim()) {
      toast.error("Add a source URL first.");
      return;
    }

    setIsIndexing(true);
    const timer = startProgressSimulation("Indexing link...");
    try {
      const response = await fetch("/api/support/index-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          source: {
            url: sourceUrl.trim(),
            title: sourceTitle.trim() || undefined,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to index link");
      }

      setProgress(100);
      toast.success(`Indexed ${data.data?.chunksIndexed || 0} chunk(s).`);
      setSourceUrl("");
      setSourceTitle("");
      await loadSources();
    } catch (error: any) {
      toast.error(error?.message || "Failed to index link");
    } finally {
      clearInterval(timer);
      setTimeout(() => {
        setProgress(0);
        setProgressLabel("");
      }, 800);
      setIsIndexing(false);
    }
  };

  const handleIndexPdf = async () => {
    if (!team?.id || !pdfFile) {
      toast.error("Select a PDF file first.");
      return;
    }

    setIsIndexing(true);
    const timer = startProgressSimulation("Indexing PDF...");
    try {
      const formData = new FormData();
      formData.append("teamId", team.id);
      formData.append("title", sourceTitle.trim());
      formData.append("file", pdfFile);

      const response = await fetch("/api/support/index-pdf", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to index PDF");
      }

      setProgress(100);
      toast.success(`Indexed ${data.data?.chunksIndexed || 0} chunk(s) from PDF.`);
      setPdfFile(null);
      setSourceTitle("");
      await loadSources();
    } catch (error: any) {
      toast.error(error?.message || "Failed to index PDF");
    } finally {
      clearInterval(timer);
      setTimeout(() => {
        setProgress(0);
        setProgressLabel("");
      }, 800);
      setIsIndexing(false);
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
            <Input value={link} readOnly className="h-11 rounded-full border-[#D9CDBA] bg-[#FFFDF7] px-4 mb-3" />
            <Button variant="dark" size="sm" onClick={() => handleCopy(link, "link")}>{copied === "link" ? "Copied" : "Copy Link"}</Button>
          </div>

          <div className="w-full bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl p-6 shadow-[0_12px_30px_rgba(55,40,25,0.12)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center">
                <Globe className="size-5" />
              </div>
              <div className="flex items-center gap-2">
                <h5 className="text-[11px] font-bold uppercase tracking-widest text-violet-600">Website</h5>
                <InfoTip text="Embed this script in your website to load the Zapfeed widget." />
              </div>
            </div>
            <p className="text-sm text-[#1F1A15] mb-4">Embed mode-aware widget on your website.</p>
            <textarea value={snippet} readOnly rows={3} className="w-full rounded-xl border border-[#D9CDBA] bg-[#FFFDF7] px-4 py-3 text-xs text-[#1F1A15] mb-3" />
            <Button variant="dark" size="sm" onClick={() => handleCopy(snippet, "snippet")}>{copied === "snippet" ? "Copied" : "Copy Script"}</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl p-6 shadow-[0_12px_30px_rgba(55,40,25,0.12)] space-y-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35] flex items-center gap-2">
                Arya Knowledge Hub
                <InfoTip text="Index docs/links/PDFs here. Arya cites these sources when answering users." />
              </div>
              <h3 className="text-lg font-semibold text-[#1F1A15] mt-1">Index Links and PDFs</h3>
              <p className="text-xs text-[#4B3F35] mt-1">Arya answers from these indexed sources with citations.</p>
            </div>

            <Input placeholder="Optional source title" value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)} />

            <div className="space-y-2 rounded-xl border border-[#D2C4B3] p-3">
              <label className="text-xs font-semibold text-[#4B3F35]">Index Website/Link</label>
              <Input placeholder="https://docs.yourapp.com/..." value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
              <Button variant="dark" size="sm" disabled={isIndexing} onClick={handleIndexUrl}>Index Link</Button>
            </div>

            <div className="space-y-2 rounded-xl border border-[#D2C4B3] p-3">
              <label className="text-xs font-semibold text-[#4B3F35]">Index PDF</label>
              <Input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
              <Button variant="dark" size="sm" disabled={isIndexing} onClick={handleIndexPdf}>
                <FileUp className="w-4 h-4 mr-1" /> Index PDF
              </Button>
            </div>

            {progress > 0 ? (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-[#4B3F35]">
                  <span>{progressLabel}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#E6D8C6] overflow-hidden">
                  <div className="h-full bg-[#2D6A4F] transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : null}
          </div>

          <div className="bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl p-6 shadow-[0_12px_30px_rgba(55,40,25,0.12)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35] flex items-center gap-2">
                  Indexed Sources
                  <InfoTip text="Knowledge sources currently indexed for this team and used by Arya retrieval." />
                </div>
                <h3 className="text-lg font-semibold text-[#1F1A15] mt-1">What Arya currently knows</h3>
              </div>
              <Button variant="dark" size="sm" onClick={loadSources}>Refresh</Button>
            </div>

            {indexedSources.length === 0 ? (
              <p className="text-sm text-[#4B3F35]">No indexed sources yet.</p>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {indexedSources.map((item) => (
                  <div key={item.sourceId} className="rounded-xl border border-[#D2C4B3] p-3">
                    <div className="text-sm font-semibold text-[#1F1A15]">{item.title}</div>
                    <div className="text-xs text-[#4B3F35] mt-1">
                      Type: {item.sourceType} · Chunks: {item.chunks} · Updated: {String(item.updatedAt || "").split("T")[0] || "N/A"}
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
