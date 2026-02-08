"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Rating from "@/components/ui/rating";
import { SmilePlus } from "lucide-react";
import { marked } from "marked";
import moment from "moment";
import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function Page({ params }: { params: { id: string } }) {
  const id = params.id;
  const [feedback, setFeedback] = useState<any>({});

  useEffect(() => {
    const fetchFeedback = async () => {
      fetch(`/api/feedback/${id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setFeedback(data.data);
          } else {
            toast.error(data.message);
          }
        })
        .catch((err) => {
          console.log(err);
        });
    };

    fetchFeedback();
  }, [id]);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-bold text-xl">Feedback Detail</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card className="sm:col-span-2 mb-5">
            <CardHeader className="flex flex-col md:flex-row justify-between items-center border-b bg-gray-50 px-6 py-3">
              <CardTitle className="font-semibold text-base">User Feedback</CardTitle>
              <Rating value={feedback?.rate ?? 0} />
            </CardHeader>
            <CardContent className="prose pt-4">{feedback?.description}</CardContent>
          </Card>
          <Card className="sm:col-span-2">
            <CardHeader className="flex flex-col md:flex-row justify-between items-center border-b bg-gray-50 px-6 py-3">
              <CardTitle className="font-semibold text-base">AI Generated Response</CardTitle>
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] capitalize ${
                  feedback.sentiment === "positive" && "bg-[#00dc94] text-white"
                } ${feedback.sentiment === "negative" && "bg-[#f70030] text-white"} ${feedback.sentiment === "neutral" && "bg-gray-900 text-white"}`}
              >
                <SmilePlus className="w-3 h-3" />
                {feedback.sentiment}
              </div>
            </CardHeader>
            <CardContent className="pt-4 prose prose-p:text-sm prose-li:text-sm prose-h1:text-xl prose-h2:text-lg prose-h3:text-lg prose-h4:text-lg prose-h5:text-lg prose-h6:text-lg">
              <div dangerouslySetInnerHTML={{ __html: marked(feedback?.aiResponse ?? "") }}></div>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card className="overflow-hidden mb-5">
            <CardContent className="p-6 text-sm">
              <div className="grid gap-3">
                <div className="font-semibold">Customer Information</div>
                <dl className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Name</dt>
                    <dd>Anonymous</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd>
                      <a href="mailto:">-</a>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd>
                      <a href="tel:">-</a>
                    </dd>
                  </div>
                </dl>
              </div>
            </CardContent>
            <CardFooter className="flex flex-row items-center border-t bg-gray-50 px-6 py-3">
              <div className="text-xs text-muted-foreground">
                Submitted at <time dateTime={moment(feedback?.createdAt).format("YYYY-MM-DD")}>{moment(feedback?.createdAt).format("MMMM D, YYYY")}</time>
              </div>
            </CardFooter>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="flex flex-col md:flex-row justify-between items-center border-b bg-gray-50 px-6 py-3">
              <CardTitle className="font-semibold text-base">Related Feedback</CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-sm space-y-3">
              {feedback?.relateds?.map((r: any) => (
                <Link
                  href={`/feedback/${r.metadata.feedbackId}`}
                  key={r.id}
                  className={`line-clamp-2 border-l-4 pl-2 ${r.metadata.sentiment === "positive" && "border-[#00dc94]"} ${
                    r.metadata.sentiment === "negative" && "border-[#f70030]"
                  } ${r.metadata.sentiment === "neutral" && "border-gray-900"}`}
                >
                  {r.content}
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
