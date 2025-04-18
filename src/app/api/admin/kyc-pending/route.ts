import { NextResponse } from "next/server.js";  // ✅ Fix import
import prisma from "../../../../lib/prisma.mjs";

// Fetch all users with PENDING KYC
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: { kycStatus: "PENDING" },
      select: { phone: true, pan: true, aadhaar: true },
    });

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error("Error fetching pending KYC:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}