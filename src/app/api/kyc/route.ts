import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import prisma from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // ✅ Extract form fields correctly
    const phone = formData.get("phone")?.toString() || "";
    const fullName = formData.get("fullName")?.toString() || "";
    const pan = formData.get("pan")?.toString() || "";
    const aadhaar = formData.get("aadhaar")?.toString() || "";
    const file = formData.get("document") as File;

    if (!phone || !fullName || !pan || !aadhaar || !file) {
      console.error("❌ Missing fields:", { phone, fullName, pan, aadhaar, file });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ✅ Convert file to Base64
    const buffer = await file.arrayBuffer();
    const base64File = Buffer.from(buffer).toString("base64");

    // ✅ Upload file to Cloudinary
    const uploadResponse = await cloudinary.uploader.upload(`data:image/png;base64,${base64File}`, {
      folder: "kyc-documents",
      public_id: `kyc_${uuidv4()}`,
    });

    // ✅ Update User in Prisma
    const user = await prisma.user.update({
      where: { phone },
      data: {
        pan,
        aadhaar,
        documentUrl: uploadResponse.secure_url,
        kycStatus: "PENDING",
      },
    });

    return NextResponse.json({ message: "KYC submitted successfully!", user }, { status: 200 });
  } catch (error) {
    console.error("KYC Upload Error:", error);
    return NextResponse.json({ error: "Error submitting KYC" }, { status: 500 });
  }
}