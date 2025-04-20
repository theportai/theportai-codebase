// utils/user-data.ts
import prisma from '@/lib/prisma.mjs';
import { signJwtToken, JwtPayload } from './jwt';

export async function getUserByPhone(phone: string) {
  try {
    return await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        phone: true,
        email: true,
        kycStatus: true,
        exchangeConnected: true,
        subscriptionActive: true,
      }
    });
  } catch (error) {
    console.error('Error fetching user by phone:', error);
    return null;
  }
}

export async function generateUserTokenByPhone(phone: string): Promise<string> {
  try {
    // Fetch complete user data to include in token
    const user = await getUserByPhone(phone);

    if (!user) {
      throw new Error('User not found');
    }

    // Generate token with all user data
    return await signJwtToken({
      id: user.id,
      phone: user.phone,
      email: user.email,
      kycStatus: user.kycStatus,
      exchangeConnected: user.exchangeConnected,
      subscriptionActive: user.subscriptionActive,
    });
  } catch (error) {
    console.error('Token generation error:', error);
    throw error;
  }
}

export async function refreshUserDataFromToken(payload: JwtPayload): Promise<JwtPayload | null> {
  try {
    if (!payload.phone) return null;
    
    // Fetch fresh user data
    const user = await getUserByPhone(payload.phone);
    if (!user) return null;
    
    // Return updated payload with fresh data
    return {
      ...payload,
      id: user.id,
      email: user.email,
      kycStatus: user.kycStatus,
      exchangeConnected: user.exchangeConnected,
      subscriptionActive: user.subscriptionActive,
    };
  } catch (error) {
    console.error('Error refreshing user data:', error);
    return null;
  }
}