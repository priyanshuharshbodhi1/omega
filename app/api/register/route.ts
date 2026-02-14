// // import { connect } from "@tidbcloud/serverless";
// import { PrismaTiDBCloud } from "@tidbcloud/prisma-adapter";
// import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createTeam, createUser, generateId } from "@/lib/elasticsearch";

export async function POST(req: Request) {
  /* OLD TIDB CONNECTION
  const connection = connect({ url: process.env.DATABASE_URL });
  const adapter = new PrismaTiDBCloud(connection);
  const prisma = new PrismaClient({ adapter });
  */

  // New: No Prisma needed, we use ES only
  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json(
      { success: false, message: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    const splitName = name.split(" ");
    const teamName =
      splitName.length > 0 ? splitName[0] + "'s Team" : name + "'s Team";

    // Create Team in Elasticsearch
    const team = await createTeam({
      name: teamName,
      description: "Default team",
      style: {
        button_bg: "#FF204E",
        button_color: "white",
        button_text: "Give Feedback",
        button_position: "right",
        form_bg: "#FF204E",
        form_color: "white",
        form_title: "Your Feedback Matters",
        form_subtitle: "Let us hear your thoughts",
        form_rate_text: "Rate your overall experience",
        form_details_text: "Add more details",
        form_button_text: "Send Feedback",
      },
    });

    // New: Save User in Elasticsearch
    const user = await createUser({
      id: generateId(),
      name,
      email,
      currentTeamId: team.id,
      password: hash,
    });

    /* OLD PRISMA CREATE
    const user = await prisma.user.create({
      data: {
        name,
        email,
        currentTeamId: team.id,
        password: hash,
      },
    });
    */

    return NextResponse.json(
      { success: true, message: "Successfully registered", data: user },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
