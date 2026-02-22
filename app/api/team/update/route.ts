import { updateTeam } from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return new NextResponse("Missing Team ID", { status: 400 });
    }

    const updatedTeam = await updateTeam(id, data);
    return NextResponse.json(updatedTeam);
  } catch (error) {
    console.error("Update team error:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
