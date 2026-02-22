"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTeam } from "@/lib/store";
import { useState } from "react";
// import { useChat } from "ai/react";
import { BotMessageSquare, CornerDownLeft } from "lucide-react";
import { Session } from "next-auth";
import { marked } from "marked";

export default function Chat({ session }: { session: Session | null }) {
  const team = useTeam((state) => state.team);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          team: team,
          session: session,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch response");

      const text = await response.text();
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: text,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="w-full">
        {messages.length > 0 ? (
          <div className="pb-28">
            {messages.map((m) => (
              <div
                className={`mb-2 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                key={m.id}
              >
                <div
                  className={`inline-block max-w-[80%] rounded-t-2xl border border-[#D2C4B3] bg-[#FFFDF7] p-3 text-sm shadow-sm prose ${
                    m.role === "user" ? "rounded-bl-2xl" : "rounded-br-2xl"
                  }`}
                  style={{
                    // whiteSpace: `pre-line`,
                    background: `${m.role === "user" && "#1F1A15"}`,
                    color: `${m.role === "user" ? "#FFFDF7" : "#1F1A15"}`,
                  }}
                  dangerouslySetInnerHTML={{ __html: marked(m.content) }}
                ></div>
              </div>
            ))}
            {isLoading && (
              <div className="mb-2 flex justify-start">
                <div className="inline-block max-w-[80%] rounded-t-2xl rounded-br-2xl border border-[#D2C4B3] bg-[#FFFDF7] p-3 text-sm shadow-sm">
                  <div className="flex gap-1 h-5 items-center">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-xl mx-auto w-full mt-10 text-center p-8 bg-[#FFFDF7] rounded-2xl border border-[#D2C4B3] shadow-[0_12px_30px_rgba(55,40,25,0.12)]">
            <div className="size-28 grid place-content-center bg-gradient-to-t from-[#E6D8C6] rounded-full mx-auto mb-5">
              <BotMessageSquare className="size-14" />
            </div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35] mb-2">
              AI Analysis
            </div>
            <h2 className="font-medium text-xl mb-6 text-[#1F1A15]">
              Ask me about your feedback
            </h2>
          </div>
        )}
      </div>

      <div className="fixed bottom-5 left-1/2 w-full max-w-3xl -translate-x-1/2 px-4">
        <div className="w-full shadow-[0_18px_44px_rgba(55,40,25,0.25)]">
          <form
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-2xl border border-[#D2C4B3] bg-[#FFFDF7] focus-within:ring-2 focus-within:ring-[#2D6A4F]"
          >
            <Label htmlFor="message" className="sr-only">
              Message
            </Label>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 p-3">
              <Textarea
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                id="message"
                placeholder="Ask about trends, sentiment, or specific feedback…"
                className="min-h-[56px] resize-none border-0 p-2 shadow-none focus-visible:ring-0 bg-transparent text-[#1F1A15] placeholder:text-[#5A4E43]"
              />
              <Button
                type="submit"
                size="sm"
                className="gap-2 rounded-full px-5"
                disabled={isLoading}
              >
                Send
                <CornerDownLeft className="size-3.5" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
