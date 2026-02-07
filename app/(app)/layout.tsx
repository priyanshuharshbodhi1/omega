import { auth } from "@/auth";
import Account from "./account";
import Sidenav from "./sidenav";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidenav session={session} />

      <div className="flex-1 overflow-x-auto">
        <div className="flex justify-between items-center bg-white border-b border-gray-200 py-4 px-4 md:px-6">
          <div className="flex items-center gap-4"></div>

          <div className="flex items-center space-x-6">
            <Account session={session} />
          </div>
        </div>

        <div className="p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}
