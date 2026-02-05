import { auth } from "@/auth";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/ui/navbar";
import { CornerDownRight } from "lucide-react";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <>
      <section className="min-h-screen relative flex items-center justify-center">
        <BackgroundBeams />
        <Navbar session={session} />
        <div className="absolute inset-0 bg-gradient-to-t from-white/50 via-transparent to-white/50"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 via-transparent to-white/50"></div>
        <div className="w-full max-w-5xl mx-auto px-4 relative pointer-events-none">
          <h1 className="text-center font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-balance mb-5 font-display">
            Transform <span className="text-brand">Feedback</span>
            <span className="animate-pulse"> 💬</span> into Actionable{" "}
            <span className="text-brand">Insights</span>
            <span className="animate-pulse">💡</span>
          </h1>
          <p className="max-w-2xl mx-auto text-center text-balance text-lg md:text-xl opacity-70">
            Omega empowers businesses to effortlessly gather, analyze, and act
            on customer feedback with the power of AI.
          </p>

          <div className="flex items-center justify-center gap-4 pointer-events-auto mt-10">
            <Link href="https://youtu.be/-BkMrIukKYo">
              <Button
                variant="outline"
                size="lg"
                className="gap-2 shadow-md hover:shadow transition-all hover:scale-[.98]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                  />
                </svg>
                Demo
              </Button>
            </Link>
            <Link href="/register">
              <Button
                variant="brand"
                size="lg"
                className="gap-2 shadow-xl hover:shadow transition-all hover:scale-[.98]"
              >
                <CornerDownRight className="size-4" />
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
