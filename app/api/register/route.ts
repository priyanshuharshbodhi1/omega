import { connect } from "@tidbcloud/serverless";
import { PrismaTiDBCloud } from "@tidbcloud/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const connection = connect({ url: process.env.DATABASE_URL });
  const adapter = new PrismaTiDBCloud(connection);
  const prisma = new PrismaClient({ adapter });
  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    const splitName = name.split(" ");
    const team = await prisma.team.create({
      data: {
        name: splitName.length > 0 ? splitName[0] + "'s Team" : name + "'s Team",
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
      },
    });

    const user = await prisma.user.create({
      data: {
        name,
        email,
        currentTeamId: team.id,
        password: hash,
      },
    });

    const teamMember = await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: user.id,
        role: "owner",
      },
    });

    return NextResponse.json({ success: true, message: "Successfully registered", data: user }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
