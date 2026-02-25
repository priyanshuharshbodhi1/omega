import { invokeAgent } from "@/lib/agent-builder";
import {
  createActionAuditLog,
  createSupportTicket,
  runESQL,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * Omega Smart Escalation Workflow
 *
 * Flow: Escalation signal detected → Conversation history retrieval →
 *       Agent analysis (urgency + summary) → Priority ticket creation →
 *       Conditional Slack notification → Audit log
 *
 * Mirrors Elastic Workflows pattern: data → insights → action
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const teamId = String(body?.teamId || "").trim();
    const sessionId = String(body?.sessionId || "").trim();
    const customerName = String(body?.customerName || "Customer").trim();
    const customerEmail = String(body?.customerEmail || "").trim();
    const escalationReason = String(body?.reason || "user_dissatisfied").trim();
    const language = String(body?.language || "en").trim();

    if (!teamId || !sessionId) {
      return NextResponse.json(
        { success: false, message: "Missing teamId or sessionId." },
        { status: 400 },
      );
    }

    // ── Step 1: Retrieve Conversation History via ES|QL ──────────────
    const conversationResult = await runESQL(`
FROM support_conversations
| WHERE teamId == "${teamId}"
| WHERE sessionId == "${sessionId}"
| KEEP role, message, createdAt
| SORT createdAt ASC
| LIMIT 20
    `);

    const convCols = (conversationResult as any)?.columns?.map((c: any) => c.name) || [];
    const messages = ((conversationResult as any)?.values || []).map((row: any[]) => {
      const obj: Record<string, any> = {};
      convCols.forEach((col: string, i: number) => {
        obj[col] = row[i];
      });
      return obj;
    });

    // ── Step 2: Get Ticket Stats for Context ─────────────────────────
    const ticketStatsResult = await runESQL(`
FROM support_tickets
| WHERE teamId == "${teamId}"
| STATS
    total = COUNT(*),
    open_tickets = COUNT(*) WHERE status == "open",
    in_progress = COUNT(*) WHERE status == "in_progress",
    resolved = COUNT(*) WHERE status == "resolved"
    `);

    const statsCols = (ticketStatsResult as any)?.columns?.map((c: any) => c.name) || [];
    const statsRow = (ticketStatsResult as any)?.values?.[0] || [];
    const ticketStats: Record<string, number> = {};
    statsCols.forEach((col: string, i: number) => {
      ticketStats[col] = Number(statsRow[i] || 0);
    });

    // ── Step 3: Agent Analysis ───────────────────────────────────────
    const agentId =
      process.env.ELASTIC_ESCALATION_AGENT_ID ||
      "omega_smart_escalation";

    const conversationText = messages
      .map((m: any) => `[${m.role}]: ${m.message}`)
      .join("\n");

    const agentPrompt = `TEAM_ID=${teamId}
SESSION_ID=${sessionId}
ESCALATION_REASON=${escalationReason}
CUSTOMER=${customerName}

CONVERSATION HISTORY:
${conversationText || "No conversation history available."}

CURRENT TICKET QUEUE:
- Open tickets: ${ticketStats.open_tickets || 0}
- In progress: ${ticketStats.in_progress || 0}
- Total tickets: ${ticketStats.total || 0}

Analyze this escalation and provide your assessment.`;

    let agentAnalysis: any = null;
    try {
      const agentResponse = await invokeAgent({
        agentId,
        message: agentPrompt,
      });
      const rawMessage =
        (agentResponse as any)?.response?.message ||
        (agentResponse as any)?.message ||
        "";
      try {
        agentAnalysis = JSON.parse(rawMessage);
      } catch {
        agentAnalysis = {
          priority: "P2",
          issue_summary: rawMessage.slice(0, 200),
          customer_sentiment: "frustrated",
          escalation_reason: escalationReason,
          suggested_response_template:
            "Thank you for reaching out. I've escalated your request to our support team who will get back to you shortly.",
          requires_immediate_notification: false,
          recommended_team: "support",
        };
      }
    } catch {
      agentAnalysis = {
        priority: "P2",
        issue_summary: "Customer escalation from support chat",
        customer_sentiment: "frustrated",
        escalation_reason: escalationReason,
        suggested_response_template:
          "Thank you for your patience. Our team has been notified and will follow up with you directly.",
        requires_immediate_notification: false,
        recommended_team: "support",
      };
    }

    const priority = agentAnalysis?.priority || "P2";

    // ── Step 4: Create Priority Support Ticket ───────────────────────
    const ticket = await createSupportTicket({
      teamId,
      source: "omega_escalation",
      sessionId,
      language,
      customerName,
      customerEmail: customerEmail || "unknown@customer.com",
      subject: `[${priority}] ${agentAnalysis?.issue_summary || "Support escalation"}`,
      description: `Automated escalation from Omega Smart Escalation Workflow.

Priority: ${priority}
Reason: ${agentAnalysis?.escalation_reason || escalationReason}
Customer Sentiment: ${agentAnalysis?.customer_sentiment || "unknown"}
Recommended Team: ${agentAnalysis?.recommended_team || "support"}

Issue Summary:
${agentAnalysis?.issue_summary || "See conversation history."}

Suggested Response:
${agentAnalysis?.suggested_response_template || "N/A"}

Conversation Messages: ${messages.length}`,
    });

    // ── Step 5: Conditional Slack Notification ───────────────────────
    let slackSent = false;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    const shouldNotify =
      agentAnalysis?.requires_immediate_notification ||
      priority === "P0" ||
      priority === "P1";

    if (webhookUrl && shouldNotify) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `Omega Escalation [${priority}]: ${agentAnalysis?.issue_summary || "Customer needs help"}`,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Omega Smart Escalation* :rotating_light:\n*Priority:* ${priority}\n*Customer:* ${customerName}\n*Team:* ${agentAnalysis?.recommended_team || "support"}`,
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Issue:*\n${agentAnalysis?.issue_summary || "See ticket for details"}`,
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Sentiment:* ${agentAnalysis?.customer_sentiment || "unknown"}\n*Ticket ID:* ${ticket.id}`,
                },
              },
            ],
          }),
        });
        slackSent = true;
      } catch {
        // Continue even if Slack fails
      }
    }

    // ── Step 6: Audit Log ────────────────────────────────────────────
    await createActionAuditLog({
      teamId,
      action: "smart_escalation_workflow",
      status: "success",
      detail: JSON.stringify({
        priority,
        session_id: sessionId,
        ticket_id: ticket.id,
        customer_sentiment: agentAnalysis?.customer_sentiment,
        recommended_team: agentAnalysis?.recommended_team,
        immediate_notification: shouldNotify,
        slack_sent: slackSent,
        messages_analyzed: messages.length,
      }),
    });

    return NextResponse.json({
      success: true,
      escalation: {
        priority,
        ticket_id: ticket.id,
        analysis: agentAnalysis,
        actions_taken: {
          ticket_created: true,
          slack_notified: slackSent,
          audit_logged: true,
        },
        conversation_messages_analyzed: messages.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Smart escalation workflow failed." },
      { status: 500 },
    );
  }
}
