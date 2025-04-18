import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/lib/prisma.mjs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature') as string;

    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed.', err.message);
      return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // ✅ Handle subscription event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userPhone = session.metadata?.userPhone;

      console.log("📞 Phone from metadata:", userPhone); // 🔍 Debug log

      if (!userPhone) {
        console.warn("⚠️ No phone number in session metadata.");
        return NextResponse.json({ received: true });
      }

      // ✅ Update DB to mark user as subscribed
      await prisma.user.update({
        where: { phone: userPhone },
        data: {
          subscriptionActive: true,
        },
      });

      console.log(`🎉 User ${userPhone} is now marked as subscriptionActive = true`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('🔥 Webhook Handler Error:', err);
    return new NextResponse('Webhook handler failed', { status: 500 });
  }
}