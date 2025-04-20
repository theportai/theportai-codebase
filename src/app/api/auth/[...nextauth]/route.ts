import NextAuth, { AuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "../../../../lib/prisma.mjs";
import { signJwtToken } from "@/utils/jwt";
import { cookies } from "next/headers";


const CredentialsProvider = (await import("next-auth/providers/credentials")).default;

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  providers: [
    CredentialsProvider({
      name: "Mobile OTP Login",
      credentials: {
        phone: { label: "Phone Number", type: "text", placeholder: "Enter your mobile number" },
        otp: { label: "OTP", type: "text", placeholder: "Enter OTP" },
      },

      async authorize(credentials?: Record<"phone" | "otp", string>) {
        if (!credentials?.phone || !credentials?.otp) {
          throw new Error("Missing phone or OTP");
        }

        const phone = credentials.phone.trim();
        const otp = credentials.otp.trim();

        let user = await prisma.user.findUnique({ where: { phone } });

        if (!user) {
          // Create new user if not exists
          user = await prisma.user.create({
            data: { 
              phone, 
              kycStatus: "NOT_STARTED",
              role: "USER",
              exchangeConnected: false,
              subscriptionActive: false
            },
          });
        }

        // In production, implement proper OTP verification here
        if (otp !== "123456") {
          throw new Error("Invalid OTP");
        }

        // Determine redirect path based on user status
        let redirectTo = "/dashboard";
        
        if (user.kycStatus === "NOT_STARTED") {
          redirectTo = "/kyc";
        } else if (user.kycStatus === "PENDING") {
          redirectTo = "/kyc-waiting";
        } else if (user.kycStatus === "APPROVED" && !user.exchangeConnected) {
          redirectTo = "/connect-exchange";
        } else if (user.kycStatus === "APPROVED" && user.exchangeConnected && !user.subscriptionActive) {
          redirectTo = "/pricing";
        }

        return {
          id: user.id,
          phone: user.phone,
          email: user.email,
          kycStatus: user.kycStatus,
          role: user.role,
          exchangeConnected: user.exchangeConnected,
          subscriptionActive: user.subscriptionActive,
          redirectTo,
        };
      },
    }),
  ],

  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.phone = user.phone;
        token.email = user.email;
        token.kycStatus = user.kycStatus;
        token.role = user.role;
        token.exchangeConnected = user.exchangeConnected;
        token.subscriptionActive = user.subscriptionActive;
        token.redirectTo = user.redirectTo;
        
        // Create our custom JWT token here as well
        try {
          const jwtToken = await signJwtToken({
            id: user.id,
            phone: user.phone,
            email: user.email,
            kycStatus: user.kycStatus,
            exchangeConnected: user.exchangeConnected,
            subscriptionActive: user.subscriptionActive,
          });
          
          // Store the token to set in the cookies later
          token.customJwt = jwtToken;
        } catch (error) {
          console.error("Error creating custom JWT:", error);
        }
      }
      return token;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: any) {
      session.user = {
        id: token.id as string,
        phone: token.phone as string,
        email: token.email as string || null,
        kycStatus: token.kycStatus as string,
        role: token.role as string,
        exchangeConnected: token.exchangeConnected as boolean,
        subscriptionActive: token.subscriptionActive as boolean,
      };
      session.redirectTo = token.redirectTo as string;
      return session;
    },

    // Set the cookie after signin
    async signIn({ user }) {
      // We will handle this in the SignInForm component
      return true;
    }
  },

  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/signup" },
};

// Fix NextAuth initialization for TypeScript + ESM
const handler = async (req: Request, res: Response) => {
  return await NextAuth(req, res, authOptions);
};

export { handler as GET, handler as POST };