"use client";

import Link from "next/link";
import { Button } from "./button";
import LogoMark from "./logo/logo-mark";
import { LayoutDashboard, LogIn } from "lucide-react";
import { Session } from "next-auth";

export default function Navbar({ session }: { session: Session | null }) {
  return (
    <nav className="absolute z-10 top-10 inset-x-0 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="w-full h-14 bg-[#FFFDF7]/90 border border-[#D2C4B3] rounded-full flex items-center justify-between px-5 text-[#1F1A15] shadow-[0_14px_30px_rgba(55,40,25,0.18)] backdrop-blur-md">
          <div className="shrink-0 flex items-center gap-2">
            <LogoMark className="h-7 text-brand" />
            <p className="font-display text-lg tracking-wide">Omega</p>
          </div>
          <div className="flex items-center gap-6 text-sm font-semibold text-[#4B3F35]">
            {session ? (
              <Link href="/dashboard">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 shadow-sm hover:shadow transition-all hover:scale-[.98] rounded-full"
                >
                  <LayoutDashboard className="size-4 shrink-0" />
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 shadow-sm hover:shadow transition-all hover:scale-[.98] rounded-full"
                >
                  <LogIn className="size-4 shrink-0" />
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
