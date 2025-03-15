import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Approve KYC
export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    const updatedUser = await prisma.user.update({
      where: { phone },
      data: { kycStatus: "APPROVED" },
    });

    return NextResponse.json({ message: "KYC Approved", user: updatedUser }, { status: 200 });
  } catch (error) {
    console.error("Error approving KYC:", error);
    return NextResponse.json({ error: "Failed to approve KYC" }, { status: 500 });
  }
}