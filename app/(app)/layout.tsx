import { auth } from "@/auth";
import TopNav from "@/components/ui/top-nav";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-[#EEE1CF] text-[#1F1A15] font-sans [background-image:radial-gradient(circle_at_top,_#fff8ed_0%,_#e6d8c6_55%,_#e4d6c3_100%)]">
      <TopNav session={session} />

      {/* 
        Add top padding to account for fixed navbar. 
        Navbar is roughly 80px high including padding. 
      */}
      <main className="pt-28 pb-12">
        <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
          {children}
        </div>
      </main>
    </div>
  );
}
