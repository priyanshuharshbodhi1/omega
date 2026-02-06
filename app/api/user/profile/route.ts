import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";
import { PrismaTiDBCloud } from "@tidbcloud/prisma-adapter";
import { connect } from "@tidbcloud/serverless";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const connection = connect({ url: process.env.DATABASE_URL });
  const adapter = new PrismaTiDBCloud(connection);
  const prisma = new PrismaClient({ adapter });
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user!.email!,
    },
    include: {
      teams: {
        include: {
          team: true,
        },
      },
    },
  });

  return NextResponse.json({ success: true, message: "Successfully fetched user profile", data: user }, { status: 200 });
}
