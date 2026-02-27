"use client";

import { Button } from "@/components/ui/button";
import {
  Globe2,
  Loader,
  SendHorizontal,
  Settings2,
  XIcon,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Transition } from "@headlessui/react";
import toast from "react-hot-toast";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";

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
  showTalkToAgent?: boolean;
  escalationReason?: string | null;
  escalationQuestion?: string | null;
  escalationAnswer?: string | null;
  escalationTicketId?: string | null;
  assistantMessageId?: string | null;
  confidenceScore?: number | null;
  followUpQuestions?: string[];
  csatRating?: "up" | "down" | null;
};

const ARYA_LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "hi", label: "Hindi" },
  { value: "ar", label: "Arabic" },
];

const CUSTOMER_AGENT_EMAIL = "priyanshu.admin@slack.com";

function buildGmailComposeLink(params: {
  to: string;
  subject: string;
  body: string;
}) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(params.to)}&su=${encodeURIComponent(params.subject)}&body=${encodeURIComponent(params.body)}`;
}

function buildPseudoCustomerEmail(sessionId: string) {
  const safeToken = sessionId.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 24);
  const localPart = safeToken || "aryauser";
  return `${localPart}@arya-widget.zapfeed.ai`;
}

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
        "Hi! I'm here to help. Ask me anything and I'll find the answer for you.",
      citations: [],
    },
  ]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [language, setLanguage] = useState("auto");
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [csatLoadingMessageId, setCsatLoadingMessageId] = useState<string | null>(null);
  const [escalatingMessageId, setEscalatingMessageId] = useState<string | null>(null);
  const [sessionId] = useState(
    () => `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const teamId = String(params?.id || "");

  const DEMO_RESPONSES: Record<string, { reply: string; citations: Citation[]; followUps: string[] }> = {
    "How do I reset my password?": {
      reply: `To reset your password, follow these steps:\n\n1. Go to the **login page** and click "Forgot Password" [1]\n2. Enter the email address associated with your account\n3. Check your inbox for a reset link (arrives within 2 minutes)\n4. Click the link and set a new password (minimum 8 characters, must include a number)\n\nIf the email doesn't arrive, check your spam folder. You can also request a new link after 60 seconds. [2]\n\n**Tip:** After resetting, you'll be logged out of all other devices for security.`,
      citations: [
        { id: "1", title: "Account Settings - Password Reset", url: "#citation-no-url", snippet: "Navigate to login page and select 'Forgot Password' to begin the reset flow." },
        { id: "2", title: "Troubleshooting - Email Delivery", url: "#citation-no-url", snippet: "Reset emails are sent immediately. Check spam/junk folders if not received within 2 minutes." },
      ],
      followUps: ["Can I change my email address?", "How do I enable two-factor authentication?", "What if I don't receive the reset email?"],
    },
    "What payment methods do you accept?": {
      reply: `We accept the following payment methods:\n\n**Credit & Debit Cards**\n- Visa, Mastercard, American Express [1]\n- All cards are processed securely via Stripe\n\n**Digital Wallets**\n- Apple Pay and Google Pay at checkout\n\n**Other**\n- Bank transfers for annual Enterprise plans\n- PayPal available in supported regions [2]\n\nAll transactions are encrypted with TLS 1.3 and we never store your full card number. Invoices are sent to your email automatically after each payment.`,
      citations: [
        { id: "1", title: "Billing - Accepted Payment Methods", url: "#citation-no-url", snippet: "We support Visa, Mastercard, and American Express for all plan types." },
        { id: "2", title: "Enterprise Billing - Payment Options", url: "#citation-no-url", snippet: "PayPal and bank transfers available for qualifying accounts and regions." },
      ],
      followUps: ["How do I update my billing info?", "Do you offer refunds?", "Can I switch to annual billing?"],
    },
  };

  const getDemoResponse = (query: string): typeof DEMO_RESPONSES[string] | null => {
    const q = query.trim().toLowerCase();
    for (const [key, val] of Object.entries(DEMO_RESPONSES)) {
      if (q === key.toLowerCase()) return val;
    }
    if (q.includes("reset") && q.includes("password")) return DEMO_RESPONSES["How do I reset my password?"];
    if (q.includes("payment") && (q.includes("method") || q.includes("accept") || q.includes("option"))) return DEMO_RESPONSES["What payment methods do you accept?"];
    return null;
  };

  const handleSend = async (presetQuestion?: string) => {
    const questionToSend = String(presetQuestion ?? input).trim();
    if (!questionToSend || loading) return;

    const nextUserMessage: SupportMessage = {
      id: `${Date.now()}`,
      role: "user",
      content: questionToSend,
    };
    if (!presetQuestion) {
      setInput("");
    }
    setMessages((prev) => [...prev, nextUserMessage]);
    setLoading(true);

    const demoResponse = getDemoResponse(questionToSend);
    if (demoResponse) {
      await new Promise((r) => setTimeout(r, 1200));
      const assistantMessage: SupportMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: demoResponse.reply,
        citations: demoResponse.citations,
        confidenceScore: 92,
        followUpQuestions: demoResponse.followUps,
        csatRating: null,
        assistantMessageId: `demo-${Date.now()}`,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          message: questionToSend,
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
      if (result?.data?.detectedLanguage) {
        setDetectedLang(result.data.detectedLanguage);
      }

      const assistantMessage: SupportMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: String(result?.data?.reply || ""),
        assistantMessageId: result?.data?.assistantMessageId || null,
        citations: Array.isArray(result?.data?.citations) ? result.data.citations : [],
        confidenceScore:
          typeof result?.data?.confidenceScore === "number"
            ? result.data.confidenceScore
            : null,
        followUpQuestions: Array.isArray(result?.data?.followUpQuestions)
          ? result.data.followUpQuestions.slice(0, 3)
          : [],
        csatRating: null,
      };
      const escalation = result?.data?.escalation;
      const nextMessages = [assistantMessage];
      if (escalation?.suggested) {
        const escalationReason = String(escalation?.reason || "");
        const escalationContent =
          escalationReason === "user_requested_human_support"
            ? "I can connect you to a customer agent right now."
            : "If this did not solve your issue, you can talk directly to our customer agent.";

        nextMessages.push({
          id: `${Date.now()}-escalate`,
          role: "assistant",
          content: escalationContent,
          citations: [],
          supportContactUrl: escalation?.contactUrl
            ? String(escalation.contactUrl)
            : null,
          showTalkToAgent: true,
          escalationReason: escalationReason || "user_dissatisfied_or_low_confidence",
          escalationQuestion: questionToSend,
          escalationAnswer: assistantMessage.content,
          escalationTicketId: null,
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

  const submitCsatRating = async (assistantMessageId: string, rating: "up" | "down") => {
    if (!assistantMessageId || csatLoadingMessageId) return;
    setCsatLoadingMessageId(assistantMessageId);

    const previous = messages.find(
      (msg) => msg.assistantMessageId === assistantMessageId,
    )?.csatRating;

    setMessages((prev) =>
      prev.map((msg) =>
        msg.assistantMessageId === assistantMessageId
          ? { ...msg, csatRating: rating }
          : msg,
      ),
    );

    try {
      const response = await fetch("/api/support/csat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          sessionId,
          assistantMessageId,
          rating,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to save rating.");
      }
      toast.success("Thanks for your feedback.");
    } catch (error: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.assistantMessageId === assistantMessageId
            ? { ...msg, csatRating: previous || null }
            : msg,
        ),
      );
      toast.error(error?.message || "Could not save your rating.");
    } finally {
      setCsatLoadingMessageId(null);
    }
  };

  const handleTalkToCustomerAgent = async (messageId: string) => {
    if (!teamId || escalatingMessageId) return;
    const escalationMessage = messages.find((message) => message.id === messageId);
    if (!escalationMessage) return;

    setEscalatingMessageId(messageId);

    try {
      let ticketId = escalationMessage.escalationTicketId || null;
      const ticketSubject = `Arya dissatisfaction escalation (${teamId})`;
      const ticketDescription = [
        "User requested to talk to a customer agent from Arya widget.",
        "",
        `Team ID: ${teamId}`,
        `Session ID: ${sessionId}`,
        `Language: ${detectedLang || (language === "auto" ? "en" : language)}`,
        `Reason: ${escalationMessage.escalationReason || "user_dissatisfied_or_low_confidence"}`,
        "",
        "Latest user query:",
        escalationMessage.escalationQuestion || "N/A",
        "",
        "Latest Arya response:",
        escalationMessage.escalationAnswer || "N/A",
      ].join("\n");

      if (!ticketId) {
        const response = await fetch("/api/support/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
            sessionId,
            language: detectedLang || (language === "auto" ? "en" : language),
            source: "arya_dissatisfied",
            customerName: "Arya Widget User",
            customerEmail: buildPseudoCustomerEmail(sessionId),
            subject: ticketSubject,
            description: ticketDescription,
          }),
        });
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Failed to submit escalation request.");
        }

        ticketId = String(data?.data?.ticketId || "").trim();
        if (!ticketId) {
          throw new Error("Escalation saved but ticket ID is missing.");
        }

        setMessages((prev) =>
          prev.map((message) =>
            message.id === messageId
              ? { ...message, escalationTicketId: ticketId }
              : message,
          ),
        );
      }

      const gmailBody = [
        `Ticket ID: ${ticketId || "N/A"}`,
        `Team ID: ${teamId}`,
        `Session ID: ${sessionId}`,
        `Reason: ${escalationMessage.escalationReason || "user_dissatisfied_or_low_confidence"}`,
        "",
        "Latest user query:",
        escalationMessage.escalationQuestion || "N/A",
        "",
        "Latest Arya response:",
        escalationMessage.escalationAnswer || "N/A",
      ].join("\n");

      const gmailLink = buildGmailComposeLink({
        to: CUSTOMER_AGENT_EMAIL,
        subject: ticketSubject,
        body: gmailBody,
      });
      const openedWindow = window.open(gmailLink, "_blank", "noopener,noreferrer");
      if (!openedWindow) {
        window.location.href = gmailLink;
      }

      toast.success("Escalation queued. Gmail compose opened.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to connect to a customer agent.");
    } finally {
      setEscalatingMessageId(null);
    }
  };

  return (
    <div className="absolute bottom-4 right-4 max-w-[350px] w-[95vw] bg-white rounded-2xl border border-[#D2C4B3] overflow-hidden shadow-xl">
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
              {team?.style?.support_title || "Omega Support Assistant"}
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
            title="Omega language settings"
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
          {language === "auto" && detectedLang && detectedLang !== "en" && (
            <p className="mt-1.5 text-[10px] text-[#6B5E50]">
              Detected: {ARYA_LANGUAGES.find((l) => l.value === detectedLang)?.label || detectedLang}
            </p>
          )}
        </div>
      ) : null}

      <div className="bg-[#FFFDF7] h-[400px] overflow-y-auto p-3 space-y-3">
        {messages.length === 1 && messages[0].id === "welcome" && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {["How do I reset my password?", "What payment methods do you accept?"].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                disabled={loading}
                className="rounded-full border border-[#D2C4B3] bg-white px-2.5 py-1 text-[11px] text-[#1F1A15] hover:bg-[#F5F0E8] disabled:opacity-60"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={clsx("flex", message.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={clsx(
                "max-w-[92%] rounded-xl px-3 py-2 text-sm",
                message.role === "user"
                  ? "bg-[#1F1A15] text-[#FFFDF7] whitespace-pre-wrap"
                  : "bg-white border border-[#D2C4B3] text-[#1F1A15]",
              )}
            >
              <div className="text-sm prose-sm text-inherit">
                <ReactMarkdown
                  components={{
                  p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                  h1: ({ node, ...props }) => <h1 className="text-sm font-bold mt-3 mb-1" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-sm font-bold mt-3 mb-1" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-sm font-bold mt-2 mb-1" {...props} />,
                  a: ({ node, href, children, ...props }) => {
                    if (href?.startsWith("#citation-no-url")) {
                      return (
                        <span className="inline-block mx-1 px-1.5 py-0.5 rounded bg-[#E6D8C6] text-[#1F1A15] text-[11px] font-semibold leading-none no-underline border border-[#D2C4B3]">
                          {children}
                        </span>
                      );
                    }
                    if (href?.startsWith("#citation-url-")) {
                      const actualUrl = href.replace("#citation-url-", "");
                      return (
                        <a href={actualUrl} target="_blank" rel="noreferrer" className="inline-block mx-1 px-1.5 py-0.5 rounded bg-[#D2F7D7] text-[#1F1A15] text-[11px] font-semibold underline leading-none border border-[#BDE7C2]" {...props}>
                          {children}
                        </a>
                      );
                    }
                    return <a href={href} target="_blank" rel="noreferrer" className="underline font-semibold" {...props}>{children}</a>;
                  },
                  code: ({ node, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || "");
                    const isInline = !match && !String(children).includes("\n");
                    return isInline ? (
                      <code className="bg-black/10 rounded px-1 py-0.5 text-[12px]" {...props}>{children}</code>
                    ) : (
                      <pre className="block bg-black/10 rounded overflow-x-auto p-2 mb-2 text-[12px]">
                        <code {...props}>{children}</code>
                      </pre>
                    );
                  }
                }}
              >
                {(() => {
                  let text = message.content;
                  if (!message.citations?.length) return text;
                  return text.replace(/\[(?:Source\s+)?(\d+)\]/gi, (match, id) => {
                    const citationItem = message.citations![Number(id) - 1];
                    if (citationItem?.url) {
                      return `[${match}](#citation-url-${citationItem.url})`;
                    }
                    return `[${match}](#citation-no-url)`;
                  });
                })()}
                </ReactMarkdown>
              </div>

              {message.role === "assistant" &&
              message.citations &&
              message.citations.length > 0 ? (
                <div className="mt-2 pt-2 border-t border-[#E6D8C6] space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-[#4B3F35] font-medium">
                    Sources ({message.citations.length})
                  </p>
                  {message.citations.map((source, idx) => (
                    <div key={`${message.id}-source-${idx}`} className="rounded-md bg-[#F5F0E8] px-2 py-1.5">
                      <div className="flex items-start gap-1.5">
                        <span className="shrink-0 inline-flex items-center justify-center size-4 rounded bg-[#D2C4B3] text-[9px] font-bold text-[#4B3F35] mt-0.5">{idx + 1}</span>
                        <div className="min-w-0">
                          {source.url ? (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-semibold underline text-[#1F1A15] line-clamp-1 block"
                            >
                              {source.title}
                            </a>
                          ) : (
                            <span className="text-[11px] font-semibold text-[#1F1A15] line-clamp-1 block">{source.title}</span>
                          )}
                          {source.snippet ? (
                            <p className="text-[10px] text-[#6B5E50] line-clamp-2 mt-0.5 leading-snug">{source.snippet}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {message.role === "assistant" && typeof message.confidenceScore === "number" ? (
                <div className="mt-2 pt-2 border-t border-[#E6D8C6]">
                  <span className="inline-flex items-center rounded-full bg-[#E6D8C6] text-[#1F1A15] text-[10px] font-semibold px-2 py-1">
                    Confidence: {Math.round(message.confidenceScore)}%
                  </span>
                </div>
              ) : null}

              {message.role === "assistant" &&
              Array.isArray(message.followUpQuestions) &&
              message.followUpQuestions.length > 0 ? (
                <div className="mt-2 pt-2 border-t border-[#E6D8C6]">
                  <p className="text-[10px] uppercase tracking-wide text-[#4B3F35] font-medium mb-1.5">
                    Suggested follow-ups
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {message.followUpQuestions.map((question, idx) => (
                      <button
                        key={`${message.id}-follow-up-${idx}`}
                        type="button"
                        onClick={() => handleSend(question)}
                        disabled={loading}
                        className="rounded-full border border-[#D2C4B3] bg-[#FFFDF7] px-2.5 py-1 text-[11px] text-[#1F1A15] hover:bg-[#F5F0E8] disabled:opacity-60"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {message.role === "assistant" && message.assistantMessageId ? (
                <div className="mt-2 pt-2 border-t border-[#E6D8C6] flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[#4B3F35]">Was this helpful?</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => submitCsatRating(message.assistantMessageId!, "up")}
                      disabled={csatLoadingMessageId === message.assistantMessageId}
                      className={clsx(
                        "rounded-full border p-1.5",
                        message.csatRating === "up"
                          ? "border-[#14532d] bg-[#D2F7D7] text-[#14532d]"
                          : "border-[#D2C4B3] bg-white text-[#4B3F35]",
                      )}
                      title="Helpful"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => submitCsatRating(message.assistantMessageId!, "down")}
                      disabled={csatLoadingMessageId === message.assistantMessageId}
                      className={clsx(
                        "rounded-full border p-1.5",
                        message.csatRating === "down"
                          ? "border-[#B42318] bg-[#F8E1D5] text-[#B42318]"
                          : "border-[#D2C4B3] bg-white text-[#4B3F35]",
                      )}
                      title="Not helpful"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : null}

              {message.role === "assistant" && message.showTalkToAgent ? (
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="dark"
                    onClick={() => handleTalkToCustomerAgent(message.id)}
                    disabled={escalatingMessageId === message.id}
                    className="rounded-full text-[11px]"
                  >
                    {escalatingMessageId === message.id
                      ? "Connecting..."
                      : "Talk to Customer Agent"}
                  </Button>

                  {message.supportContactUrl ? (
                    <a
                      href={message.supportContactUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center ml-2 rounded-full border border-[#D2C4B3] bg-white text-[#1F1A15] text-[11px] px-3 py-1.5"
                    >
                      Open Support Form
                    </a>
                  ) : null}
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
            "Ask Omega about docs, setup, billing..."
          }
        />
        <Button
          type="button"
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
        >
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
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data === "omega-minimized") {
        setIsMinimized(true);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

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
    <div className={clsx("inset-0 fixed transition-all duration-300", isMinimized ? "pointer-events-none bg-transparent" : "bg-black/70 backdrop-blur-sm pointer-events-auto")}>
      {!isMinimized && (
        selectedMode === "customer_agent" ? (
          <SupportWidget team={team} />
        ) : (
          <FeedbackWidget team={team} />
        )
      )}
      
      {isMinimized && (
        <button 
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-2xl flex items-center justify-center pointer-events-auto transition-transform hover:scale-105 active:scale-95 z-[9999]"
          style={{ backgroundColor: team?.style?.form_bg || '#1F1A15', color: team?.style?.form_color || '#fff' }}
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
