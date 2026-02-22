"use client";

import Avatar from "boring-avatars";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import toast from "react-hot-toast";

export default function Account({
  session,
  textOnly,
  ...props
}: {
  session: any;
  textOnly?: boolean;
  [key: string]: any;
}) {
  const handleSignOut = async () => {
    toast.loading("Signing out...");
    signOut();
  };

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center outline-none">
          {/* @ts-ignore */}
          {textOnly ? (
            <span className="uppercase tracking-widest text-[11px] font-bold text-[#4B3F35] hover:text-[#1F1A15] transition-colors">
              ACCOUNT
            </span>
          ) : (
            <div className="flex items-center space-x-2 hover:scale-[.98] active:scale-95 transition-all">
              <Avatar name={session?.user?.name} variant="beam" size={32} />
              <span className="font-medium hidden md:block text-sm text-[#4B3F35]">
                {session?.user?.name}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 256 256"
              >
                <path
                  fill="currentColor"
                  d="M128 188a12.2 12.2 0 0 1-8.5-3.5l-80-80a12 12 0 0 1 17-17L128 159l71.5-71.5a12 12 0 0 1 17 17l-80 80a12.2 12.2 0 0 1-8.5 3.5Z"
                />
              </svg>
            </div>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          <DropdownMenuLabel>
            <h6 className="text-[#1F1A15]">{session?.user?.name}</h6>
            <p className="text-xs text-[#4B3F35]">{session?.user?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="/settings" className="cursor-pointer">
              <span className="mr-2">⚙️</span> Settings
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleSignOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
