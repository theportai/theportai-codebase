import prisma from "./prisma.mjs";

export async function getUserByToken(token: string) {
  try {
    // You should store token in user cookie and map to phone
    const user = await prisma.user.findUnique({
      where: {
        phone: token // Example logic — adjust as needed
      },
    });

    return user;
  } catch (err) {
    console.error("❌ getUserByToken error:", err);
    return null;
  }
}