import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/ui/navbar";
import { CornerDownRight } from "lucide-react";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <>
      <section className="min-h-screen relative overflow-hidden bg-[#EEE1CF] [background-image:radial-gradient(circle_at_top,_#fff8ed_0%,_#eee1cf_55%,_#e4d6c3_100%)]">
        <Navbar session={session} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(45,106,79,0.1),_transparent_45%),radial-gradient(circle_at_80%_30%,_rgba(124,58,237,0.12),_transparent_50%)]"></div>
        <div className="absolute -top-24 left-1/2 h-72 w-[38rem] -translate-x-1/2 rounded-full bg-[#FFFDF7] opacity-60 blur-3xl"></div>
        <div className="absolute -bottom-24 right-[-6rem] h-80 w-80 rounded-full bg-[#E9D8FD] opacity-60 blur-3xl"></div>

        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 pt-40 pb-20">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
            <div className="pointer-events-none">
              <div className="mb-4 flex items-center gap-3 text-[#1F1A15] animate-[fade-in_0.85s_ease-out]">
                <div className="h-9 w-9 rounded-full bg-[#1F1A15] flex items-center justify-center">
                  <span className="text-[#D2F7D7] font-display text-base">Ω</span>
                </div>
                <span className="font-display text-lg tracking-[0.2em] uppercase">
                  Omega
                </span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05] text-[#1F1A15] animate-[fade-in_0.9s_ease-out]">
                Transform <span className="text-brand">Feedback</span> into
                Actionable <span className="text-brand">Insights</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg md:text-xl text-[#4B3F35] animate-[fade-in_1.05s_ease-out]">
                Omega empowers businesses to effortlessly gather, analyze, and act
                on customer feedback with the power of AI.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4 pointer-events-auto animate-[fade-in_1.2s_ease-out]">
                <Link href="https://youtu.be/-BkMrIukKYo">
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 rounded-full shadow-md hover:shadow transition-all hover:scale-[.98]"
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
                    className="gap-2 rounded-full shadow-xl hover:shadow transition-all hover:scale-[.98]"
                  >
                    <CornerDownRight className="size-4" />
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>

            <div className="pointer-events-none hidden lg:block">
              <div className="relative h-full">
                <div className="absolute inset-0 rounded-[2.5rem] border border-[#D2C4B3] bg-[#FFFDF7]/70 shadow-[0_30px_80px_rgba(30,20,10,0.2)] backdrop-blur animate-[fade-in_1.1s_ease-out]"></div>
                <div className="absolute -top-6 -left-6 h-24 w-24 rounded-3xl border border-[#D2C4B3] bg-[#FFFDF7] shadow-[0_14px_30px_rgba(55,40,25,0.18)] animate-[float_6s_ease-in-out_infinite]"></div>
                <div className="absolute bottom-8 -right-8 h-32 w-32 rounded-3xl border border-[#D2C4B3] bg-[#E9D8FD] shadow-[0_14px_30px_rgba(76,29,149,0.22)] animate-[float_7s_ease-in-out_infinite]"></div>
                <div className="absolute inset-8 rounded-[2rem] border border-[#D2C4B3] bg-[radial-gradient(circle_at_top,_#fffdf7_0%,_#f7efe1_55%,_#efe4d4_100%)] shadow-inner"></div>
                <div className="absolute inset-12 rounded-3xl border border-[#D2C4B3] bg-[#FFFDF7] p-6 shadow-[0_18px_50px_rgba(55,40,25,0.15)]">
                  <div className="h-3 w-20 rounded-full bg-[#E6D8C6] mb-4"></div>
                  <div className="h-4 w-40 rounded-full bg-[#E6D8C6] mb-3"></div>
                  <div className="h-3 w-28 rounded-full bg-[#E6D8C6] mb-6"></div>
                  <div className="h-32 rounded-2xl border border-[#D2C4B3] bg-[#FFFDF7] shadow-[0_10px_24px_rgba(55,40,25,0.12)]"></div>
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <div className="h-14 rounded-xl bg-[#E6D8C6]"></div>
                    <div className="h-14 rounded-xl bg-[#D2F7D7]"></div>
                    <div className="h-14 rounded-xl bg-[#E9D8FD]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
