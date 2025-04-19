import { SignJWT, jwtVerify } from 'jose';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your_secret_key");

// Interface for JWT payload
export interface JwtPayload {
  id: string | number;
  phone: string;
  email: string | null;
  kycStatus?: string;
  exchangeConnected?: boolean;
  subscriptionActive?: boolean;
  iat?: number;
  exp?: number;
}

// Function to sign JWT Token
export async function signJwtToken(payload: Record<string, unknown>, expiresIn: string | number = "7d"): Promise<string> {
  // Sanitize payload - ensuring boolean values are properly handled
  const sanitizedPayload = Object.entries(payload).reduce((acc, [key, value]) => {
    if (key === 'exchangeConnected' || key === 'subscriptionActive') {
      // Ensure booleans are actual booleans, not strings or undefined
      acc[key] = value === true || value === 'true';
    } else {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, unknown>);

  // Convert string expiration to seconds
  let expirationTime: number;
  if (typeof expiresIn === "number") {
    expirationTime = expiresIn;
  } else if (expiresIn.endsWith('d')) {
    expirationTime = parseInt(expiresIn) * 24 * 60 * 60;
  } else if (expiresIn.endsWith('h')) {
    expirationTime = parseInt(expiresIn) * 60 * 60;
  } else if (expiresIn.endsWith('m')) {
    expirationTime = parseInt(expiresIn) * 60;
  } else {
    expirationTime = 7 * 24 * 60 * 60; // Default to 7 days
  }

  console.log("Creating JWT with payload:", sanitizedPayload);

  return new SignJWT(sanitizedPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expirationTime)
    .sign(SECRET);
}

// Function to verify JWT Token with improved boolean handling
export async function verifyJwtToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    
    // Validate that the token contains the required fields
    if (!payload.id && !payload.phone) {
      console.error("JWT Token missing required user identifier");
      return null;
    }
    
    console.log("Raw JWT payload:", JSON.stringify(payload, null, 2));
    
    // Process payload to ensure consistent boolean values
    const processedPayload = {
      ...payload,
      id: payload.id,
      phone: payload.phone,
      email: payload.email || null,
      kycStatus: payload.kycStatus || "NOT_STARTED",
      // Explicitly handle boolean values
      exchangeConnected: payload.exchangeConnected === true || payload.exchangeConnected === 'true',
      subscriptionActive: payload.subscriptionActive === true || payload.subscriptionActive === 'true',
    };
    
    console.log("Processed JWT payload:", JSON.stringify(processedPayload, null, 2));
    
    return processedPayload as unknown as JwtPayload;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

// Function to generate user token with fresh database data
export async function generateUserToken(userId: string | number): Promise<string> {
  try {
    // Get the latest user data including subscription status
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        kycStatus: true,
        exchangeConnected: true,
        subscriptionActive: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    console.log("Creating token with user data:", JSON.stringify(user, null, 2));

    // Create the token with explicit boolean conversion
    return await signJwtToken({
      id: user.id,
      phone: user.phone,
      email: user.email || null,
      kycStatus: user.kycStatus || "NOT_STARTED",
      exchangeConnected: user.exchangeConnected === true,
      subscriptionActive: user.subscriptionActive === true,
      // Add timestamp to ensure token uniqueness
      iat: Math.floor(Date.now() / 1000)
    });
  } catch (error) {
    console.error("Error generating user token:", error);
    throw error;
  }
}

// Function to generate user token by phone number (for login flows)
export async function generateUserTokenByPhone(phone: string): Promise<string> {
  try {
    // Get the latest user data including subscription status
    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        phone: true,
        email: true,
        kycStatus: true,
        exchangeConnected: true,
        subscriptionActive: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    console.log("Creating token with user data:", JSON.stringify(user, null, 2));

    // Create the token with explicit boolean conversion
    return await signJwtToken({
      id: user.id,
      phone: user.phone,
      email: user.email || null,
      kycStatus: user.kycStatus || "NOT_STARTED",
      exchangeConnected: user.exchangeConnected === true,
      subscriptionActive: user.subscriptionActive === true,
      // Add timestamp to ensure token uniqueness
      iat: Math.floor(Date.now() / 1000)
    });
  } catch (error) {
    console.error("Error generating user token by phone:", error);
    throw error;
  }
}

// Function to refresh a token with latest user data
export async function refreshUserToken(token: string): Promise<string | null> {
  try {
    const payload = await verifyJwtToken(token);
    if (!payload) return null;
    
    const userId = payload.id;
    if (!userId) return null;
    
    return await generateUserToken(userId);
  } catch (error) {
    console.error("Error refreshing user token:", error);
    return null;
  }
}