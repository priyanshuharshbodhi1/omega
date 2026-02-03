import { create } from "zustand";

interface LoadingState {
  msg: string;
  setMsg: (msg: string) => void;
}

interface UserState {
  user: any;
  setUser: (user: string) => void;
}

interface TeamState {
  team: any;
  setTeam: (team: any) => void;
}

export const useLoading = create<LoadingState>()((set) => ({
  msg: "",
  setMsg: (msg) => set(() => ({ msg: msg })),
}));

export const useUser = create<UserState>()((set) => ({
  user: null,
  setUser: (user) => set(() => ({ user: user })),
}));


export const useTeam = create<TeamState>()((set) => ({
  team: null,
  setTeam: (team) => set(() => ({ team: team })),
}));
