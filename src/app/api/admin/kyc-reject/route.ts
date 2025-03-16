import { NextResponse } from "next/server.js";  // ✅ Fix import
import prisma from "../../../../lib/prisma.mjs";

// Reject KYC
export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    const updatedUser = await prisma.user.update({
      where: { phone },
      data: { kycStatus: "REJECTED" },
    });

    return NextResponse.json({ message: "KYC Rejected", user: updatedUser }, { status: 200 });
  } catch (error) {
    console.error("Error rejecting KYC:", error);
    return NextResponse.json({ error: "Failed to reject KYC" }, { status: 500 });
  }
}