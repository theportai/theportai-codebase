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

        // Get the latest user data to ensure we have up-to-date information
        let user = await prisma.user.findUnique({ 
          where: { phone } 
        });
        
        let isNewUser = false;

        if (!user) {
          // Create new user if not exists
          isNewUser = true;
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

        // Ensure we have the most recent subscription status
        const freshUser = await prisma.user.findUnique({
          where: { phone }
        });

        if (!freshUser) {
          throw new Error("User not found after OTP verification");
        }

        // Determine redirect path based on latest user status
        let redirectTo = "/dashboard";
        
        if (isNewUser) {
          redirectTo = "/welcome";
        } else if (freshUser.kycStatus === "NOT_STARTED") {
          redirectTo = "/welcome";
        } else if (freshUser.kycStatus === "PENDING") {
          redirectTo = "/kyc-waiting";
        } else if (freshUser.kycStatus === "APPROVED" && !freshUser.exchangeConnected) {
          redirectTo = "/connect-exchange";
        } else if (freshUser.kycStatus === "APPROVED" && freshUser.exchangeConnected && !freshUser.subscriptionActive) {
          redirectTo = "/pricing";
        }

        // Add a flag to indicate this is a fresh login
        const postAuthAction = true;

        return {
          id: freshUser.id,
          phone: freshUser.phone,
          email: freshUser.email,
          kycStatus: freshUser.kycStatus,
          role: freshUser.role,
          exchangeConnected: freshUser.exchangeConnected,
          subscriptionActive: freshUser.subscriptionActive,
          isNewUser,
          redirectTo,
          postAuthAction
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
        token.isNewUser = user.isNewUser;
        token.redirectTo = user.redirectTo;
        token.postAuthAction = user.postAuthAction;
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
        isNewUser: token.isNewUser as boolean || false,
      };
      session.redirectTo = token.redirectTo as string;
      session.postAuthAction = token.postAuthAction as boolean || false;
      return session;
    },

    // Set the custom JWT cookie after signin
    async signIn({ user }) {
      try {
        // Create custom JWT with complete user data
        const jwtToken = await signJwtToken({
          id: user.id,
          phone: user.phone,
          email: user.email,
          kycStatus: user.kycStatus,
          exchangeConnected: user.exchangeConnected,
          subscriptionActive: user.subscriptionActive,
          isNewUser: user.isNewUser || false,
          postAuthAction: user.postAuthAction || false
        });
        
        // Set the cookie using the Next.js cookies function
        cookies().set("userToken", jwtToken, {
          path: "/",
          maxAge: 7 * 24 * 60 * 60, // 7 days
          sameSite: "lax",
          httpOnly: true, // For security
        });
        
        // Set a separate cookie to indicate post-auth action
        cookies().set("postAuthAction", "true", {
          path: "/",
          maxAge: 60, // Short-lived cookie (60 seconds)
          sameSite: "lax",
        });
      } catch (error) {
        console.error("Error setting JWT cookie:", error);
        // Continue with sign-in even if setting cookie fails
      }
      
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