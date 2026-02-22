"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Rating from "@/components/ui/rating";
import { ExternalLink, Github, Loader2, SmilePlus } from "lucide-react";
import { marked } from "marked";
import moment from "moment";
import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function Page({ params }: { params: { id: string } }) {
  const id = params.id;
  const [feedback, setFeedback] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchFeedback = async () => {
      setIsLoading(true);
      fetch(`/api/feedback/${id}`)
        .then((res) => res.json())
        .then((data) => {
          if (!active) return;
          if (data.success) {
            setFeedback(data.data);
            setIssueUrl(data.data?.githubIssueUrl || null);
          } else {
            toast.error(data.message);
          }
        })
        .catch((err) => {
          console.log(err);
        })
        .finally(() => {
          if (active) {
            setIsLoading(false);
          }
        });
    };

    fetchFeedback();

    return () => {
      active = false;
    };
  }, [id]);

  const handleCreateGithubIssue = async () => {
    if (isCreatingIssue || isLoading) return;

    const confirmed = window.confirm(
      "Create a GitHub issue from this feedback using the Elastic workflow tool?",
    );
    if (!confirmed) return;

    setIsCreatingIssue(true);
    const toastId = toast.loading("Creating GitHub issue...");

    try {
      const res = await fetch(`/api/feedback/${id}/github-issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to create GitHub issue");
      }

      setIssueUrl(data?.data?.issueUrl || null);
      if (data?.data?.issueUrl) {
        toast.success("GitHub issue created successfully.", { id: toastId });
      } else {
        toast.success("Agent responded. Could not parse issue URL.", {
          id: toastId,
        });
      }
    } catch (error) {
      toast.error((error as Error).message, { id: toastId });
    } finally {
      setIsCreatingIssue(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35] mb-2">
            Feedback
          </div>
          <h1 className="font-medium text-2xl text-[#1F1A15]">
            Feedback Detail
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {issueUrl ? (
            <a
              href={issueUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center rounded-md border border-[#D2C4B3] bg-[#FFFDF7] px-3 text-sm font-medium text-[#1F1A15] transition-colors hover:bg-[#E6D8C6]"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Issue
            </a>
          ) : null}
          <Button
            onClick={handleCreateGithubIssue}
            disabled={isLoading || isCreatingIssue}
          >
            {isCreatingIssue ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Github className="mr-2 h-4 w-4" />
            )}
            Create GitHub Issue
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card className="sm:col-span-2 mb-6">
            <CardHeader className="flex flex-col md:flex-row justify-between items-center border-b border-[#D2C4B3] bg-[#F4EBDD] px-6 py-4">
              <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35]">
                User Feedback
              </CardTitle>
              {isLoading ? (
                <div className="h-5 w-20 rounded-md bg-[#E6D8C6] animate-pulse" />
              ) : (
                <Rating value={feedback?.rate ?? 0} />
              )}
            </CardHeader>
            <CardContent className="prose pt-6 text-[#1F1A15]">
              {isLoading ? (
                <div className="space-y-3">
                  <div className="h-4 w-full rounded-full bg-[#E6D8C6] animate-pulse" />
                  <div className="h-4 w-5/6 rounded-full bg-[#E6D8C6] animate-pulse" />
                  <div className="h-4 w-2/3 rounded-full bg-[#E6D8C6] animate-pulse" />
                </div>
              ) : (
                feedback?.description
              )}
            </CardContent>
          </Card>
          <Card className="sm:col-span-2">
            <CardHeader className="flex flex-col md:flex-row justify-between items-center border-b border-[#D2C4B3] bg-[#F4EBDD] px-6 py-4">
              <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35]">
                AI Generated Response
              </CardTitle>
              {isLoading ? (
                <div className="h-5 w-20 rounded-full bg-[#E6D8C6] animate-pulse" />
              ) : (
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] uppercase tracking-widest font-bold ${
                    feedback.sentiment === "positive" &&
                    "bg-[#D2F7D7] text-[#14532d]"
                  } ${
                    feedback.sentiment === "negative" &&
                    "bg-[#F8E1D5] text-[#B42318]"
                  } ${
                    feedback.sentiment === "neutral" &&
                    "bg-[#E6D8C6] text-[#4B3F35]"
                  }`}
                >
                  <SmilePlus className="w-3 h-3" />
                  {feedback.sentiment}
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-6 prose prose-p:text-sm prose-li:text-sm prose-h1:text-xl prose-h2:text-lg prose-h3:text-lg prose-h4:text-lg prose-h5:text-lg prose-h6:text-lg text-[#1F1A15]">
              {isLoading ? (
                <div className="space-y-3">
                  <div className="h-4 w-full rounded-full bg-[#E6D8C6] animate-pulse" />
                  <div className="h-4 w-full rounded-full bg-[#E6D8C6] animate-pulse" />
                  <div className="h-4 w-3/4 rounded-full bg-[#E6D8C6] animate-pulse" />
                  <div className="h-4 w-11/12 rounded-full bg-[#E6D8C6] animate-pulse" />
                </div>
              ) : feedback?.aiResponse ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: marked(feedback.aiResponse),
                  }}
                ></div>
              ) : (
                <p className="text-sm text-[#4B3F35]">
                  No AI generated response available for this feedback.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        <div>
          <Card className="overflow-hidden mb-6">
            <CardContent className="p-6 text-sm text-[#1F1A15]">
              <div className="grid gap-3">
                <div className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35]">
                  Customer Information
                </div>
                <dl className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <dt className="text-[#4B3F35]">Name</dt>
                    {isLoading ? (
                      <div className="h-4 w-20 rounded-full bg-[#E6D8C6] animate-pulse" />
                    ) : (
                      <dd>{feedback?.customerName || "Anonymous"}</dd>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-[#4B3F35]">Email</dt>
                    {isLoading ? (
                      <div className="h-4 w-32 rounded-full bg-[#E6D8C6] animate-pulse" />
                    ) : (
                      <dd>
                        {feedback?.customerEmail ? (
                          <a href={`mailto:${feedback.customerEmail}`}>
                            {feedback.customerEmail}
                          </a>
                        ) : (
                          "-"
                        )}
                      </dd>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-[#4B3F35]">Phone</dt>
                    {isLoading ? (
                      <div className="h-4 w-24 rounded-full bg-[#E6D8C6] animate-pulse" />
                    ) : (
                      <dd>
                        {feedback?.customerPhone ? (
                          <a href={`tel:${feedback.customerPhone}`}>
                            {feedback.customerPhone}
                          </a>
                        ) : (
                          "-"
                        )}
                      </dd>
                    )}
                  </div>
                </dl>
              </div>
            </CardContent>
            <CardFooter className="flex flex-row items-center border-t border-[#D2C4B3] bg-[#F4EBDD] px-6 py-3">
              <div className="text-xs text-[#4B3F35]">
                {isLoading ? (
                  <div className="h-4 w-40 rounded-full bg-[#E6D8C6] animate-pulse" />
                ) : (
                  <>
                    Submitted at{" "}
                    <time
                      dateTime={moment(feedback?.createdAt).format("YYYY-MM-DD")}
                    >
                      {moment(feedback?.createdAt).format("MMMM D, YYYY")}
                    </time>
                  </>
                )}
              </div>
            </CardFooter>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="flex flex-col md:flex-row justify-between items-center border-b border-[#D2C4B3] bg-[#F4EBDD] px-6 py-4">
              <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35]">
                Related Feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-sm space-y-3 text-[#1F1A15]">
              {isLoading ? (
                <>
                  <div className="h-4 w-full rounded-full bg-[#E6D8C6] animate-pulse" />
                  <div className="h-4 w-11/12 rounded-full bg-[#E6D8C6] animate-pulse" />
                  <div className="h-4 w-10/12 rounded-full bg-[#E6D8C6] animate-pulse" />
                </>
              ) : feedback?.relateds?.length > 0 ? (
                feedback?.relateds?.map((r: any) => (
                  <Link
                    href={`/feedback/${r.id}`}
                    key={r.id}
                    className={`line-clamp-2 border-l-4 pl-3 ${r.sentiment === "positive" && "border-[#2D6A4F]"} ${
                      r.sentiment === "negative" && "border-[#B42318]"
                    } ${
                      r.sentiment === "neutral" && "border-[#4B3F35]"
                    }`}
                  >
                    <div>{r.description}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-[#7A6E62]">
                      {r.rate ? `${r.rate}★` : "N/A"} •{" "}
                      {r.createdAt
                        ? moment(r.createdAt).format("MMM D, YYYY")
                        : "Unknown date"}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-sm text-[#4B3F35]">
                  No related feedback found for this item yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
