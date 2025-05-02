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

            // Generate a token with the updated subscription status
            const token = await signJwtToken({
                id: user.id,
                phone: user.phone,
                email: user.email,
                kycStatus: user.kycStatus as string,
                exchangeConnected: user.exchangeConnected as boolean,
                subscriptionActive: true, // Explicitly set to true
                isNewUser: false,
                redirectTo: "/dashboard",
                paymentSuccess: true,
                postAuthAction: true
            });

            // Create HTML response with proper cookie settings and script fixes
            return new Response(
                `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Payment Successful</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                            background: linear-gradient(to bottom, #0f172a, #1e293b);
                            color: white;
                            height: 100vh;
                            margin: 0;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            align-items: center;
                            text-align: center;
                            padding: 0 20px;
                        }
                        .card {
                            background: rgba(30, 41, 59, 0.8);
                            border-radius: 16px;
                            padding: 32px;
                            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
                            backdrop-filter: blur(5px);
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            max-width: 500px;
                            width: 100%;
                        }
                        h1 {
                            margin-top: 0;
                            color: #38bdf8;
                        }
                        .loader {
                            display: inline-block;
                            width: 50px;
                            height: 50px;
                            border: 3px solid rgba(255, 255, 255, .3);
                            border-radius: 50%;
                            border-top-color: #38bdf8;
                            animation: spin 1s ease-in-out infinite;
                            margin: 20px 0;
                        }
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Payment Successful!</h1>
                        <p>Thank you for subscribing to PortAI Pro.</p>
                        <div class="loader"></div>
                        <p>Updating your account and redirecting you to the dashboard...</p>
                    </div>
                    
                    <script>
                        // This function will set cookies and then redirect
                        function processSuccess() {
                            try {
                                // Set cookie with proper formatting
                                document.cookie = "userToken=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; ${
                                    process.env.NODE_ENV === 'production' ? 'Secure;' : ''
                                }";
                                
                                document.cookie = "postAuthAction=true; path=/; max-age=60; SameSite=Lax; ${
                                    process.env.NODE_ENV === 'production' ? 'Secure;' : ''
                                }";
                                
                                document.cookie = "paymentSuccess=true; path=/; max-age=60; SameSite=Lax; ${
                                    process.env.NODE_ENV === 'production' ? 'Secure;' : ''
                                }";
                                
                                console.log("Cookies set, now redirecting...");
                                
                                // Force reload to ensure cookies are properly processed
                                window.location.href = '/dashboard?payment=success';
                            } catch (err) {
                                console.error("Error setting cookies:", err);
                                // Fallback redirect
                                window.location.href = '/dashboard';
                            }
                        }
                        
                        // Give a slight delay to ensure browser has time to process everything
                        setTimeout(processSuccess, 1500);
                    </script>
                </body>
                </html>
                `,
                {
                    status: 200,
                    headers: {
                        "Content-Type": "text/html",
                        // Set the token as an HTTP cookie as well (belt and suspenders approach)
                        "Set-Cookie": [
                            `userToken=${token}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax; ${
                                process.env.NODE_ENV === 'production' ? 'Secure;' : ''
                            }`,
                            `postAuthAction=true; Path=/; Max-Age=60; SameSite=Lax; ${
                                process.env.NODE_ENV === 'production' ? 'Secure;' : ''
                            }`,
                            `paymentSuccess=true; Path=/; Max-Age=60; SameSite=Lax; ${
                                process.env.NODE_ENV === 'production' ? 'Secure;' : ''
                            }`
                        ]
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