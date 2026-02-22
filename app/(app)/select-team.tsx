"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTeam, useUser } from "@/lib/store";
import { ChevronDown } from "lucide-react";
import { useEffect } from "react";
import toast from "react-hot-toast";

export default function SelectTeam({ session }: { session: any }) {
  const user = useUser((state) => state.user);
  const setUser = useUser((state) => state.setUser);
  const activeTeam = useTeam((state) => state.team);
  const setActiveTeam = useTeam((state) => state.setTeam);

  useEffect(() => {
    if (session && user === null) {
      fetch(`/api/user/profile`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setUser(data.data);
          } else {
            toast.error(data.message);
          }
        })
        .catch((err) => console.log(err));
    }
  }, [session, user, setUser]);

  useEffect(() => {
    if (user && user.teams && activeTeam === null) {
      const current = user.teams.find(
        (o: any) => o.team.id === user.currentTeamId,
      );
      if (current) {
        setActiveTeam(current.team);
      }
    }
  }, [user, activeTeam, setActiveTeam]);

  return (
    <>
      <div className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full rounded-full border border-[#D9CDBA] bg-[#FFFDF7] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#4B3F35] hover:bg-[#E6D8C6] flex items-center justify-between">
            <span>{activeTeam?.name}</span>
            <ChevronDown className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>My Teams</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user?.teams.map((t: any) => (
              <DropdownMenuItem
                onClick={() => setActiveTeam(t.team)}
                key={t.team.id}
              >
                {t.team.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
