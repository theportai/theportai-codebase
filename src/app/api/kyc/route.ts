import { NextResponse } from "next/server.js";  
import cloudinary from "@/lib/cloudinary.js";  
import prisma from "../../../lib/prisma.mjs";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    console.log("📩 Received KYC Submission Request...");

    // ✅ Read FormData
    const formData = await req.formData();
    console.log("📥 Extracted FormData:", formData);

    // ✅ Extract form fields
    const phone = formData.get("phone")?.toString() || "";
    const fullName = formData.get("fullName")?.toString() || "";
    const pan = formData.get("pan")?.toString() || "";
    const aadhaar = formData.get("aadhaar")?.toString() || "";
    const file = formData.get("document") as File | null;

    if (!phone || !fullName || !pan || !aadhaar || !file) {
      console.error("❌ Missing Required Fields:", { phone, fullName, pan, aadhaar, file });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ✅ Check if User Exists in Prisma
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (!existingUser) {
      console.error("❌ User Not Found in Database:", phone);
      return NextResponse.json({ error: "User not found. Please register first." }, { status: 404 });
    }

    console.log("✅ User Found, Proceeding with KYC Upload...");

    // ✅ Convert file to Base64 for Cloudinary
    try {
      console.log("📂 Reading File for Upload...");
      const buffer = await file.arrayBuffer();
      const base64File = Buffer.from(buffer).toString("base64");
      const mimeType = file.type || "image/png"; // Fallback to PNG if type is missing

      console.log("📤 Uploading to Cloudinary...");
      const uploadResponse = await cloudinary.uploader.upload(`data:${mimeType};base64,${base64File}`, {
        folder: "kyc-documents",
        public_id: `kyc_${uuidv4()}`,
      });

      console.log("✅ Cloudinary Upload Success:", uploadResponse.secure_url);

      // ✅ Update User in Prisma
      console.log("📝 Updating User KYC Status in Database...");
      const updatedUser = await prisma.user.update({
        where: { phone },
        data: {
          pan,
          aadhaar,
          documentUrl: uploadResponse.secure_url,
          kycStatus: "PENDING",
        },
      });

      console.log("✅ KYC Submitted Successfully for:", phone);
      return NextResponse.json({ message: "KYC submitted successfully!", user: updatedUser }, { status: 200 });

    } catch (cloudinaryError) {
      console.error("🔥 Cloudinary Upload Failed:", cloudinaryError);
      return NextResponse.json({ error: "Error uploading document to Cloudinary" }, { status: 500 });
    }

  } catch (error) {
    console.error("🔥 KYC API Internal Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}