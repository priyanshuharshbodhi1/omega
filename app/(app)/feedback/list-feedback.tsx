"use client";

import { useTeam } from "@/lib/store";
import { MessageSquareText, SmilePlus, Star } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import moment from "moment";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ListFeedback() {
  const team = useTeam((state) => state.team);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const getFeedbacks = async (teamId: string) => {
      setIsLoading(true);
      fetch(`/api/team/${teamId}/feedbacks`)
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            setFeedbacks(data.data);
          } else {
            toast.error(data.message);
          }
        })
        .catch((error) => {
          toast.error(error.message);
        })
        .finally(() => {
          setIsLoading(false);
        });
    };

    if (team) {
      getFeedbacks(team.id);
    }
  }, [team]);

  return (
    <>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-[#FFFDF7] rounded-xl border border-[#D2C4B3] p-4 shadow-[0_10px_26px_rgba(55,40,25,0.12)]"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-3 w-24 rounded-full bg-[#E6D8C6] animate-pulse" />
                <div className="h-3 w-12 rounded-full bg-[#E6D8C6] animate-pulse" />
              </div>
              <div className="h-3 w-full rounded-full bg-[#E6D8C6] animate-pulse mb-2" />
              <div className="h-3 w-5/6 rounded-full bg-[#E6D8C6] animate-pulse mb-4" />
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-[#E6D8C6] animate-pulse" />
                <div className="h-5 w-10 rounded-full bg-[#E6D8C6] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : feedbacks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {feedbacks.map((i) => (
            <Link
              href={`/feedback/${i.id}`}
              key={i.id}
              className="bg-[#FFFDF7] flex flex-col items-start gap-2 rounded-xl border border-[#D2C4B3] p-4 text-left text-sm shadow-[0_10px_26px_rgba(55,40,25,0.12)] hover:shadow-[0_14px_32px_rgba(55,40,25,0.16)] transition-all"
            >
              <div className="flex w-full flex-col gap-1">
                <div className="flex items-center">
                  <div className="flex items-center gap-2">
                  <div className="font-semibold text-[#1F1A15]">Anonymous</div>
                  </div>
                  <div className="ml-auto text-xs text-[#4B3F35]">{moment(i.createdAt).fromNow()}</div>
                </div>
              </div>
              <div className="line-clamp-2 text-xs text-[#4B3F35]">{i.description}</div>
              <div className="flex items-center gap-2">
                <div
                  className={`size-5 justify-center flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-bold ${
                    i.sentiment === "positive" && "bg-[#D2F7D7] text-[#14532d]"
                  } ${i.sentiment === "negative" && "bg-[#F8E1D5] text-[#B42318]"} ${i.sentiment === "neutral" && "bg-[#E6D8C6] text-[#4B3F35]"}`}
                >
                  <SmilePlus className="w-3 h-3" />
                  {/* {i.sentiment} */}
                </div>
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#E6D8C6]">
                  <Star className="w-3 h-3" />
                  {i.rate}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto bg-[#FFFDF7] rounded-2xl w-full mt-12 text-center p-12 border border-[#D2C4B3] shadow-[0_12px_30px_rgba(55,40,25,0.12)]">
          <div className="size-36 grid place-content-center bg-gradient-to-t from-[#E6D8C6] rounded-full mx-auto mb-6">
            <MessageSquareText className="size-20" />
          </div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35] mb-2">
            No Feedback Yet
          </div>
          <h2 className="font-medium text-xl mb-6 text-[#1F1A15]">
            You haven&apos;t gotten any feedback yet
          </h2>
          <div className="flex items-center justify-center gap-4">
            <Button variant="dark">
              <Link href="/widgets">Setup Widgets</Link>
            </Button>
            <Button variant="dark">
              <Link href="/integrations">Install Widgets</Link>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
