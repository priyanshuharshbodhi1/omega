"use client";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { useTeam } from "@/lib/store";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

export default function SummaryFeedback() {
  const team = useTeam((state) => state.team);
  const [activeSentiment, setActiveSentiment] = useState<string>("");
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<{ all: any; positive: any; neutral: any; negative: any }>({
    all: null,
    positive: null,
    neutral: null,
    negative: null,
  });

  const handleSummarize = (sentiment: string) => {
    setActiveSentiment(sentiment);

		if ((sentiment === "all" && !summary.all) || (sentiment === "positive" && !summary.positive) || (sentiment === "neutral" && !summary.neutral) || (sentiment === "negative" && !summary.negative)) {
			setSummarizing(true);
			fetch(`/api/feedback/summary?teamId=${team?.id}&sentiment=${sentiment}`)
				.then((res) => res.json())
				.then((res) => {
					setSummarizing(false);
					if (res.success) {
						setSummary({ ...summary, [sentiment]: res.data });
					} else {
						toast.error(res.message);
					}
				})
				.catch((err) => {
					setSummarizing(false);
					toast.error("Failed to summarize feedback!");
				});
		}
  };

  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger className={`${buttonVariants({ variant: "brand" })} gap-2`}>
          <Sparkles className="w-4 h-4" />
          Summary
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Select Sentiment to Summarize</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="flex items-center gap-2 mb-4">
                <Button size="sm" disabled={summarizing} variant={activeSentiment === "all" ? "dark" : "outline"} onClick={() => handleSummarize("all")}>
                  All Sentiment
                </Button>
                <Button
                  size="sm"
                  disabled={summarizing}
                  variant={activeSentiment === "positive" ? "dark" : "outline"}
                  onClick={() => handleSummarize("positive")}
                >
                  Positive
                </Button>
                <Button
                  size="sm"
                  disabled={summarizing}
                  variant={activeSentiment === "neutral" ? "dark" : "outline"}
                  onClick={() => handleSummarize("neutral")}
                >
                  Neutral
                </Button>
                <Button
                  size="sm"
                  disabled={summarizing}
                  variant={activeSentiment === "negative" ? "dark" : "outline"}
                  onClick={() => handleSummarize("negative")}
                >
                  Negative
                </Button>
              </div>
              <div className="border border-dashed p-4 rounded-md">
                {summarizing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Summarizing...
                  </div>
                ) : (
                  <>
                    {activeSentiment === "all" && summary.all && <div className="whitespace-pre-line">{summary.all}</div>}
                    {activeSentiment === "positive" && summary.positive && <div className="whitespace-pre-line">{summary.positive}</div>}
                    {activeSentiment === "neutral" && summary.neutral && <div className="whitespace-pre-line">{summary.neutral}</div>}
                    {activeSentiment === "negative" && summary.negative && <div className="whitespace-pre-line">{summary.negative}</div>}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
