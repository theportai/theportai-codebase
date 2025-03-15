import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  providers: [
    CredentialsProvider({
      name: "Mobile OTP Login",
      credentials: {
        phone: { label: "Phone Number", type: "text", placeholder: "Enter your mobile number" },
        otp: { label: "OTP", type: "text", placeholder: "Enter OTP" },
      },

      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.otp) {
          throw new Error("Missing phone or OTP");
        }

        const phone = credentials.phone.trim();
        const otp = credentials.otp.trim();

        let user = await prisma.user.findUnique({ where: { phone } });

        if (!user) {
          user = await prisma.user.create({
            data: { phone, kycStatus: "PENDING", role: "USER" },
          });
        }

        if (otp !== "123456") {
          throw new Error("Invalid OTP");
        }

        // ✅ Check if KYC is complete (PAN, Aadhaar, and Document URL should not be null)
        const isKYCComplete = user.pan && user.aadhaar && user.documentUrl;
        const redirectTo = isKYCComplete ? "/welcome" : "/kyc"; // ✅ Fix redirection logic

        return {
          id: user.id,
          phone: user.phone,
          kycStatus: user.kycStatus,
          role: user.role,
          redirectTo, // ✅ Ensure redirect path is included
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.phone = user.phone;
        token.kycStatus = user.kycStatus;
        token.role = user.role;
        token.redirectTo = user.redirectTo; // ✅ Store redirect path in token
      }
      return token;
    },

    async session({ session, token }) {
      session.user = {
        id: token.id as string,
        phone: token.phone as string,
        kycStatus: token.kycStatus as "PENDING" | "APPROVED" | "REJECTED",
        role: token.role as "USER" | "ADMIN",
      };
      session.redirectTo = token.redirectTo as string | undefined; // ✅ Include redirect path in session
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/signup" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };