"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoMark from "@/components/ui/logo/logo-mark";
import SelectTeam from "@/app/(app)/select-team";
import Account from "@/app/(app)/account";
import { cn } from "@/lib/utils";

export default function TopNav({ session }: { session: any }) {
  const pathname = usePathname();

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
    },
    {
      name: "Feedback",
      href: "/feedback",
    },
    {
      name: "AI Analysis",
      href: "/analysis",
    },
    {
      name: "Widget Style",
      href: "/widgets",
    },
    {
      name: "Integration",
      href: "/integrations",
    },
  ];

  return (
    <div className="fixed top-0 left-0 right-0 z-50 px-6 py-6">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-2xl border border-[#D2C4B3] bg-[#FFFDF7]/90 px-6 py-4 shadow-[0_14px_36px_rgba(55,40,25,0.2)] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="bg-[#1F1A15] p-2 rounded-full flex items-center justify-center">
            <LogoMark className="h-4 w-4 text-[#D2F7D7]" />
          </div>
          <span className="font-display text-xl tracking-tight text-[#1F1A15] whitespace-nowrap">
            Omega
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-2 mx-10">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-xs uppercase tracking-[0.2em] font-semibold px-3 py-2 rounded-full transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-[#E6D8C6] text-[#1F1A15]"
                    : "text-[#4B3F35] hover:text-[#1F1A15] hover:bg-[#E6D8C6]/70",
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-6">
          <div className="[&>div]:p-0 [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-xs [&_button]:uppercase [&_button]:tracking-[0.2em] [&_button]:font-semibold [&_button]:text-[#4B3F35] [&_button]:h-auto [&_button]:py-0 [&_button]:w-auto [&_button]:justify-start [&_button]:whitespace-nowrap">
            <SelectTeam session={session} />
          </div>

          <div className="text-xs uppercase tracking-[0.2em] font-semibold text-[#4B3F35] hover:text-[#1F1A15] cursor-pointer whitespace-nowrap">
            <Account session={session} textOnly={true} />
          </div>
        </div>
      </div>
    </div>
  );
}
