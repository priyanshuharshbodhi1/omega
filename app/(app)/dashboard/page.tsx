"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useTeam } from "@/lib/store";
import { Frown, Meh, MessageSquare, MessageSquareDashed, MessageSquarePlus, Smile, Star } from "lucide-react";
import { useEffect, useState } from "react";
import TopKeywords from "./top-keywords";
import { ChartContainer } from "@/components/ui/chart";
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import { Separator } from "@/components/ui/separator";

export default function Dashboard() {
  const team = useTeam((state) => state.team);
  const [stats, setStats] = useState<any>();
  const [topKeywords, setTopKeywords] = useState<any[]>([]);

  useEffect(() => {
    const getStats = async () => {
      fetch(`/api/team/${team.id}/stats/dashboard`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setStats(data.data);
          }
        })
        .catch((err) => console.log(err));
    };

    const getTopKeywords = async () => {
      fetch(`/api/team/${team.id}/stats/top-keywords`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setTopKeywords(data.data);
          }
        })
        .catch((err) => console.log(err));
    };

    if (team) {
      getStats();
      getTopKeywords();
    }
  }, [team]);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-bold text-xl">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feedback Added</CardTitle>
            <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feedback Open</CardTitle>
            <MessageSquareDashed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.open}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feedback Resolved</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.resolved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rating Average</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.ratingAverage}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
          <Card className="w-full">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-bold">Sentiment</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 border-t p-4 pb-2">
              <ChartContainer
                config={{
                  negative: {
                    label: "Negative",
                    color: "#f70030",
                  },
                  neutral: {
                    label: "Neutral",
                    color: "#333333",
                  },
                  positive: {
                    label: "Positive",
                    color: "#00dc94",
                  },
                }}
                className="h-[140px] w-full"
              >
                <BarChart
                  margin={{
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 10,
                  }}
                  data={[
                    {
                      activity: "positive",
                      value: parseInt(stats?.sentiment?.find((o: any) => o.name === "positive")?.percentage),
                      label: parseFloat(stats?.sentiment?.find((o: any) => o.name === "positive")?.percentage).toFixed(2) + "%",
                      fill: "#00dc94",
                    },
                    {
                      activity: "neutral",
                      value: parseInt(stats?.sentiment?.find((o: any) => o.name === "neutral")?.percentage),
                      label: parseFloat(stats?.sentiment?.find((o: any) => o.name === "neutral")?.percentage).toFixed(2) + "%",
                      fill: "#333333",
                    },
                    {
                      activity: "negative",
                      value: parseInt(stats?.sentiment?.find((o: any) => o.name === "negative")?.percentage),
                      label: parseFloat(stats?.sentiment?.find((o: any) => o.name === "negative")?.percentage).toFixed(2) + "%",
                      fill: "#f70030",
                    },
                  ]}
                  layout="vertical"
                  barSize={32}
                  barGap={2}
                >
                  <XAxis type="number" dataKey="value" hide />
                  <YAxis
                    dataKey="activity"
                    type="category"
                    tickLine={false}
                    tickMargin={4}
                    axisLine={false}
                    className="capitalize"
                  />
                  <Bar dataKey="value" radius={5}>
                    <LabelList
                      position="insideLeft"
                      dataKey="label"
                      fill="white"
                      offset={8}
                      fontSize={12}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
            <CardFooter className="flex flex-row border-t p-4">
              <div className="flex w-full items-center gap-2">
                <div className="grid flex-1 auto-rows-min gap-0.5">
                  <div className="text-xs text-muted-foreground">Positive</div>
                  <div className="flex items-baseline gap-1 text-2xl font-bold tabular-nums leading-none">
                    {stats?.sentiment?.find((o: any) => o.name === "positive")?.count}
                  </div>
                </div>
                <Separator orientation="vertical" className="mx-2 h-10 w-px" />
                <div className="grid flex-1 auto-rows-min gap-0.5">
                  <div className="text-xs text-muted-foreground">Neutral</div>
                  <div className="flex items-baseline gap-1 text-2xl font-bold tabular-nums leading-none">
                    {stats?.sentiment?.find((o: any) => o.name === "neutral")?.count}
                  </div>
                </div>
                <Separator orientation="vertical" className="mx-2 h-10 w-px" />
                <div className="grid flex-1 auto-rows-min gap-0.5">
                  <div className="text-xs text-muted-foreground">Negative</div>
                  <div className="flex items-baseline gap-1 text-2xl font-bold tabular-nums leading-none">
                    {stats?.sentiment?.find((o: any) => o.name === "negative")?.count}
                  </div>
                </div>
              </div>
            </CardFooter>
          </Card>
        </div>
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-bold">Top Keywords</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 border-t p-4 pb-2">
              <TopKeywords data={topKeywords} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
