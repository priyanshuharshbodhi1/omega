"use client";

import { LifeBuoy, MessageSquarePlus } from "lucide-react";

export default function FloatingActions() {
  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
      <button 
        title="Quick Support"
        className="group relative flex items-center justify-center size-12 rounded-full bg-[#1F1A15] text-[#D2F7D7] shadow-xl hover:scale-110 transition-transform active:scale-95"
        onClick={() => window.open('https://omega.support', '_blank')}
      >
        <LifeBuoy className="size-5" />
        <span className="absolute right-full mr-3 px-2 py-1 rounded bg-[#1F1A15] text-[#FFFDF7] text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md pointer-events-none">
          Help Center
        </span>
      </button>
      <button 
        title="Give Feedback"
        className="group relative flex items-center justify-center size-12 rounded-full bg-[#2D6A4F] text-[#F7F2E9] shadow-xl hover:scale-110 transition-transform active:scale-95"
        onClick={() => window.open('/feedback', '_self')}
      >
        <MessageSquarePlus className="size-5" />
        <span className="absolute right-full mr-3 px-2 py-1 rounded bg-[#2D6A4F] text-[#FFFDF7] text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md pointer-events-none">
          Submit Feedback
        </span>
      </button>
    </div>
  );
}
