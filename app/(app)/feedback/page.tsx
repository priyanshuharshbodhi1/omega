import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import ListFeedback from "./list-feedback";
import SummaryFeedback from "./summary-feedback";

export default function Dashboard() {
  return (
    <>
      <div className="flex items-center justify-end gap-2 mb-4">
        <Link
          href="/feedback/arya-escalations"
          className={buttonVariants({ variant: "dark" })}
        >
          Arya Escalations
        </Link>
        <SummaryFeedback />
      </div>

      <ListFeedback />
    </>
  );
}
