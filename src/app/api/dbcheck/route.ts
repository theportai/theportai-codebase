import { prisma } from '@/lib/prisma.js';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new Response('✅ Connected to DB successfully');
  } catch (e) {
    console.error(e);
    return new Response('❌ DB connection failed', { status: 500 });
  }
}