"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Loader2, Mail, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { useTeam } from "@/lib/store";

type AryaEscalationTicket = {
  id: string;
  teamId: string;
  source: "arya_dissatisfied";
  sessionId?: string | null;
  language?: string | null;
  customerName: string;
  customerEmail: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  updatedAt: string;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

export default function AryaEscalationsPage() {
  const team = useTeam((state) => state.team);
  const [tickets, setTickets] = useState<AryaEscalationTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "resolved">(
    "active",
  );

  const loadTickets = useCallback(async (teamId: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/team/${teamId}/support-tickets?source=arya_dissatisfied`,
      );
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to load Arya escalations.");
      }
      setTickets(Array.isArray(data.data) ? data.data : []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load Arya escalations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!team?.id) return;
    loadTickets(team.id);
  }, [team?.id, loadTickets]);

  const visibleTickets = useMemo(() => {
    if (statusFilter === "all") return tickets;
    if (statusFilter === "resolved") {
      return tickets.filter((ticket) => ticket.status === "resolved");
    }
    return tickets.filter((ticket) => ticket.status !== "resolved");
  }, [tickets, statusFilter]);

  const updateStatus = async (
    ticketId: string,
    status: "open" | "in_progress" | "resolved",
  ) => {
    if (!team?.id) return;
    const key = `${ticketId}:${status}`;
    setActionKey(key);

    try {
      const response = await fetch(
        `/api/support/tickets/${encodeURIComponent(ticketId)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to update escalation status.");
      }
      toast.success(
        status === "resolved"
          ? "Marked as satisfied."
          : status === "in_progress"
            ? "Marked in progress."
            : "Escalation reopened.",
      );
      await loadTickets(team.id);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update escalation status.");
    } finally {
      setActionKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35]">
            Feedback
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-[#1F1A15]">
            Arya Dissatisfaction Escalations
          </h1>
          <p className="mt-2 text-sm text-[#4B3F35]">
            Review users who asked to talk to a customer agent and mark them
            resolved after email follow-up.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/feedback">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <Button
            variant="dark"
            size="sm"
            onClick={() => team?.id && loadTickets(team.id)}
            disabled={loading || !team?.id}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={statusFilter === "active" ? "dark" : "outline"}
          onClick={() => setStatusFilter("active")}
        >
          Active
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "resolved" ? "dark" : "outline"}
          onClick={() => setStatusFilter("resolved")}
        >
          Resolved
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "all" ? "dark" : "outline"}
          onClick={() => setStatusFilter("all")}
        >
          All
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-24 rounded-xl bg-[#E6D8C6] animate-pulse"
            />
          ))}
        </div>
      ) : visibleTickets.length === 0 ? (
        <div className="rounded-xl border border-[#D2C4B3] bg-[#FFFDF7] p-5 text-sm text-[#4B3F35]">
          No Arya dissatisfaction escalations found for this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="rounded-xl border border-[#D2C4B3] bg-[#FFFDF7] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#1F1A15]">
                    {ticket.subject}
                  </p>
                  <p className="text-xs text-[#4B3F35] mt-1">
                    {ticket.customerName} · {ticket.customerEmail}
                  </p>
                  <p className="text-xs text-[#4B3F35] mt-1">
                    Session: {ticket.sessionId || "N/A"} · Language:{" "}
                    {ticket.language || "en"}
                  </p>
                </div>
                <div
                  className={clsx(
                    "text-[10px] uppercase tracking-widest px-2 py-1 rounded-full",
                    ticket.status === "resolved"
                      ? "bg-[#D2F7D7] text-[#14532d]"
                      : ticket.status === "in_progress"
                        ? "bg-[#FCE7C8] text-[#4B3F35]"
                        : "bg-[#F8E1D5] text-[#B42318]",
                  )}
                >
                  {ticket.status}
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm text-[#1F1A15]">
                {ticket.description}
              </p>

              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#4B3F35]">
                <span>Created: {formatDateTime(ticket.createdAt)}</span>
                <a
                  href={`mailto:${ticket.customerEmail}?subject=${encodeURIComponent(`Re: ${ticket.subject}`)}`}
                  className="inline-flex items-center gap-1 underline"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email Customer
                </a>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {ticket.status !== "in_progress" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionKey !== null}
                    onClick={() => updateStatus(ticket.id, "in_progress")}
                  >
                    {actionKey === `${ticket.id}:in_progress`
                      ? "Updating..."
                      : "Mark In Progress"}
                  </Button>
                ) : null}

                {ticket.status !== "resolved" ? (
                  <Button
                    size="sm"
                    variant="dark"
                    disabled={actionKey !== null}
                    onClick={() => updateStatus(ticket.id, "resolved")}
                  >
                    {actionKey === `${ticket.id}:resolved`
                      ? "Updating..."
                      : "Mark Satisfied"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionKey !== null}
                    onClick={() => updateStatus(ticket.id, "open")}
                  >
                    {actionKey === `${ticket.id}:open`
                      ? "Updating..."
                      : "Reopen"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
