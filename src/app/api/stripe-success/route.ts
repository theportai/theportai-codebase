import { NextResponse } from "next/server";
import Stripe from 'stripe';
import prisma from '@/lib/prisma.mjs';
import { signJwtToken } from '@/utils/jwt';

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

            const user = await prisma.user.findUnique({
                where: { phone },
                select: {
                    id: true,
                    phone: true,
                    email: true,
                    kycStatus: true,
                    exchangeConnected: true,
                    isNewUser: true
                }
            });

            if (!user) {
                return NextResponse.json({ error: "User not found" }, { status: 404 });
            }

            // Update the user's subscription status
            await prisma.user.update({
                where: { phone },
                data: {
                    subscriptionActive: true,
                }
            });

            console.log("User subscription updated for phone:", phone);

            // Create HTML response with JavaScript that will:
            // 1. Call refresh-token API
            // 2. Then redirect to dashboard
            return new Response(
                `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Payment Successful</title>
                    <script>
                        // Function to handle redirect after token refresh
                        async function refreshAndRedirect() {
                            try {
                                // Call the refresh token endpoint
                                const response = await fetch('/api/auth/refresh-token?phone=${phone}');
                                
                                if (response.ok) {
                                    console.log('Token refreshed successfully');
                                    // Redirect to dashboard
                                    window.location.href = '/dashboard';
                                } else {
                                    console.error('Failed to refresh token');
                                    setTimeout(() => {
                                        window.location.href = '/dashboard';
                                    }, 2000);
                                }
                            } catch (error) {
                                console.error('Error during token refresh:', error);
                                // Fallback redirect after error
                                setTimeout(() => {
                                    window.location.href = '/dashboard';
                                }, 2000);
                            }
                        }
                        
                        // Call the function when page loads
                        window.onload = refreshAndRedirect;
                    </script>
                </head>
                <body>
                    <h1>Payment Successful!</h1>
                    <p>Updating your account and redirecting you to the dashboard...</p>
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