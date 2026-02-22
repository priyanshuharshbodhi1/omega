"use client";

import { useTeam } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { updateTeam } from "@/lib/elasticsearch";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

// Client-side wrapper to call server action/API
// Since updateTeam is server-side code (uses esClient), we need to create a server action or API route.
// For simplicity in this Next.js app, I'll assume we can use a server action if configured,
// or I'll quickly make an API route.
// Actually, let's make a quick server action in a separate file or just an API route.
// Since I can't easily make a server action file right here without knowing the structure,
// I'll create a simple API route for updating team settings first.

export default function SettingsPage() {
  const { team, setTeam } = useTeam();
  const [loading, setLoading] = useState(false);
  const [tracker, setTracker] = useState<"github" | "linear">("github");

  useEffect(() => {
    if (team?.issueTracker) {
      setTracker(team.issueTracker);
    }
  }, [team]);

  const handleSave = async () => {
    if (!team) return;
    setLoading(true);
    try {
      const res = await fetch("/api/team/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: team.id,
          issueTracker: tracker,
        }),
      });

      if (!res.ok) throw new Error("Failed to update");

      const updatedTeam = await res.json();
      setTeam(updatedTeam);
      toast.success("Settings saved!");
    } catch (error) {
      toast.error("Failed to save settings");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl py-6">
      <div className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35] mb-2">
        Settings
      </div>
      <h1 className="text-2xl font-medium text-[#1F1A15] mb-6">
        Global Settings
      </h1>

      <Card className="border border-[#D2C4B3] rounded-2xl shadow-[0_12px_30px_rgba(55,40,25,0.12)]">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-[#4B3F35]">
            Issue Tracker Integration
          </CardTitle>
          <CardDescription className="text-sm text-[#1F1A15]">
            Choose where your AI agent should create tickets when asked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={tracker}
            onValueChange={(v) => setTracker(v as "github" | "linear")}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <div>
              <RadioGroupItem
                value="github"
                id="github"
                className="peer sr-only"
              />
              <Label
                htmlFor="github"
                className="flex flex-col items-center justify-between rounded-xl border-2 border-[#D2C4B3] bg-[#FFFDF7] p-4 hover:bg-[#E6D8C6] peer-data-[state=checked]:border-[#7C3AED] peer-data-[state=checked]:bg-[#F3E8FF] peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-[#7C3AED]/20 cursor-pointer transition-all"
              >
                <div className="mb-2 text-xl">🐙</div>
                <div className="font-semibold text-sm text-[#1F1A15]">
                  GitHub Issues
                </div>
                <div className="text-xs text-[#4B3F35] text-center mt-1">
                  Create issues in your connected repository.
                </div>
              </Label>
            </div>

            <div>
              <RadioGroupItem
                value="linear"
                id="linear"
                className="peer sr-only"
              />
              <Label
                htmlFor="linear"
                className="flex flex-col items-center justify-between rounded-xl border-2 border-[#D2C4B3] bg-[#FFFDF7] p-4 hover:bg-[#E6D8C6] peer-data-[state=checked]:border-[#7C3AED] peer-data-[state=checked]:bg-[#F3E8FF] peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-[#7C3AED]/20 cursor-pointer transition-all"
              >
                <div className="mb-2 text-xl">🔷</div>
                <div className="font-semibold text-sm text-[#1F1A15]">
                  Linear
                </div>
                <div className="text-xs text-[#4B3F35] text-center mt-1">
                  Create tickets in your Linear project.
                </div>
              </Label>
            </div>
          </RadioGroup>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
