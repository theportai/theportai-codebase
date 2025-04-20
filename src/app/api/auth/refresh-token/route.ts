// app/api/auth/refresh-token/route.ts
import { NextResponse } from "next/server";
import { generateUserTokenByPhone } from '@/utils/user-data';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");
    
    if (!phone) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 });
    }

    // Generate fresh token with latest user data
    const token = await generateUserTokenByPhone(phone);
    
    // Set the cookie and return success
    const response = NextResponse.json({ success: true });
    
    response.cookies.set("userToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    
    return response;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return NextResponse.json(
      { error: "Failed to refresh user token" },
      { status: 500 }
    );
  }
}