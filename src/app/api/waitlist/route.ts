import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { name, email, phone } = await req.json();

    if (!name || !email || !phone) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Check if email already exists
    const existingUser = await prisma.waitlist.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ 
        error: "This email is already on our waitlist." 
      }, { status: 409 });
    }

    const waitlistEntry = await prisma.waitlist.create({
      data: { name, email, phone },
    });

    return NextResponse.json({ 
      success: true, 
      message: "You've been added to the waitlist!" 
    });
  } catch (error) {
    console.error("❌ Waitlist Error:", error);
    
    // Handle unique constraint violation more explicitly
    if (error.code === 'P2002') {
      return NextResponse.json({ 
        error: "This email is already on our waitlist." 
      }, { status: 409 });
    }
    
    return NextResponse.json({ 
      error: "Something went wrong. Please try again." 
    }, { status: 500 });
  }
}