import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFFDF7] p-4 text-center">
      <div className="max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tighter text-[#1F1A15] sm:text-5xl">
            404 - Page Not Found
          </h1>
          <p className="text-[#4B3F35]">
            The page you are looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            asChild
            variant="dark"
            className="px-8"
          >
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="px-8 border-[#D2C4B3] text-[#4B3F35]"
          >
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
