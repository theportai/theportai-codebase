import { NextApiRequest, NextApiResponse } from 'next';
import { verifyJwtToken, signJwtToken } from '../../utils/jwt';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Force the subscription to be active or use value from request
    const forceSubscription = req.body.forceSubscriptionActive ?? true;
    
    const newPayload = {
      ...payload,
      subscriptionActive: forceSubscription
    };
    
    console.log("Creating new token with payload:", newPayload);
    
    // Generate new token with the modified payload
    const newToken = await signJwtToken(newPayload);
    
    // Set cookie
    res.setHeader('Set-Cookie', [
      serialize('userToken', newToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60
      }),
      serialize('token', newToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60
      })
    ]);
    
    return res.status(200).json({ 
      success: true,
      message: `Token updated with subscriptionActive=${forceSubscription}`
    });
  } catch (error) {
    console.error("Error updating token:", error);
    return res.status(500).json({ error: 'Failed to update token' });
  }
}