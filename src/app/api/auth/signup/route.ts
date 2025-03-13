import NextAuth, { NextAuthOptions } from "next-auth";
import { Session } from "next-auth"; // ✅ Import Session Type
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials?.email },
        });

        if (!user || user.password !== credentials?.password) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.id, // ✅ TypeScript now recognizes `id`
          email: user.email,
          kycStatus: user.kycStatus,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session }: { session: Session }) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user?.email ?? "" },
      });

      if (dbUser) {
        session.user = {
          ...session.user,
          id: dbUser.id, // ✅ TypeScript now recognizes `id`
          kycStatus: dbUser.kycStatus, // ✅ TypeScript now recognizes `kycStatus`
        };
      }

      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };