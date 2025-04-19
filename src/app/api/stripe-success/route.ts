import { NextResponse } from "next/server";
import Stripe from 'stripe';
import prisma from '@/lib/prisma.mjs';
import { generateUserTokenByPhone } from '@/utils/jwt'; 

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
      
      // Find the user first to get their current state
      const user = await prisma.user.findUnique({
        where: { phone },
        select: {
          id: true,
          exchangeConnected: true
        }
      });
      
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      
      // Update user subscription status in database
      await prisma.user.update({
        where: { phone },
        data: { 
          subscriptionActive: true,
        }
      });
      
      // Generate token using your proper JWT utility to include all user fields
      const token = await generateUserTokenByPhone(phone);
      
      // Set cookie
      const response = NextResponse.json({ success: true });
      response.cookies.set("userToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      
      return response;
    } catch (stripeErr) {
      console.error("Stripe verification error:", stripeErr);
      return NextResponse.json({ 
        error: "Could not verify payment. Please contact support."
      }, { status: 500 });
    }
  } catch (err) {
    console.error("❌ Error in /api/stripe-success:", err);
    return NextResponse.json({ 
      error: "Something went wrong processing your subscription."
    }, { status: 500 });
  }
}