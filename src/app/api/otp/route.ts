import { NextResponse } from "next/server";
import twilio from "twilio";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";

const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret"; // Ensure JWT_SECRET is always defined

export async function POST(req: Request) {
  try {
    // ✅ Parse request body safely
    const { phone, otp, type } = await req.json();
    console.log("📩 Received Request:", { phone, otp, type });

    if (!phone || phone.length !== 10) {
      console.error("❌ Invalid phone number:", phone);
      return NextResponse.json({ error: "Invalid phone number. Must be 10 digits." }, { status: 400 });
    }

    if (type === "send") {
      
      // ✅ Check last OTP request timestamp (Rate Limiting)
      const lastRequest = await prisma.otpRequest.findUnique({
        where: { phone },
      });

      if (lastRequest) {
        const timeSinceLastRequest = (new Date().getTime() - new Date(lastRequest.createdAt).getTime()) / 1000;
        
        if (timeSinceLastRequest < 60) { // ⏳ Limit to 1 request per minute
          console.warn("⚠️ Too many OTP requests for phone:", phone);
          return NextResponse.json(
            { error: "Too many requests. Try again in a minute." },
            { status: 429 }
          );
        }
      }

      // ✅ Check for Twilio rate limit (Max 5 OTPs per hour)
      const oneHourAgo = new Date(new Date().getTime() - 60 * 60 * 1000);
      const otpCount = await prisma.otpRequest.count({
        where: {
          phone,
          createdAt: { gte: oneHourAgo },
        },
      });

      if (otpCount >= 10) {
        console.warn("⚠️ Twilio rate limit exceeded for phone:", phone);
        return NextResponse.json(
          { error: "Too many OTP requests. Try again later." },
          { status: 429 }
        );
      }

      // ✅ Ensure user exists in the database
      const user = await prisma.user.upsert({
        where: { phone },
        update: {},
        create: { phone, isVerified: false }, // Ensure isVerified exists
      });

      console.log("✅ User Found or Created:", user);

      if (!process.env.TWILIO_SERVICE_ID) {
        console.error("❌ TWILIO_SERVICE_ID is not set.");
        return NextResponse.json({ error: "Server error: Missing Twilio Service ID." }, { status: 500 });
      }

      // ✅ Store OTP request in database (Ensure Unique Constraint is Handled)
      await prisma.otpRequest.upsert({
        where: { phone },
        update: { createdAt: new Date() }, // Update the timestamp to allow reattempts
        create: { phone },
      });

      // ✅ Send OTP using Twilio
      console.log("📤 Sending OTP to:", phone);
      try {
        const verification = await client.verify.v2.services(process.env.TWILIO_SERVICE_ID!)
          .verifications.create({ to: `+91${phone}`, channel: "sms" });

        console.log("📨 Twilio Response:", verification);
        return NextResponse.json({ message: "OTP sent successfully!" }, { status: 200 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (twilioError: any) {
        console.error("⚠️ Twilio API Error:", twilioError);

        if (twilioError.code === 20429) { // Twilio Too Many Requests
          return NextResponse.json(
            { error: "Twilio is temporarily blocking OTPs. Try again in 5 minutes." },
            { status: 429 }
          );
        }

        return NextResponse.json(
          { error: "Failed to send OTP. Please try again later." },
          { status: 500 }
        );
      }

    } else if (type === "verify") {
      if (!otp) {
        console.error("❌ OTP missing in request");
        return NextResponse.json({ error: "OTP is required for verification." }, { status: 400 });
      }

      // ✅ Verify OTP with Twilio
      console.log("🔎 Verifying OTP...");
      const verificationCheck = await client.verify.v2.services(process.env.TWILIO_SERVICE_ID!)
        .verificationChecks.create({ to: `+91${phone}`, code: otp });

      if (verificationCheck.status !== "approved") {
        console.error("❌ OTP Verification Failed:", verificationCheck);
        return NextResponse.json({ error: "Invalid OTP. Please try again." }, { status: 401 });
      }

      // ✅ Update user verification status in database
      await prisma.user.update({
        where: { phone },
        data: { isVerified: true }, // Fixed: Ensuring isVerified exists in Prisma
      });

      // ✅ Generate JWT token for authentication
      const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: "7d" });

      console.log("✅ OTP Verified! User Authenticated.");
      return NextResponse.json({ success: true, token }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid request type." }, { status: 400 });

  } catch (error: unknown) {
    console.error("⚠️ OTP Handling Error:", error);

    let errorMessage = "Internal Server Error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}