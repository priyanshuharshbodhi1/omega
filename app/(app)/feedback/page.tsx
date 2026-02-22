import ListFeedback from "./list-feedback";
import SummaryFeedback from "./summary-feedback";

export default function Dashboard() {
  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <SummaryFeedback />
      </div>

      <ListFeedback />
    </>
  );
}
