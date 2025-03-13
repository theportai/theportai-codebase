import { NextApiRequest, NextApiResponse } from "next";
import twilio from "twilio";
import prisma from "@/lib/prisma";
import { signJwtToken } from "@/utils/jwt"; 

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { phone, otp } = req.body;

  if (!phone || !otp) return res.status(400).json({ error: "Phone and OTP are required" });

  try {
    // ✅ Verify OTP with Twilio
    const verification = await client.verify
      .services(process.env.TWILIO_SERVICE_ID!)
      .verificationChecks.create({
        to: phone as string,
        code: otp as string,
      });

    if (verification.status !== "approved") {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // ✅ Find or Create User
    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          email: `${phone}@temp.com`, // Temporary email
        },
      });
    }

    // ✅ Generate JWT Token
    const token = signJwtToken({ id: user.id, phone: user.phone });

    return res.status(200).json({ message: "OTP Verified", token, user });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    return res.status(500).json({ error: "Verification failed" });
  }
}