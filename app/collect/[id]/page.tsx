"use client";

import { Button } from "@/components/ui/button";
import { Globe2, Loader, SendHorizontal, Settings2, XIcon } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Transition } from "@headlessui/react";
import toast from "react-hot-toast";
import clsx from "clsx";

type Citation = {
  id: string;
  title: string;
  url?: string | null;
  snippet?: string;
};

type SupportMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  supportContactUrl?: string | null;
};

const ARYA_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "hi", label: "Hindi" },
  { value: "ar", label: "Arabic" },
];

function parseInlineCitations(text: string): Array<{
  type: "text" | "citation";
  content: string;
  citationId?: number;
}> {
  const parts: Array<{ type: "text" | "citation"; content: string; citationId?: number }> = [];
  const citationRegex = /\[(?:Source\s+)?(\d+)\]/gi;

  let lastIndex = 0;
  let match;

  while ((match = citationRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.substring(lastIndex, match.index),
      });
    }
    parts.push({
      type: "citation",
      content: match[0],
      citationId: Number(match[1]),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.substring(lastIndex),
    });
  }

  return parts;
}

function FeedbackWidget({ team }: { team: any }) {
  const params = useParams();
  const [rate, setRate] = useState(0);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendFeedback = async () => {
    if (rate === 0) {
      return toast.error("Rate your overall experience!");
    }

    if (!description.trim()) {
      return toast.error("Add more details, please!");
    }

    setLoading(true);

    fetch("/api/feedback/collect", {
      method: "POST",
      body: JSON.stringify({
        rate,
        text: description,
        teamId: params.id,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        setLoading(false);
        if (res.success) {
          setRate(0);
          setDescription("");
          toast.success("Thanks for sharing your feedback!");
          setTimeout(() => {
            parent.postMessage("omega-minimized", "*");
          }, 1200);
        } else {
          toast.error(res.message);
        }
      })
      .catch(() => {
        setLoading(false);
        toast.error("Failed to send feedback");
      });
  };

  return (
    <div className="absolute bottom-4 right-4 max-w-xs w-full bg-white rounded-xl">
      <div
        className="w-full rounded-xl p-4"
        style={{ backgroundColor: team?.style?.form_bg }}
      >
        <div
          className="flex items-start justify-between mb-3"
          style={{ color: team?.style?.form_color }}
        >
          <div>
            <h6 className="font-bold">{team?.style?.form_title}</h6>
            <p className="text-sm">{team?.style?.form_subtitle}</p>
          </div>
          <button
            onClick={() => parent.postMessage("omega-minimized", "*")}
            className="p-1 bg-white/50 rounded-full"
            style={{ color: team?.style?.form_bg }}
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-white/90 rounded-lg p-3">
          <p className="text-sm mb-2">{team?.style?.form_rate_text}</p>
          <div className="grid grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRate(n)}
                className="w-full aspect-square shadow rounded-md border active:scale-95 transition-all hover:border-gray-300"
                style={{
                  background: rate === n ? team?.style?.form_bg : "white",
                  color: rate === n ? team?.style?.form_color : "black",
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <Transition
            show={rate > 0}
            enter="transition-all duration-500"
            enterFrom="opacity-0 h-0"
            enterTo="opacity-100 h-full"
          >
            <div
              className={clsx([
                "transition-all ease-in-out",
                "data-[closed]:opacity-0",
                "data-[enter]:duration-500",
                "data-[leave]:duration-300",
              ])}
            >
              <p className="text-sm mb-2 mt-3">{team?.style?.form_details_text}</p>
              <textarea
                className="w-full rounded border p-3 placeholder:text-sm mb-2"
                rows={6}
                placeholder="Please let us know what's your feedback"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <Button
                variant="brand"
                className="w-full disabled:contrast-75 disabled:cursor-not-allowed"
                onClick={handleSendFeedback}
                disabled={loading}
                style={{
                  background: team?.style?.form_bg,
                  color: team?.style?.form_color,
                }}
              >
                {loading && <Loader className="w-4 h-4 animate-spin mr-1" />}
                {team?.style?.form_button_text}
              </Button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  );
}

function SupportWidget({ team }: { team: any }) {
  const params = useParams();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I can help using your company's indexed docs and links. I will cite sources when needed.",
      citations: [],
    },
  ]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [language, setLanguage] = useState("en");
  const [showSettings, setShowSettings] = useState(false);
  const [sessionId] = useState(
    () => `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const nextUserMessage: SupportMessage = {
      id: `${Date.now()}`,
      role: "user",
      content: input.trim(),
    };
    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, nextUserMessage]);
    setLoading(true);

    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: params.id,
          message: question,
          sessionId,
          conversationId,
          language,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to get support response.");
      }

      if (result?.data?.conversationId) {
        setConversationId(result.data.conversationId);
      }

      const assistantMessage: SupportMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: String(result?.data?.reply || ""),
        citations: Array.isArray(result?.data?.citations) ? result.data.citations : [],
      };
      const escalation = result?.data?.escalation;
      const nextMessages = [assistantMessage];
      if (escalation?.suggested && escalation?.contactUrl) {
        nextMessages.push({
          id: `${Date.now()}-escalate`,
          role: "assistant",
          content:
            "If this does not fully solve your issue, contact human support and share full details.",
          citations: [],
          supportContactUrl: String(escalation.contactUrl),
        });
      }

      setMessages((prev) => [...prev, ...nextMessages]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          content: error?.message || "Support is temporarily unavailable.",
          citations: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute bottom-4 right-4 max-w-xs w-full bg-white rounded-2xl border border-[#D2C4B3] overflow-hidden shadow-xl">
      <div
        className="px-4 py-3 flex items-start justify-between"
        style={{ backgroundColor: team?.style?.form_bg, color: team?.style?.form_color }}
      >
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-full bg-white/85 text-[#1F1A15] grid place-content-center font-bold text-sm">
            A
          </div>
          <div>
            <h6 className="font-bold text-sm">
              {team?.style?.support_title || "Arya Support Assistant"}
            </h6>
            <p className="text-xs opacity-90">
              {team?.style?.support_subtitle || "Get instant help with citations"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings((s) => !s)}
            className="p-1 bg-white/40 rounded-full"
            style={{ color: team?.style?.form_bg }}
            title="Arya language settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => parent.postMessage("omega-minimized", "*")}
            className="p-1 bg-white/40 rounded-full"
            style={{ color: team?.style?.form_bg }}
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showSettings ? (
        <div className="px-4 py-3 border-b border-[#D2C4B3] bg-[#FFFDF7] text-xs text-[#1F1A15]">
          <label className="font-semibold flex items-center gap-2 mb-2">
            <Globe2 className="w-3.5 h-3.5" />
            Language
          </label>
          <select
            className="w-full rounded-lg border border-[#D2C4B3] px-3 py-2 bg-white"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {ARYA_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="bg-[#FFFDF7] h-[400px] overflow-y-auto p-3 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={clsx("flex", message.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={clsx(
                "max-w-[92%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                message.role === "user"
                  ? "bg-[#1F1A15] text-[#FFFDF7]"
                  : "bg-white border border-[#D2C4B3] text-[#1F1A15]",
              )}
            >
              {parseInlineCitations(message.content).map((part, idx) => {
                if (part.type === "text") {
                  return <span key={idx}>{part.content}</span>;
                }

                const citationItem =
                  message.citations && part.citationId
                    ? message.citations[part.citationId - 1]
                    : null;

                if (!citationItem?.url) {
                  return (
                    <span key={idx} className="inline-block mx-1 px-1.5 py-0.5 rounded bg-[#E6D8C6] text-[#1F1A15] text-[11px]">
                      {part.content}
                    </span>
                  );
                }

                return (
                  <a
                    key={idx}
                    href={citationItem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mx-1 px-1.5 py-0.5 rounded bg-[#D2F7D7] text-[#1F1A15] text-[11px] underline"
                  >
                    {part.content}
                  </a>
                );
              })}

              {message.role === "assistant" &&
              message.citations &&
              message.citations.length > 0 ? (
                <div className="mt-2 pt-2 border-t border-[#E6D8C6] space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-[#4B3F35]">
                    Sources
                  </p>
                  {message.citations.map((source, idx) => (
                    <div key={`${message.id}-source-${idx}`} className="text-[11px] leading-snug">
                      <span className="font-semibold">[{idx + 1}] </span>
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {source.title}
                        </a>
                      ) : (
                        <span>{source.title}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {message.role === "assistant" && message.supportContactUrl ? (
                <div className="mt-3">
                  <a
                    href={message.supportContactUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full bg-[#1F1A15] text-[#FFFDF7] text-[11px] px-3 py-1.5"
                  >
                    Contact Human Support
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-xl px-3 py-2 bg-white border border-[#D2C4B3] text-[#1F1A15] text-sm">
              <div className="flex gap-1 h-5 items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[#D2C4B3] bg-white p-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={2}
          className="w-full resize-none rounded-lg border border-[#D2C4B3] px-3 py-2 text-sm"
          placeholder={
            team?.style?.support_placeholder ||
            "Ask Arya about docs, setup, billing..."
          }
        />
        <Button type="button" onClick={handleSend} disabled={loading || !input.trim()}>
          <SendHorizontal className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default function Page() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [team, setTeam] = useState<any>();

  useEffect(() => {
    const getTeam = async () => {
      fetch(`/api/team/${params?.id}`)
        .then((res) => res.json())
        .then((res) => {
          setTeam(res.data);
        })
        .catch(() => {
          setTeam(null);
        });
    };

    getTeam();
  }, [params?.id]);

  const selectedMode = useMemo(() => {
    const fromQuery = searchParams?.get("mode");
    if (fromQuery === "customer_agent") return "customer_agent";
    if (fromQuery === "feedback") return "feedback";
    return team?.style?.widget_mode || "feedback";
  }, [searchParams, team]);

  return (
    <div className="bg-black/70 backdrop-blur-sm inset-0 fixed">
      {selectedMode === "customer_agent" ? (
        <SupportWidget team={team} />
      ) : (
        <FeedbackWidget team={team} />
      )}
    </div>
  );
}
