// utils/jwt.ts
import { jwtVerify, SignJWT } from 'jose';

// Convert string to Uint8Array for jose
const textEncoder = new TextEncoder();
const JWT_SECRET = textEncoder.encode(process.env.JWT_SECRET || 'your-secret-key');

// Interface for JWT payload
export interface JwtPayload {
  id?: string;
  phone: string;
  email?: string | null;
  kycStatus?: string;
  exchangeConnected?: boolean;
  subscriptionActive?: boolean;
  exp?: number;
}

// This function only verifies the JWT structure without database operations
// Safe to use in middleware
export async function verifyJwtToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    // Extract essential fields
    const phone = payload.phone as string;
    if (!phone) {
      console.error('No phone found in token');
      return null;
    }
    
    return {
      id: payload.id as string,
      phone: phone,
      email: payload.email as string || null,
      kycStatus: payload.kycStatus as string,
      exchangeConnected: payload.exchangeConnected as boolean,
      subscriptionActive: payload.subscriptionActive as boolean,
      exp: payload.exp as number
    };
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

// Function to sign JWT with user data - for server components only!
export async function signJwtToken(payload: JwtPayload, expiresIn: string = '7d'): Promise<string> {
  try {
    return await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(expiresIn)
      .sign(JWT_SECRET);
  } catch (error) {
    console.error('JWT signing error:', error);
    throw error;
  }
}