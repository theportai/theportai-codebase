import { NextResponse } from "next/server.js"; 
import twilio from "twilio"; 
import prisma from "../../../lib/prisma.mjs"; 
import * as jose from 'jose';  

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID; 
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN; 
const twilioServiceId = process.env.TWILIO_SERVICE_ID; 
const JWT_SECRET = process.env.JWT_SECRET;  

if (!twilioAccountSid || !twilioAuthToken || !twilioServiceId || !JWT_SECRET) {   
  console.error("❌ Missing required environment variables."); 
}  

const client = twilio(twilioAccountSid, twilioAuthToken);  

function isValidPhoneNumber(phone: string): boolean {   
  return /^\d{10}$/.test(phone); 
}  

export async function POST(req: Request) {   
  try {     
    const { phone, otp, type } = await req.json();     
    console.log("📩 Received Request:", { phone, type, otp: otp ? "***" : undefined });      
    
    if (!phone || !isValidPhoneNumber(phone)) {       
      return NextResponse.json({ error: "Invalid phone number. Must be 10 digits." }, { status: 400 });     
    }      
    
    if (type === "send") {
      // 🧪 DEV BYPASS — Skip Twilio for test number
      if (phone === "9999999999") {
        console.log("🧪 Dev Mode OTP Bypass Triggered!");
        
        // Ensure test user is in the DB with all required fields
        await prisma.user.upsert({
          where: { phone },
          update: {},
          create: { 
            phone, 
            isVerified: false,
            kycStatus: "NOT_STARTED",
            exchangeConnected: false,
            subscriptionActive: false
          },
        });
        
        return NextResponse.json({ message: "OTP bypassed in dev mode!" });
      }
      
      return await handleSendOTP(phone);
    }
    
    if (type === "verify") {       
      if (!otp) return NextResponse.json({ error: "OTP is required for verification." }, { status: 400 });       
      return await handleVerifyOTP(phone, otp);     
    }      
    
    return NextResponse.json({ error: "Invalid request type." }, { status: 400 });   
  } catch (error: any) {     
    console.error("⚠️ OTP Handling Error:", error);     
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });   
  } 
}  

async function handleSendOTP(phone: string) {   
  const lastRequest = await prisma.otpRequest.findUnique({ where: { phone } });   
  if (lastRequest) {     
    const secondsSince = (Date.now() - new Date(lastRequest.createdAt).getTime()) / 1000;     
    if (secondsSince < 60) return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });   
  }    
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);   
  const count = await prisma.otpRequest.count({ where: { phone, createdAt: { gte: oneHourAgo } } });   
  if (count >= 10) return NextResponse.json({ error: "Too many OTP requests. Try again later." }, { status: 429 });    
  
  // Create user with all required fields
  const user = await prisma.user.upsert({     
    where: { phone },     
    update: {},     
    create: { 
      phone, 
      isVerified: false,
      kycStatus: "NOT_STARTED",
      exchangeConnected: false,
      subscriptionActive: false
    }   
  });    
  
  await prisma.otpRequest.upsert({ 
    where: { phone }, 
    update: { createdAt: new Date() }, 
    create: { phone } 
  });    
  
  const result = await client.verify.v2.services(twilioServiceId!)
    .verifications.create({ to: `+91${phone}`, channel: "sms" });    
  
  console.log("📨 OTP Sent:", result.status);   
  return NextResponse.json({ message: "OTP sent successfully!" }); 
}  

async function handleVerifyOTP(phone: string, otp: string) {
  // 🧪 DEV BYPASS — Auto-approve verification for test number  
  if (phone === "9999999999") {
    console.log("🧪 Dev Mode Verification Bypass Triggered!");
  } else {
    const verification = await client.verify.v2.services(twilioServiceId!)
      .verificationChecks.create({ to: `+91${phone}`, code: otp });
      
    if (verification.status !== "approved") {
      console.error("❌ OTP Verification Failed:", verification.status);
      return NextResponse.json({ error: "Invalid OTP. Please try again." }, { status: 401 });
    }
  }
  
  // Get user data before updating to check if they're new
  const existingUser = await prisma.user.findUnique({ 
    where: { phone } 
  });
  
  // Determine if this is a new user - either they don't exist yet or were just created in the send step
  const isNewUser = !existingUser || (existingUser && !existingUser.isVerified);
  
  // Update user to verified
  await prisma.user.update({ 
    where: { phone }, 
    data: { isVerified: true }
  });   
  
  // Get fresh user data to ensure we have the latest subscription status
  const user = await prisma.user.findUnique({ 
    where: { phone } 
  });    
  
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  
  // Determine the correct redirect based on user status
  let redirectTo = "/dashboard";
  
  // FIXED: Prioritize isNewUser and kycStatus for /welcome page
  if (isNewUser || user.kycStatus === "NOT_STARTED") {
    redirectTo = "/welcome";
    console.log("Redirecting new user to /welcome");
  } else if (user.kycStatus === "PENDING") {
    redirectTo = "/kyc-waiting";
  } else if (user.kycStatus === "APPROVED" && !user.exchangeConnected) {
    redirectTo = "/connect-exchange";
  } else if (user.kycStatus === "APPROVED" && user.exchangeConnected && !user.subscriptionActive) {
    redirectTo = "/pricing";
  }
  
  const payload = {
    id: user.id,
    phone: user.phone,
    email: user.email || null,
    kycStatus: user.kycStatus,
    exchangeConnected: user.exchangeConnected,
    subscriptionActive: user.subscriptionActive,
    isNewUser: isNewUser, // FIXED: Use proper isNewUser flag
    redirectTo: redirectTo,
    // Flag to indicate this is a post-auth action
    postAuthAction: true
  };
  
  const token = await new jose.SignJWT(payload)     
    .setProtectedHeader({ alg: "HS256" })     
    .setExpirationTime("7d")     
    .sign(new TextEncoder().encode(JWT_SECRET));    
  
  const response = NextResponse.json({ 
    success: true, 
    token, 
    user: payload,
    redirectTo: redirectTo
  });   
  
  // Set the JWT token
  response.cookies.set("userToken", token, {     
    httpOnly: true,     
    secure: process.env.NODE_ENV === "production",     
    sameSite: "lax",     
    path: "/",     
    maxAge: 60 * 60 * 24 * 7   
  });
  
  // Set a short-lived post-auth action cookie
  response.cookies.set("postAuthAction", "true", {
    httpOnly: false, // Need to be readable by middleware
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 // 60 seconds
  });
  
  console.log(`OTP Verification completed. User status: isNewUser=${isNewUser}, kycStatus=${user.kycStatus}, redirectTo=${redirectTo}`);
  
  return response; 
}