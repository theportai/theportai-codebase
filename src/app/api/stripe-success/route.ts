import { NextResponse } from "next/server";
import Stripe from 'stripe';
import prisma from '@/lib/prisma.mjs';
import { generateUserTokenByPhone } from '@/utils/user-data'; // Updated import path

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
      });
      
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      
      // Update user subscription status in database
      const updatedUser = await prisma.user.update({
        where: { phone },
        data: { 
          subscriptionActive: true,
        }
      });
      
      console.log("User subscription updated:", updatedUser);
      
      // Generate new token with updated subscription status
      const token = await generateUserTokenByPhone(phone);
      
      // Return HTML that redirects to dashboard and sets the token
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Payment Successful</title>
            <script>
              // Set cookie with the new token
              document.cookie = "userToken=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax";
              
              // Redirect to dashboard
              window.location.href = "/dashboard";
            </script>
          </head>
          <body>
            <h1>Payment Successful!</h1>
            <p>Redirecting to dashboard...</p>
          </body>
        </html>
        `,
        {
          status: 200,
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
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