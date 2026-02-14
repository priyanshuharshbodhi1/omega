import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getUserById, getTeam } from "@/lib/elasticsearch";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !(session.user as any)?.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    // New: Fetch User profile from Elasticsearch
    const user = await getUserById((session.user as any).id);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    // New: Fetch the user's current team to satisfy the legacy relational structure expected by the frontend
    let teams: any[] = [];
    if (user.currentTeamId) {
      const team = await getTeam(user.currentTeamId);
      if (team) {
        teams.push({ team });
      }
    }

    const userData = {
      ...user,
      teams: teams,
    };

    return NextResponse.json(
      {
        success: true,
        message: "Successfully fetched user profile",
        data: userData,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
