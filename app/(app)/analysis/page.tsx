import { auth } from "@/auth";
import Chat from "./chat";

export default async function Dashboard() {
  const session = await auth();

  return (
    <>
      <div className="flex items-center justify-center mb-4">
        <h1 className="font-bold text-xl">AI Analysis</h1>
      </div>

      <div className="relative">
        <Chat session={session} />
      </div>
    </>
  );
}
