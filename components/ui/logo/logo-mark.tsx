import { cn } from "@/lib/utils";
import React from "react";
import { twMerge } from "tailwind-merge";

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 100 100"
      className={cn("w-8 aspect-square", className)}
    >
      <path
        fill="currentColor"
        d="M50 15C31 15 15 31 15 50C15 63 21 75 30 82L25 90H40L43 83C45 83.5 47.5 84 50 84C52.5 84 55 83.5 57 83L60 90H75L70 82C79 75 85 63 85 50C85 31 69 15 50 15ZM50 25C64 25 75 36 75 50C75 64 64 75 50 75C36 75 25 64 25 50C25 36 36 25 50 25Z"
      />
    </svg>
  );
}

export default LogoMark;
