import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { generateUserToken } from "../../../utils/jwt";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    // Get session ID from request
    const { sessionId } = await req.json();
    
    // Find payment record associated with this session
    // Note: Your database structure might differ
    const payment = await prisma.payment.findUnique({
      where: { stripeSessionId: sessionId },
      select: { userId: true }
    });
    
    if (!payment) {
      return NextResponse.json({ 
        success: false, 
        message: "Payment session not found" 
      }, { status: 404 });
    }
    
    // Update user's subscription status
    await prisma.user.update({
      where: { id: payment.userId },
      data: { subscriptionActive: true }
    });
    
    // Generate fresh token with updated data
    const newToken = await generateUserToken(payment.userId);
    
    // Return success with new token
    const response = NextResponse.json({ 
      success: true, 
      message: "Subscription activated successfully"
    });
    
    // Set the new token in cookies
    response.cookies.set({
      name: "userToken",
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/"
    });
    
    return response;
  } catch (error) {
    console.error("Error activating subscription:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to activate subscription" 
    }, { status: 500 });
  }
}