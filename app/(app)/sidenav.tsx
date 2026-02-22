"use client";

import Link from "next/link";
import { BotMessageSquare, Grid2X2, Home, LayoutDashboard, Link2, MessageSquareDashed, Palette, Users2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoMark from "@/components/ui/logo/logo-mark";
import SelectTeam from "./select-team";

export default function Sidenav({ session }: { session: any }) {
  const pathname = usePathname();
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <>
      {showSidebar && (
        <div className="absolute z-10 inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowSidebar(false)}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white absolute left-2/3 top-4 cursor-pointer" viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}

      <div
        className={`${
          showSidebar ? "-translate-x-0" : "-translate-x-64"
        } lg:-translate-x-0 w-64 absolute z-10 top-0 left-0 bottom-0 rounded-none lg:relative lg:flex flex-col bg-[#1F1A15] transition-transform shrink-0`}
      >
        <Link
          href="/dashboard"
          className="shrink-0 p-3 border-b border-[#3A2F24] text-[#FFFDF7] font-display font-semibold tracking-wide flex items-center justify-center h-16"
        >
          <LogoMark className="h-7 text-[#D2F7D7]" />
        </Link>

        <SelectTeam session={session} />

        <ul className="flex-1 p-4 space-y-3 font-semibold">
          <li>
            <Link
              href="/dashboard"
              className={`w-full text-sm text-[#FFFDF7] flex items-center space-x-2 px-4 py-3 rounded-md ${
                pathname === "/dashboard" ? "bg-[#D2F7D7] text-[#1F1A15]" : "text-[#CBBEAE] hover:text-[#FFFDF7]"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
          </li>
          <li>
            <Link
              href="/feedback"
              className={`w-full text-sm text-[#FFFDF7] flex items-center space-x-2 px-4 py-3 rounded-md ${
                pathname === "/feedback" ? "bg-[#D2F7D7] text-[#1F1A15]" : "text-[#CBBEAE] hover:text-[#FFFDF7]"
              }`}
            >
              <MessageSquareDashed className="w-4 h-4" />
              <span>Feedback</span>
            </Link>
          </li>
          <li>
            <Link
              href="/analysis"
              className={`w-full text-sm text-[#FFFDF7] flex items-center space-x-2 px-4 py-3 rounded-md ${
                pathname === "/analysis" ? "bg-[#D2F7D7] text-[#1F1A15]" : "text-[#CBBEAE] hover:text-[#FFFDF7]"
              }`}
            >
              <BotMessageSquare className="w-4 h-4" />
              <span>AI Analysis</span>
            </Link>
          </li>
          {/* <li>
            <Link
              href="/customers"
              className={`w-full text-sm text-white flex items-center space-x-2 px-4 py-3 rounded-md ${
                pathname === "/customers" ? "bg-gradient-to-r from-brand text-dark" : "text-white/70 hover:text-white"
              }`}
            >
              <Users2 className="w-4 h-4" />
              <span>Customers</span>
            </Link>
          </li> */}
          <li>
            <Link
              href="/widgets"
              className={`w-full text-sm text-[#FFFDF7] flex items-center space-x-2 px-4 py-3 rounded-md ${
                pathname === "/widgets" ? "bg-[#D2F7D7] text-[#1F1A15]" : "text-[#CBBEAE] hover:text-[#FFFDF7]"
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Widget Style</span>
            </Link>
          </li>
          <li>
            <Link
              href="/integrations"
              className={`w-full text-sm text-[#FFFDF7] flex items-center space-x-2 px-4 py-3 rounded-md ${
                pathname === "/integrations" ? "bg-[#D2F7D7] text-[#1F1A15]" : "text-[#CBBEAE] hover:text-[#FFFDF7]"
              }`}
            >
              <Link2 className="w-4 h-4" />
              <span>Integration</span>
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}
