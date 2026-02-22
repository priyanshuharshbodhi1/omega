"use client";

import { useTeam } from "@/lib/store";
import { useEffect, useState } from "react";
import TopKeywords from "./top-keywords";
import { ChartContainer } from "@/components/ui/chart";
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const team = useTeam((state) => state.team);
  const [stats, setStats] = useState<any>();
  const [topKeywords, setTopKeywords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!team) return;
    let active = true;
    setIsLoading(true);

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
          setTopKeywords(data.data);
        }
      })
      .catch((err) => console.log(err));

    Promise.all([statsReq, keywordsReq]).finally(() => {
      if (active) setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [team]);

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
            <StatCard label="Feedback Added" value={stats?.total || 0} />
            <StatCard label="Feedback Open" value={stats?.open || 0} />
            <StatCard label="Feedback Resolved" value={stats?.resolved || 0} />
            <StatCard
              label="Rating Average"
              value={
                stats?.ratingAverage
                  ? Number(stats.ratingAverage).toFixed(1)
                  : "0.0"
              }
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sentiment Analysis - Table/Card Style */}
        <div className="md:col-span-1 bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl shadow-[0_12px_30px_rgba(55,40,25,0.12)] p-6">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35] mb-6">
            Sentiment Analysis
          </h3>
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
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35] mb-6">
            Top Keywords
          </h3>
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
    </div>
  );
}
