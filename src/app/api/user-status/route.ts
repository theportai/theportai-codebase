import { NextResponse } from "next/server.js";  // ✅ Fix import
import prisma from "../../../lib/prisma.mjs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Fetch user from the database
    const user = await prisma.user.findUnique({
      where: { phone },
      select: { kycStatus: true }, // Only fetch the KYC status
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ kycStatus: user.kycStatus }, { status: 200 });
  } catch (error) {
    console.error("Error fetching KYC status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}





