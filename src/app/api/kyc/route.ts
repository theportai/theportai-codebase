import { NextResponse } from "next/server.js";
import cloudinary from "../../../lib/cloudinary.js";
import prisma from "../../../lib/prisma.mjs";
import { v4 as uuidv4 } from "uuid";
import * as jose from "jose";

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(req: Request) {
  try {
    console.log("📩 Received KYC Submission Request...");

    const formData = await req.formData();

    const phone = formData.get("phone")?.toString() || "";
    const fullName = formData.get("fullName")?.toString() || "";
    const pan = formData.get("pan")?.toString() || "";
    const aadhaar = formData.get("aadhaar")?.toString() || "";
    const panFile = formData.get("panDocument") as File | null;
    const aadhaarFile = formData.get("aadhaarDocument") as File | null;

    if (!phone || !fullName || !pan || !aadhaar || !panFile || !aadhaarFile) {
      console.error("❌ Missing Required Fields:", { phone, fullName, pan, aadhaar, panFile, aadhaarFile });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { phone } });

    if (!existingUser) {
      console.error("❌ User Not Found in Database:", phone);
      return NextResponse.json({ error: "User not found. Please register first." }, { status: 404 });
    }

    console.log("✅ User Found, Proceeding with KYC Upload...");

    const panBuffer = await panFile.arrayBuffer();
    const aadhaarBuffer = await aadhaarFile.arrayBuffer();
    const panBase64 = Buffer.from(panBuffer).toString("base64");
    const aadhaarBase64 = Buffer.from(aadhaarBuffer).toString("base64");
    const panMimeType = panFile.type || "image/png";
    const aadhaarMimeType = aadhaarFile.type || "image/png";

    const panUploadResponse = await cloudinary.uploader.upload(
      `data:${panMimeType};base64,${panBase64}`,
      { folder: "kyc-documents", public_id: `pan_${uuidv4()}` }
    );

    const aadhaarUploadResponse = await cloudinary.uploader.upload(
      `data:${aadhaarMimeType};base64,${aadhaarBase64}`,
      { folder: "kyc-documents", public_id: `aadhaar_${uuidv4()}` }
    );

    console.log("✅ Cloudinary Upload Success:", panUploadResponse.secure_url, aadhaarUploadResponse.secure_url);

    const updatedUser = await prisma.user.update({
      where: { phone },
      data: {
        fullName,
        pan,
        aadhaar,
        panDocumentUrl: panUploadResponse.secure_url,
        aadhaarDocumentUrl: aadhaarUploadResponse.secure_url,
        kycStatus: "PENDING",
      },
    });

    console.log("✅ KYC Submitted Successfully:", phone);

    // 🔐 Regenerate token with updated kycStatus
    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const token = await new jose.SignJWT({
      phone: updatedUser.phone,
      kycStatus: updatedUser.kycStatus,
      exchangeConnected: updatedUser.exchangeConnected || false
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secretKey);

    const response = NextResponse.json({
      message: "KYC submitted successfully!",
      redirect: "/kyc-waiting",
      user: updatedUser
    }, { status: 200 });

    response.cookies.set("userToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;

  } catch (error) {
    console.error("🔥 KYC API Internal Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
