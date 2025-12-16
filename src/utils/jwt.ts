import { jwtVerify, SignJWT } from 'jose';

const textEncoder = new TextEncoder();
const JWT_SECRET = textEncoder.encode(process.env.JWT_SECRET || 'your-secret-key');


export interface JwtPayload {
  id?: string;
  phone: string;
  email?: string | null;
  kycStatus?: string;
  exchangeConnected?: boolean;
  subscriptionActive?: boolean;
  isNewUser?: boolean;
  exp?: number;
}

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
      isNewUser: payload.isNewUser as boolean || false,
      exp: payload.exp as number
    };
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

export async function signJwtToken(payload: JwtPayload, expiresIn: string = '7d'): Promise<string> {
  try {
    const tokenPayload = {
      ...payload,
      isNewUser: payload.isNewUser || false
    };

    return await new SignJWT(tokenPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(expiresIn)
      .sign(JWT_SECRET);
  } catch (error) {
    console.error('JWT signing error:', error);
    throw error;
  }
}