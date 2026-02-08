"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTeam } from "@/lib/store";
import { useChat } from "ai/react";
import { CornerDownLeft, PackageOpen } from "lucide-react";
import { Session } from "next-auth";
import { marked } from "marked";

export default function Chat({ session }: { session: Session | null }) {
  const team = useTeam((state) => state.team);
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    body: {
      team: team,
      session: session,
    },
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="w-full">
        {messages.length > 0 ? (
          <div className="pb-28">
            {messages.map((m) => (
              <div className={`mb-2 flex ${m.role === "user" ? "justify-end" : "justify-start"}`} key={m.id}>
                <div
                  className={`inline-block max-w-[80%] rounded-t-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm prose ${
                    m.role === "user" ? "rounded-bl-2xl" : "rounded-br-2xl"
                  }`}
                  style={{
                    // whiteSpace: `pre-line`,
                    background: `${m.role === "user" && "black"}`,
                    color: `${m.role === "user" ? "white" : "black"}`,
                  }}
                  dangerouslySetInnerHTML={{ __html: marked(m.content) }}
                ></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto w-full mt-12 text-center p-12">
            <div className="size-40 grid place-content-center bg-gradient-to-t from-dark/10 rounded-full mx-auto mb-6">
              <PackageOpen className="size-20" />
            </div>
            <h2 className="font-medium text-xl mb-6">Ask me about your feedback</h2>
          </div>
        )}
      </div>

      <div className="fixed bottom-4 left-4 right-4 lg:right-8 lg:left-72">
        <div className="max-w-2xl mx-auto shadow-xl">
          <form onSubmit={handleSubmit} className="overflow-hidden rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring bg-white">
            <Label htmlFor="message" className="sr-only">
              Message
            </Label>
            <Textarea
              value={input}
              onChange={handleInputChange}
              id="message"
              placeholder="Type your message here..."
              className="min-h-12 resize-none border-0 p-3 shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center p-3 pt-0">
              <Button type="submit" size="sm" className="ml-auto gap-1.5">
                Send Message
                <CornerDownLeft className="size-3.5" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
