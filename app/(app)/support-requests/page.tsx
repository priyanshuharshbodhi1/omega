"use client";

import { Button } from "@/components/ui/button";
import { useTeam } from "@/lib/store";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function SupportRequestsPage() {
  const team = useTeam((state) => state.team);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const loadTickets = async (teamId: string) => {
    const res = await fetch(`/api/team/${teamId}/support-tickets`);
    const data = await res.json();
    if (res.ok && data.success) {
      setTickets(data.data || []);
    }
  };

  useEffect(() => {
    if (!team?.id) return;
    let active = true;
    setLoading(true);

    loadTickets(team.id)
      .then(() => {})
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [team?.id]);

  const updateTicketStatus = async (ticketId: string, status: "open" | "in_progress" | "resolved") => {
    setActionKey(`${ticketId}:status:${status}`);
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update status.");
      }
      toast.success(`Ticket marked ${status.replace("_", " ")}.`);
      if (team?.id) await loadTickets(team.id);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update status.");
    } finally {
      setActionKey(null);
    }
  };

  const sendToSlack = async (ticketId: string) => {
    setActionKey(`${ticketId}:slack`);
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}/slack`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to send to Slack.");
      }
      toast.success("Ticket sent to Slack.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send to Slack.");
    } finally {
      setActionKey(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35]">Support Inbox</div>
        <h1 className="text-2xl font-semibold text-[#1F1A15] mt-2">Escalated Customer Requests</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-24 rounded-xl bg-[#E6D8C6] animate-pulse" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-[#D2C4B3] bg-[#FFFDF7] p-5 text-sm text-[#4B3F35]">
          No support requests yet.
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-xl border border-[#D2C4B3] bg-[#FFFDF7] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#1F1A15]">{ticket.subject}</div>
                  <div className="text-xs text-[#4B3F35] mt-1">
                    {ticket.customerName} · {ticket.customerEmail}
                    {ticket.customerPhone ? ` · ${ticket.customerPhone}` : ""}
                  </div>
                  <div className="text-xs text-[#4B3F35] mt-1">
                    Source: {ticket.source} · Lang: {ticket.language || "en"} · Session: {ticket.sessionId || "N/A"}
                  </div>
                </div>
                <div className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-[#FCE7C8] text-[#4B3F35]">
                  {ticket.status || "open"}
                </div>
              </div>

              <p className="text-sm text-[#1F1A15] mt-3 whitespace-pre-wrap">{ticket.description}</p>

              <div className="text-xs text-[#4B3F35] mt-3 flex items-center gap-4">
                <span>Created: {String(ticket.createdAt || "").split("T")[0] || "N/A"}</span>
                {ticket.attachmentDataUrl ? (
                  <a href={ticket.attachmentDataUrl} download={ticket.attachmentName || "attachment"} className="underline text-[#2D6A4F]">
                    Download Attachment
                  </a>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="dark"
                  disabled={actionKey !== null}
                  onClick={() => updateTicketStatus(ticket.id, "in_progress")}
                >
                  {actionKey === `${ticket.id}:status:in_progress` ? "Updating..." : "Mark In Progress"}
                </Button>
                <Button
                  size="sm"
                  variant="dark"
                  disabled={actionKey !== null}
                  onClick={() => updateTicketStatus(ticket.id, "resolved")}
                >
                  {actionKey === `${ticket.id}:status:resolved` ? "Updating..." : "Mark Resolved"}
                </Button>
                <Button
                  size="sm"
                  variant="dark"
                  disabled={actionKey !== null}
                  onClick={() => sendToSlack(ticket.id)}
                >
                  {actionKey === `${ticket.id}:slack` ? "Sending..." : "Send to Slack"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
