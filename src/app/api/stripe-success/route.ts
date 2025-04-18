import { NextResponse } from "next/server";
import * as jose from "jose";
import Stripe from 'stripe';
import prisma from '@/lib/prisma.mjs';

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const secretKey = new TextEncoder().encode(JWT_SECRET);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");
    const sessionId = searchParams.get("session_id");
    
    if (!phone) {
      return NextResponse.json({ error: "Phone is required." }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required." }, { status: 400 });
    }

    // Verify the payment was successful
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      // Check if payment was successful
      if (session.payment_status !== 'paid') {
        console.log('Payment not completed:', session.payment_status);
        return NextResponse.json({ 
          error: "Payment not completed. Please try again or contact support."
        }, { status: 400 });
      }
      
      // Update user subscription status in database
      await prisma.user.update({
        where: { phone },
        data: { 
          subscriptionActive: true,
        }
      });
    } catch (stripeErr) {
      console.error("Stripe verification error:", stripeErr);
      return NextResponse.json({ 
        error: "Could not verify payment. Please contact support."
      }, { status: 500 });
    }
    
    // Create new token with updated subscriptionActive = true
    const token = await new jose.SignJWT({
      phone,
      kycStatus: "APPROVED",
      exchangeConnected: true,
      subscriptionActive: true,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secretKey);
    
    // Set cookie but don't redirect - let the frontend handle the redirect
    const response = NextResponse.json({ success: true });
    response.cookies.set("userToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    
    return response;
  } catch (err) {
    console.error("❌ Error in /api/stripe-success:", err);
    return NextResponse.json({ 
      error: "Something went wrong processing your subscription."
    }, { status: 500 });
  }
}