import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { email, pan, aadhaar, documentUrl } = await req.json();

    if (!email || !pan || !aadhaar || !documentUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ✅ Ensure the User model in Prisma has pan, aadhaar, and documentUrl fields
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        pan,
        aadhaar,
        documentUrl,
        kycStatus: "pending", // Ensure `kycStatus` field exists in Prisma
      },
    });

    return NextResponse.json({ message: "KYC submitted successfully", user: updatedUser }, { status: 200 });
  } catch (err) { // ✅ Renamed `error` to `err`
    console.error("Error submitting KYC:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}