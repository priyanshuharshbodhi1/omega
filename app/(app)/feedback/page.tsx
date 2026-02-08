import ListFeedback from "./list-feedback";
import SummaryFeedback from "./summary-feedback";

export default function Dashboard() {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-bold text-xl">Feedback</h1>
        <SummaryFeedback />
      </div>

      <ListFeedback/>
    </>
  );
}
