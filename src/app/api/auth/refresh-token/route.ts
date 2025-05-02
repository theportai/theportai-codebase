import { NextResponse } from "next/server";
import { generateUserTokenByPhone } from '@/utils/user-data';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");
    
    if (!phone) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 });
    }

    const token = await generateUserTokenByPhone(phone);
    
    if (!token) {
      return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
    }
    
    const response = NextResponse.json({ success: true });
    
    response.cookies.set({
      name: "userToken",
      value: token,
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