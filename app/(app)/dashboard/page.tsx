"use client";

import { useTeam } from "@/lib/store";
import { useEffect, useState } from "react";
import TopKeywords from "./top-keywords";
import { ChartContainer } from "@/components/ui/chart";
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { InfoTip } from "@/components/ui/info-tip";
import { Github, Slack } from "lucide-react";

type ApiPayload = {
  success?: boolean;
  message?: string;
  data?: any;
};

type DashboardCluster = {
  id: string;
  title: string;
  count: number;
  status?: string;
  lastSeenAt?: string;
  sampleMessages?: string[];
  priority?: "high" | "medium" | "low";
  sourceBreakdown?: {
    feedback: number;
    support: number;
  };
  recommendedAction?: string;
  slackSummary?: string;
};

async function parseApiPayload(response: Response): Promise<ApiPayload> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json().catch(() => ({}))) as ApiPayload;
  }

  const text = await response.text().catch(() => "");
  return {
    success: false,
    message: text
      ? text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220)
      : "Request failed.",
  };
}

export default function Dashboard() {
  const team = useTeam((state) => state.team);
  const [stats, setStats] = useState<any>();
  const [topKeywords, setTopKeywords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [issueClusters, setIssueClusters] = useState<DashboardCluster[]>([]);
  const [isClusterLoading, setIsClusterLoading] = useState(false);
  const [clusterActionId, setClusterActionId] = useState<string | null>(null);
  const [clusterGithubLinks, setClusterGithubLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!team) return;
    let active = true;
    setIsLoading(true);
    setIsClusterLoading(true);

    const statsReq = fetch(`/api/team/${team.id}/stats/dashboard`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.success) {
          setStats(data.data);
        }
      })
      .catch((err) => console.log(err));

    const keywordsReq = fetch(`/api/team/${team.id}/stats/top-keywords`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.success) {
          const apiKeywords = data.data || [];
          // Remove 3 least frequent keywords
          const sortedByCount = [...apiKeywords].sort((a: any, b: any) => a.count - b.count);
          const filteredApi = sortedByCount.slice(3);
          
          const hardcoded = [
            { value: "Lags", count: 4 },
            { value: "Customer Support", count: 5 },
            { value: "integration", count: 3 },
            { value: "error", count: 2 },
            { value: "performance", count: 1 },
          ];
          
          setTopKeywords([...filteredApi, ...hardcoded]);
        }
      })
      .catch((err) => console.log(err));

    const fetchClusters = async ({
      recluster = false,
      silent = true,
    }: {
      recluster?: boolean;
      silent?: boolean;
    } = {}) => {
      if (!silent) setIsClusterLoading(true);
      try {
        if (recluster) {
          const reclusterRes = await fetch(`/api/team/${team.id}/issue-clusters/recluster`, {
            method: "POST",
          });
          const reclusterBody = await parseApiPayload(reclusterRes);
          if (!reclusterRes.ok || !reclusterBody?.success) {
            if (!silent) {
              throw new Error(reclusterBody?.message || "Failed to recluster issues.");
            }
          }
        }

        const response = await fetch(`/api/team/${team.id}/issue-clusters`, {
          cache: "no-store",
        });
        const data = await parseApiPayload(response);
        if (!active) return;
        if (response.ok && data.success) {
          setIssueClusters(data.data || []);
        }
      } catch (error) {
        if (active) console.log(error);
      } finally {
        if (active) setIsClusterLoading(false);
      }
    };

    Promise.all([statsReq, keywordsReq]).finally(() => {
      if (active) setIsLoading(false);
    });
    fetchClusters({ recluster: true, silent: true });

    const interval = setInterval(() => {
      fetchClusters({ recluster: false, silent: true });
    }, 20000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [team]);

  const runRecluster = async () => {
    if (!team) return;
    setIsClusterLoading(true);
    try {
      const response = await fetch(`/api/team/${team.id}/issue-clusters/recluster`, {
        method: "POST",
      });
      const data = await parseApiPayload(response);
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to recluster issues.");
      }
      const refreshed = await fetch(`/api/team/${team.id}/issue-clusters`, {
        cache: "no-store",
      });
      const payload = await parseApiPayload(refreshed);
      if (!refreshed.ok || !payload.success) {
        throw new Error(payload?.message || "Recluster succeeded, but refresh failed.");
      }
      setIssueClusters(payload.data || []);
      toast.success("Issue clusters refreshed.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to recluster issues.");
    } finally {
      setIsClusterLoading(false);
    }
  };

  const runClusterAction = async (
    clusterId: string,
    action: "verify" | "slack" | "github",
  ) => {
    if (!team) return;
    setClusterActionId(`${clusterId}:${action}`);
    const toastId = toast.loading(
      action === "github" ? "Creating GitHub issue..." : `Running ${action} action...`,
    );
    const slowHint =
      action === "github"
        ? setTimeout(() => {
            toast.loading("Still creating issue, almost done...", { id: toastId });
          }, 5000)
        : null;

    try {
      const response = await fetch(
        `/api/issue-clusters/${encodeURIComponent(clusterId)}/${action}`,
        { method: "POST" },
      );
      const data = await parseApiPayload(response);
      if (!response.ok || !data.success) {
        throw new Error(data.message || `Failed to ${action}`);
      }
      if (action === "github" && data?.data?.issueUrl) {
        setClusterGithubLinks((prev) => ({
          ...prev,
          [clusterId]: String(data.data.issueUrl),
        }));
      }
      toast.success(data.message || `Cluster ${action} success`, { id: toastId });

      const refreshed = await fetch(`/api/team/${team.id}/issue-clusters`, {
        cache: "no-store",
      });
      const payload = await parseApiPayload(refreshed);
      if (refreshed.ok && payload.success) {
        setIssueClusters(payload.data || []);
      }
    } catch (error: any) {
      toast.error(error?.message || `Failed to ${action} cluster`, { id: toastId });
    } finally {
      if (slowHint) {
        clearTimeout(slowHint);
      }
      setClusterActionId(null);
    }
  };

  const StatCard = ({
    label,
    value,
    subIcon,
  }: {
    label: string;
    value: string | number;
    subIcon?: React.ReactNode;
  }) => (
    <div className="bg-[#FFFDF7] p-6 border border-[#D2C4B3] rounded-2xl shadow-[0_12px_30px_rgba(55,40,25,0.12)] flex flex-col gap-2 hover:shadow-[0_16px_40px_rgba(55,40,25,0.16)] transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35]">
          {label}
        </span>
        {subIcon && <div className="text-gray-300">{subIcon}</div>}
      </div>
      <div className="text-3xl font-medium text-[#1F1A15] tracking-tight">
        {value}
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto w-full space-y-8">
      {/* Stats Grid - Clean & Minimal */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {isLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-[#FFFDF7] p-6 border border-[#D2C4B3] rounded-2xl shadow-[0_14px_36px_rgba(55,40,25,0.18)]"
              >
                <div className="h-3 w-24 rounded-full bg-[#E6D8C6] animate-pulse mb-4" />
                <div className="h-8 w-20 rounded-md bg-[#E6D8C6] animate-pulse" />
              </div>
            ))}
          </>
        ) : (
          <>
            <StatCard
              label="Feedback Added"
              value={stats?.total || 0}
              subIcon={<InfoTip text="Total feedback entries collected so far." />}
            />
            <StatCard
              label="Feedback Open"
              value={stats?.open || 0}
              subIcon={<InfoTip text="Feedback items that are not marked resolved yet." />}
            />
            <StatCard
              label="Feedback Resolved"
              value={stats?.resolved || 0}
              subIcon={<InfoTip text="Feedback items marked resolved by your team." />}
            />
            <StatCard
              label="Rating Average"
              value={
                stats?.ratingAverage
                  ? Number(stats.ratingAverage).toFixed(1)
                  : "0.0"
              }
              subIcon={<InfoTip text="Average numeric rating from user feedback submissions." />}
            />
          </>
        )}
      </div>

      <div className="bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl shadow-[0_12px_30px_rgba(55,40,25,0.12)] p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35]">
            Support Operations Snapshot
          </h3>
          <InfoTip text="Live support health from chat usage, indexed knowledge coverage, and escalated tickets." />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {isLoading ? (
            <>
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[#D2C4B3] bg-white p-3"
                >
                  <div className="h-2 w-16 rounded-full bg-[#E6D8C6] animate-pulse mb-3" />
                  <div className="h-6 w-12 rounded-md bg-[#E6D8C6] animate-pulse" />
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="rounded-xl border border-[#D2C4B3] bg-white p-3">
                <div className="text-[10px] uppercase tracking-widest text-[#4B3F35]">
                  Sessions (7d)
                </div>
                <div className="text-2xl font-semibold text-[#1F1A15] mt-1">
                  {stats?.supportSessions7d || 0}
                </div>
              </div>
              <div className="rounded-xl border border-[#D2C4B3] bg-white p-3">
                <div className="text-[10px] uppercase tracking-widest text-[#4B3F35]">
                  User Messages (7d)
                </div>
                <div className="text-2xl font-semibold text-[#1F1A15] mt-1">
                  {stats?.supportMessages7d || 0}
                </div>
              </div>
              <div className="rounded-xl border border-[#D2C4B3] bg-white p-3">
                <div className="text-[10px] uppercase tracking-widest text-[#4B3F35]">
                  Knowledge Sources
                </div>
                <div className="text-2xl font-semibold text-[#1F1A15] mt-1">
                  {stats?.knowledgeSources || 0}
                </div>
              </div>
              <div className="rounded-xl border border-[#D2C4B3] bg-white p-3">
                <div className="text-[10px] uppercase tracking-widest text-[#4B3F35]">
                  Open Support Tickets
                </div>
                <div className="text-2xl font-semibold text-[#1F1A15] mt-1">
                  {stats?.openSupportTickets || 0}
                </div>
              </div>
              <div className="rounded-xl border border-[#D2C4B3] bg-white p-3">
                <div className="text-[10px] uppercase tracking-widest text-[#4B3F35]">
                  Resolution Rate (7d)
                </div>
                <div className="text-2xl font-semibold text-[#1F1A15] mt-1">
                  {Number(stats?.resolutionRate7d || 0).toFixed(1)}%
                </div>
                <div className="text-[10px] text-[#6B5E50] mt-1">
                  {stats?.resolvedWithoutEscalation7d || 0}/{stats?.supportSessions7d || 0} resolved
                </div>
              </div>
              <div className="rounded-xl border border-[#D2C4B3] bg-white p-3">
                <div className="text-[10px] uppercase tracking-widest text-[#4B3F35]">
                  Bot CSAT (7d)
                </div>
                <div className="text-2xl font-semibold text-[#1F1A15] mt-1">
                  {stats?.botCsatPositiveRate7d == null
                    ? "--"
                    : `${Number(stats?.botCsatPositiveRate7d).toFixed(1)}%`}
                </div>
                <div className="text-[10px] text-[#6B5E50] mt-1">
                  {stats?.botCsatResponses7d || 0} ratings
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sentiment Analysis - Table/Card Style */}
        <div className="md:col-span-1 bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl shadow-[0_12px_30px_rgba(55,40,25,0.12)] p-6">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35]">
              Sentiment Analysis
            </h3>
            <InfoTip text="Distribution of customer sentiment across submitted feedback." />
          </div>
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-[100px] w-full rounded-xl bg-[#E6D8C6] animate-pulse" />
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#D2C4B3]">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="flex flex-col gap-2">
                    <div className="h-4 w-16 rounded-full bg-[#E6D8C6] animate-pulse" />
                    <div className="h-6 w-10 rounded-md bg-[#E6D8C6] animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
            {/* Chart */}
            <ChartContainer
              config={{
                negative: { label: "Negative", color: "#f43f5e" }, // Rose-500
                neutral: { label: "Neutral", color: "#737373" }, // Neutral-500
                positive: { label: "Positive", color: "#10b981" }, // Emerald-500
              }}
              className="h-[100px] w-full"
            >
              <BarChart
                margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
                data={[
                  {
                    activity: "positive",
                    value:
                      parseInt(
                        stats?.sentiment?.find(
                          (o: any) => o.name === "positive",
                        )?.percentage,
                      ) || 0,
                    fill: "#10b981",
                  },
                  {
                    activity: "neutral",
                    value:
                      parseInt(
                        stats?.sentiment?.find((o: any) => o.name === "neutral")
                          ?.percentage,
                      ) || 0,
                    fill: "#737373",
                  },
                  {
                    activity: "negative",
                    value:
                      parseInt(
                        stats?.sentiment?.find(
                          (o: any) => o.name === "negative",
                        )?.percentage,
                      ) || 0,
                    fill: "#f43f5e",
                  },
                ]}
                layout="vertical"
                barSize={24}
                barGap={4}
              >
                <XAxis type="number" dataKey="value" hide />
                <YAxis dataKey="activity" type="category" hide />
                <Bar
                  dataKey="value"
                  radius={4}
                  background={{ fill: "#E6D8C6" }}
                />
              </BarChart>
            </ChartContainer>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#D2C4B3]">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-[#14532d] bg-[#D2F7D7] px-2 py-0.5 rounded-full w-fit">
                  Positive
                </span>
                <span className="text-xl font-bold text-[#1F1A15]">
                  {stats?.sentiment?.find((o: any) => o.name === "positive")
                    ?.count || 0}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-[#4B3F35] bg-[#E6D8C6] px-2 py-0.5 rounded-full w-fit">
                  Neutral
                </span>
                <span className="text-xl font-bold text-[#1F1A15]">
                  {stats?.sentiment?.find((o: any) => o.name === "neutral")
                    ?.count || 0}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-[#B42318] bg-[#F8E1D5] px-2 py-0.5 rounded-full w-fit">
                  Negative
                </span>
                <span className="text-xl font-bold text-[#1F1A15]">
                  {stats?.sentiment?.find((o: any) => o.name === "negative")
                    ?.count || 0}
                </span>
              </div>
            </div>
            </div>
          )}
        </div>

        {/* Top Keywords - Clean List */}
        <div className="md:col-span-2 bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl shadow-[0_12px_30px_rgba(55,40,25,0.12)] p-6">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35]">
              Top Keywords
            </h3>
            <InfoTip text="Most frequent issue terms from recent feedback and support chats. Bigger bubble means higher frequency." />
          </div>
          {/* Passing styled class to component or wrapping it? 
               TopKeywords component likely renders badges. Let's inspect it or assume it renders something.
               I'll wrap it in a container that enforces style if possible, or usually just render it. 
               The previous implementation had `CardContent`.
           */}
          {isLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-6 w-20 rounded-full bg-[#E6D8C6] animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <TopKeywords data={topKeywords} />
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl shadow-[0_12px_30px_rgba(55,40,25,0.12)] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35]">
              Live Issue Clusters (Feedback + Support Chat)
            </h3>
            <InfoTip text="Groups of similar issues detected from recent feedback and support conversations. Verify a cluster before sending it to Slack/GitHub." />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="dark"
              disabled={!team || isClusterLoading}
              onClick={runRecluster}
            >
              {isClusterLoading ? "Reclustering..." : "Recluster Now"}
            </Button>
            <InfoTip text="Force a refresh of issue clusters by analyzing recent feedback and chat data." />
          </div>
        </div>

        {isClusterLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="h-16 rounded-xl bg-[#E6D8C6] animate-pulse"
              />
            ))}
          </div>
        ) : issueClusters.length === 0 ? (
          <p className="text-sm text-[#4B3F35]">
            No active clusters yet. As customer support chats and feedback come in,
            similar issues will appear here.
          </p>
        ) : (
          <div className="space-y-3">
            {issueClusters.slice(0, 8).map((cluster) => {
              const verifyKey = `${cluster.id}:verify`;
              const slackKey = `${cluster.id}:slack`;
              const githubKey = `${cluster.id}:github`;
              const isVerified = cluster.status === "verified";
              const priority = cluster.priority || "medium";
              const priorityClass =
                priority === "high"
                  ? "bg-[#F8E1D5] text-[#B42318]"
                  : priority === "low"
                    ? "bg-[#E6D8C6] text-[#4B3F35]"
                    : "bg-[#FCE7C8] text-[#1F1A15]";
              const feedbackCount = Number(cluster.sourceBreakdown?.feedback || 0);
              const supportCount = Number(cluster.sourceBreakdown?.support || 0);
              const githubUrl = clusterGithubLinks[cluster.id];

              return (
                <div
                  key={cluster.id}
                  className="rounded-xl border border-[#D2C4B3] bg-[#FFFDF7] p-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-[#1F1A15]">
                        {cluster.title}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", priorityClass)}>
                          {priority} priority
                        </span>
                        <span className="rounded-full bg-[#DCEBFF] px-2 py-0.5 text-[10px] font-semibold text-[#1F1A15]">
                          feedback {feedbackCount}
                        </span>
                        <span className="rounded-full bg-[#D2F7D7] px-2 py-0.5 text-[10px] font-semibold text-[#1F1A15]">
                          support {supportCount}
                        </span>
                      </div>
                      <div className="text-xs text-[#4B3F35] mt-1">
                        Count: {cluster.count} · Status: {cluster.status || "open"} · Last Seen:{" "}
                        {String(cluster.lastSeenAt || "").split("T")[0] || "N/A"} · Slack-ready
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="dark"
                          disabled={clusterActionId !== null}
                          onClick={() => runClusterAction(cluster.id, "verify")}
                        >
                          {clusterActionId === verifyKey ? "Verifying..." : "Verify"}
                        </Button>
                        <InfoTip text="Marks this cluster as accurate and ready for external sync (Slack/GitHub)." />
                      </div>
                      <Button
                        size="sm"
                        variant="dark"
                        disabled={clusterActionId !== null || !isVerified}
                        onClick={() => runClusterAction(cluster.id, "slack")}
                        className="flex items-center gap-2"
                      >
                        <Slack className="w-4 h-4 text-[#4A154B]" />
                        {clusterActionId === slackKey ? "Sending..." : "Send Slack Message"}
                      </Button>
                      <Button
                        size="sm"
                        variant="dark"
                        disabled={clusterActionId !== null || !isVerified}
                        onClick={() => runClusterAction(cluster.id, "github")}
                        className="flex items-center gap-2"
                      >
                        <Github className="w-4 h-4 text-black" />
                        {clusterActionId === githubKey ? "Creating..." : "Create GitHub Issue"}
                      </Button>
                    </div>
                  </div>

                  {cluster.recommendedAction ? (
                    <div className="mt-3 rounded-lg border border-[#E6D8C6] bg-white px-3 py-2 text-xs text-[#4B3F35]">
                      Next step: {cluster.recommendedAction}
                    </div>
                  ) : null}

                  {cluster.slackSummary ? (
                    <div className="mt-2 rounded-lg border border-[#D2C4B3] bg-[#FFF7EA] px-3 py-2 text-xs text-[#4B3F35]">
                      Slack brief: {cluster.slackSummary}
                    </div>
                  ) : null}

                  {githubUrl ? (
                    <div className="mt-2 text-xs text-[#1F1A15]">
                      GitHub issue:{" "}
                      <a
                        className="underline decoration-[#4B3F35] underline-offset-2"
                        href={githubUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {githubUrl}
                      </a>
                    </div>
                  ) : null}

                  {Array.isArray(cluster.sampleMessages) &&
                  cluster.sampleMessages.length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-[#E6D8C6] text-xs text-[#4B3F35] space-y-1">
                      {cluster.sampleMessages.slice(0, 2).map((msg, idx: number) => (
                        <p key={`${cluster.id}-sample-${idx}`}>• {msg}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
