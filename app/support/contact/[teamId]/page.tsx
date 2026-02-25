"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

export default function SupportContactPage() {
  const params = useParams();
  const search = useSearchParams();
  const teamId = String(params?.teamId || "");
  const sessionId = search.get("sessionId") || "";
  const language = search.get("lang") || "en";

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    subject: "",
    description: "",
  });
  const [attachment, setAttachment] = useState<{
    name: string;
    type: string;
    dataUrl: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFile = (file: File | null) => {
    if (!file) {
      setAttachment(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setAttachment({
        name: file.name,
        type: file.type || "application/octet-stream",
        dataUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          sessionId,
          language,
          ...form,
          attachmentName: attachment?.name || null,
          attachmentContentType: attachment?.type || null,
          attachmentDataUrl: attachment?.dataUrl || null,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to submit support request.");
      }

      toast.success("Support request sent. Our team will contact you soon.");
      setForm({
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        subject: "",
        description: "",
      });
      setAttachment(null);
    } catch (error: any) {
      toast.error(error?.message || "Failed to submit support request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F1E7] px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#D2C4B3] bg-[#FFFDF7] p-6 shadow-[0_16px_40px_rgba(55,40,25,0.12)]">
        <div className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35]">
          Omega Escalation Support
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-[#1F1A15]">Contact Human Support</h1>
        <p className="mt-2 text-sm text-[#4B3F35]">
          Share your details and issue. The support team will review this request from the admin console.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Full name"
              value={form.customerName}
              onChange={(e) => onChange("customerName", e.target.value)}
              required
            />
            <Input
              placeholder="Email"
              type="email"
              value={form.customerEmail}
              onChange={(e) => onChange("customerEmail", e.target.value)}
              required
            />
          </div>

          <Input
            placeholder="Phone (optional)"
            value={form.customerPhone}
            onChange={(e) => onChange("customerPhone", e.target.value)}
          />

          <Input
            placeholder="Subject"
            value={form.subject}
            onChange={(e) => onChange("subject", e.target.value)}
            required
          />

          <Textarea
            rows={7}
            placeholder="Describe the issue in detail"
            value={form.description}
            onChange={(e) => onChange("description", e.target.value)}
            required
          />

          <div className="rounded-xl border border-[#D2C4B3] bg-white p-3">
            <label className="text-xs font-semibold text-[#4B3F35] flex items-center gap-2 mb-2">
              <Paperclip className="w-3.5 h-3.5" />
              Attachment (optional)
            </label>
            <Input
              type="file"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
            {attachment ? (
              <p className="text-xs text-[#4B3F35] mt-2">Attached: {attachment.name}</p>
            ) : null}
          </div>

          <Button type="submit" variant="dark" disabled={submitting} className="w-full">
            {submitting ? "Sending..." : "Send Support Request"}
          </Button>
        </form>
      </div>
    </div>
  );
}
