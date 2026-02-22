import { auth } from "@/auth";
import Chat from "./chat";

export default async function Dashboard() {
  const session = await auth();

  return (
    <>
      <div className="relative">
        <Chat session={session} />
      </div>
    </>
  );
}
