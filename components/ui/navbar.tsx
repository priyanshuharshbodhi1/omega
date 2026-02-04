"use client";

import Link from "next/link";
import { Button } from "./button";
import LogoMark from "./logo/logo-mark";
import { LayoutDashboard, LogIn } from "lucide-react";
import { Session } from "next-auth";

export default function Navbar({ session }: { session: Session | null }) {
  return (
    <nav className="absolute z-10 top-10 inset-x-0 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="w-full h-14 bg-gradient-to-r from-gray-900 to-dark rounded-full flex items-center justify-between px-4 text-white shadow-xl hover:scale-[1.02] hover:shadow-2xl transition-all">
          <div className="shrink-0 flex items-center gap-2">
            <LogoMark className="h-8 text-brand" />
            <p className="font-black text-lg tracking-wide">Omega</p>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-white/70">
            {session ? (
              <Link href="/dashboard">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 shadow-xl hover:shadow transition-all hover:scale-[.98] rounded-full"
                >
                  <LayoutDashboard className="size-4 shrink-0" />
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 shadow-xl hover:shadow transition-all hover:scale-[.98] rounded-full"
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
