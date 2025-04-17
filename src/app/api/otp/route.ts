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
    
    if (type === "send") return await handleSendOTP(phone);     
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
      exchangeConnected: false
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
  const verification = await client.verify.v2.services(twilioServiceId!)
    .verificationChecks.create({ to: `+91${phone}`, code: otp });    
  
  if (verification.status !== "approved") {     
    return NextResponse.json({ error: "Invalid OTP. Please try again." }, { status: 401 });   
  }    
  
  // Update user to verified
  await prisma.user.update({ 
    where: { phone }, 
    data: { isVerified: true }
  });   
  
  const user = await prisma.user.findUnique({ where: { phone } });    
  
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  
  const payload = {     
    phone,     
    kycStatus: user.kycStatus,
    exchangeConnected: user.exchangeConnected
  };    
  
  const token = await new jose.SignJWT(payload)     
    .setProtectedHeader({ alg: "HS256" })     
    .setExpirationTime("7d")     
    .sign(new TextEncoder().encode(JWT_SECRET));    
  
  const response = NextResponse.json({ success: true, token, user: payload });   
  response.cookies.set("userToken", token, {     
    httpOnly: true,     
    secure: process.env.NODE_ENV === "production",     
    sameSite: "lax",     
    path: "/",     
    maxAge: 60 * 60 * 24 * 7   
  });    
  
  return response; 
}