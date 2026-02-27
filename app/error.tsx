"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFFDF7] p-4 text-center">
      <div className="max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tighter text-[#1F1A15] sm:text-5xl">
            Something went wrong!
          </h1>
          <p className="text-[#4B3F35]">
            An unexpected error occurred. We&apos;ve been notified and are working on a fix.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="dark"
            onClick={() => reset()}
            className="px-8"
          >
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/")}
            className="px-8 border-[#D2C4B3] text-[#4B3F35]"
          >
            Go back home
          </Button>
        </div>
        {error.digest && (
          <p className="text-[10px] uppercase tracking-widest text-[#6B5E50] opacity-50">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
