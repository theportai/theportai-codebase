import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/lib/prisma.mjs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = body.phone;
    
    if (!phone) {
      return NextResponse.json({ error: 'Phone is required.' }, { status: 400 });
    }
    
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL;
    if (!origin) {
      return NextResponse.json({ error: 'Missing origin' }, { status: 500 });
    }
    
    const user = await prisma.user.findUnique({ 
      where: { phone } 
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check if user is already subscribed
    if (user.subscriptionActive === true) {
      return NextResponse.json({ 
        redirectToDashboard: true,
        message: 'User already has an active subscription'
      });
    }
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      metadata: {
        userPhone: phone,
      },
      success_url: `${origin}/stripe-success?phone=${encodeURIComponent(phone)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
    });
    
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('🔥 Stripe Checkout Error:', error);
    return NextResponse.json({ error: 'Stripe checkout failed.' }, { status: 500 });
  }
}