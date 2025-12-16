import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyJwtToken, signJwtToken } from '../../utils/jwt';
import { serialize } from 'cookie';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get token from cookies
  const token = req.cookies.userToken || req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ error: 'No token found' });
  }
  
  try {
    const payload = await verifyJwtToken(token);
    if (!payload || !payload.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Get fresh user data from database to ensure we have the latest subscription status
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
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
      return res.status(404).json({ error: 'User not found' });
    }

    // Log actual user data for debugging
    console.log("User data from database:", JSON.stringify(user, null, 2));
    
    // Generate new token with correct data
    const newToken = await signJwtToken({
      id: user.id,
      phone: user.phone,
      email: user.email || null,
      kycStatus: user.kycStatus || "NOT_STARTED",
      exchangeConnected: user.exchangeConnected === true,
      subscriptionActive: user.subscriptionActive === true,
      iat: Math.floor(Date.now() / 1000)
    });
    
    // Set the new token as a cookie (both userToken and token for compatibility)
    res.setHeader('Set-Cookie', [
      serialize('userToken', newToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 // 7 days
      }),
      serialize('token', newToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 // 7 days
      })
    ]);
    
    return res.status(200).json({ 
      success: true,
      message: 'Token refreshed successfully',
      user: {
        id: user.id,
        kycStatus: user.kycStatus,
        exchangeConnected: user.exchangeConnected,
        subscriptionActive: user.subscriptionActive
      }
    });
  } catch (error) {
    console.error("Error refreshing token:", error);
    return res.status(500).json({ error: 'Failed to refresh token' });
  }
}