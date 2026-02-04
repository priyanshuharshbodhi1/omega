import { cn } from "@/lib/utils";
import React from "react";
import { twMerge } from "tailwind-merge";

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 100 100"
      className={cn('w-8 aspect-square', className)}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M50 100c27.614 0 50-22.386 50-50S77.614 0 50 0 0 22.386 0 50s22.386 50 50 50zM26.524 48.16a2.673 2.673 0 00-.56 2.79c.177.47.484.88.884 1.183l31.741 24a2.631 2.631 0 002.906.177c.4-.233.734-.567.966-.971a2.683 2.683 0 00.011-2.659l-8.848-15.61 17.773-4.483a2.64 2.64 0 001.25-.726 2.687 2.687 0 00.606-2.732 2.667 2.667 0 00-.825-1.193l-29.096-24a2.621 2.621 0 00-3.264-.064 2.687 2.687 0 00-.838 3.179l6.71 15.789-18.145 4.576a2.64 2.64 0 00-1.271.744z"
        clipRule="evenodd"
      ></path>
    </svg>
  );
}

export default LogoMark;
