"use client";

import { CircleHelp } from "lucide-react";

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group">
      <CircleHelp className="w-3.5 h-3.5 text-[#7B6A58] cursor-help" />
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-lg border border-[#D2C4B3] bg-[#FFFDF7] px-2.5 py-2 text-[11px] font-medium text-[#1F1A15] shadow-lg opacity-0 transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}
