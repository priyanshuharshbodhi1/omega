"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTeam } from "@/lib/store";
import { Globe, Link, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

export default function Dashboard() {
  const [link, setLink] = useState("");
  const [snippet, setSnippet] = useState("");
  const [copied, setCopied] = useState<"link" | "snippet" | "qr" | null>(null);
  const team = useTeam((state) => state.team);

  useEffect(() => {
    if (team) {
      setLink(`${process.env.NEXT_PUBLIC_BASE_URL}/collect/${team?.id}`);
      setSnippet(
        `<script src="${process.env.NEXT_PUBLIC_BASE_URL}/omega.js" omega-id="${team?.id}"></script>`,
      );
    }
  }, [team]);

  const handleCopy = async (value: string, key: "link" | "snippet" | "qr") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  return (
    <>
      <div className="mx-auto w-full max-w-5xl mt-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 justify-center">
          <div className="w-full bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl p-6 shadow-[0_12px_30px_rgba(55,40,25,0.12)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center">
                <QrCode className="size-5" />
              </div>
              <h5 className="text-[11px] font-bold uppercase tracking-widest text-violet-600">
                QR Code
              </h5>
            </div>
            <p className="text-sm text-[#1F1A15] mb-4">
              Download & Share QR code to interact directly
            </p>
            <AlertDialog>
              <AlertDialogTrigger
                className={buttonVariants({ variant: "dark", size: "sm" })}
              >
                Connect
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-lg rounded-2xl border border-[#D2C4B3] bg-[#FFFDF7] p-0 shadow-[0_20px_60px_rgba(30,20,10,0.25)]">
                <div className="px-6 pt-6 pb-4 border-b border-[#D2C4B3]">
                  <h3 className="text-lg font-semibold text-[#1F1A15]">
                    QR Code
                  </h3>
                  <p className="text-xs text-[#4B3F35] mt-1">
                    Scan or share your feedback link quickly.
                  </p>
                </div>
                <div className="px-6 py-5">
                  <div className="mx-auto w-44 rounded-xl bg-[#FFFDF7] p-3 shadow-sm border border-[#D2C4B3]">
                    <QRCode
                      size={176}
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      value={link}
                      viewBox={`0 0 256 256`}
                    />
                  </div>
                </div>
                <div className="px-6 pb-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => handleCopy(link, "qr")}
                    className="h-9 px-4 rounded-full border border-[#D9CDBA] text-[#1F1A15] text-xs font-semibold uppercase tracking-widest hover:bg-[#E6D8C6]"
                  >
                    {copied === "qr" ? "Copied" : "Copy Link"}
                  </button>
                  <AlertDialogCancel className="h-9 px-4 rounded-full border border-[#D9CDBA] text-[#1F1A15] hover:bg-[#E6D8C6]">
                    Close
                  </AlertDialogCancel>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="w-full bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl p-6 shadow-[0_12px_30px_rgba(55,40,25,0.12)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center">
                <Link className="size-5" />
              </div>
              <h5 className="text-[11px] font-bold uppercase tracking-widest text-violet-600">
                Quick Link
              </h5>
            </div>
            <p className="text-sm text-[#1F1A15] mb-4">
              Share a quick link to interact directly with the widgets
            </p>
            <AlertDialog>
              <AlertDialogTrigger
                className={buttonVariants({ variant: "dark", size: "sm" })}
              >
                Connect
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-lg rounded-2xl border border-[#D2C4B3] bg-[#FFFDF7] p-0 shadow-[0_20px_60px_rgba(30,20,10,0.25)]">
                <div className="px-6 pt-6 pb-4 border-b border-[#D2C4B3]">
                  <h3 className="text-lg font-semibold text-[#1F1A15]">
                    Quick Link
                  </h3>
                  <p className="text-xs text-[#4B3F35] mt-1">
                    Share this link with your customers.
                  </p>
                </div>
                <div className="px-6 py-5 space-y-3">
                  <p className="text-xs text-[#4B3F35]">
                    Use this link in emails, chats, or support tickets so
                    customers can leave feedback instantly.
                  </p>
                  <Input
                    value={link}
                    readOnly
                    onFocus={(e) => e.target.select()}
                    className="h-11 rounded-full border-[#D9CDBA] bg-[#FFFDF7] px-4"
                  />
                </div>
                <div className="px-6 pb-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => handleCopy(link, "link")}
                    className="h-9 px-4 rounded-full border border-[#D9CDBA] text-[#1F1A15] text-xs font-semibold uppercase tracking-widest hover:bg-[#E6D8C6]"
                  >
                    {copied === "link" ? "Copied" : "Copy Link"}
                  </button>
                  <AlertDialogCancel className="h-9 px-4 rounded-full border border-[#D9CDBA] text-[#1F1A15] hover:bg-[#E6D8C6]">
                    Close
                  </AlertDialogCancel>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="w-full bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl p-6 shadow-[0_12px_30px_rgba(55,40,25,0.12)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center">
                <Globe className="size-5" />
              </div>
              <h5 className="text-[11px] font-bold uppercase tracking-widest text-violet-600">
                Website
              </h5>
            </div>
            <p className="text-sm text-[#1F1A15] mb-4">
              Embed feedback widgets with your websites easily
            </p>
            <AlertDialog>
              <AlertDialogTrigger
                className={buttonVariants({ variant: "dark", size: "sm" })}
              >
                Connect
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-lg rounded-2xl border border-[#D2C4B3] bg-[#FFFDF7] p-0 shadow-[0_20px_60px_rgba(30,20,10,0.25)]">
                <div className="px-6 pt-6 pb-4 border-b border-[#D2C4B3]">
                  <h3 className="text-lg font-semibold text-[#1F1A15]">
                    Website Embed
                  </h3>
                  <p className="text-xs text-[#4B3F35] mt-1">
                    Paste this script before {`</body>`} on your site.
                  </p>
                </div>
                <div className="px-6 py-5 space-y-3">
                  <p className="text-xs text-[#4B3F35]">
                    Add this script tag once on every page where you want the
                    feedback widget to appear. It loads async and won&apos;t block
                    rendering.
                  </p>
                  <textarea
                    value={snippet}
                    readOnly
                    onFocus={(e) => e.currentTarget.select()}
                    rows={3}
                    className="w-full rounded-xl border border-[#D9CDBA] bg-[#FFFDF7] px-4 py-3 text-xs text-[#1F1A15]"
                  />
                </div>
                <div className="px-6 pb-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => handleCopy(snippet, "snippet")}
                    className="h-9 px-4 rounded-full border border-[#D9CDBA] text-[#1F1A15] text-xs font-semibold uppercase tracking-widest hover:bg-[#E6D8C6]"
                  >
                    {copied === "snippet" ? "Copied" : "Copy Script"}
                  </button>
                  <AlertDialogCancel className="h-9 px-4 rounded-full border border-[#D9CDBA] text-[#1F1A15] hover:bg-[#E6D8C6]">
                    Close
                  </AlertDialogCancel>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </>
  );
}
