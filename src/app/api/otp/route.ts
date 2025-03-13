import { NextResponse } from "next/server";
import twilio from "twilio";
import prisma from "@/lib/prisma";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function POST(req: Request) {
  try {
    // ✅ Ensure request is parsed correctly
    const body = await req.json();
    console.log("📩 Received Body:", body); // Debugging log
    const { phone } = body;

    if (!phone || phone.length < 10) {
      console.error("❌ Invalid phone number format:", phone);
      return NextResponse.json({ error: "Invalid phone number. Must be 10 digits." }, { status: 400 });
    }

    // ✅ Check if user exists
    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await prisma.user.create({ data: { phone } });
      console.log("🆕 User Created:", user);
    } else {
      console.log("✅ User Exists:", user);
    }

    if (!process.env.TWILIO_SERVICE_ID) {
      console.error("❌ TWILIO_SERVICE_ID is not set.");
      return NextResponse.json({ error: "TWILIO_SERVICE_ID is missing." }, { status: 500 });
    }

    // ✅ Send OTP via Twilio
    console.log("📤 Sending OTP to:", phone);
    const verification = await client.verify.v2.services(process.env.TWILIO_SERVICE_ID)
      .verifications.create({ to: phone, channel: "sms" });

    console.log("📨 Twilio Response:", verification);
    return NextResponse.json({ message: "OTP sent successfully!", verification }, { status: 200 });

  } catch (error: unknown) {
    console.error("⚠️ Error Sending OTP:", error);

    let errorMessage = "Error sending OTP";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    // ✅ Ensure valid JSON response
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}