import NextAuth, { NextAuthOptions, Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { compare } from "bcrypt"; // Secure password comparison
import { AdapterUser } from "next-auth/adapters"; 

interface ExtendedUser extends AdapterUser {
  id: string;
  email: string;
  kycStatus: string;
}

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
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error("User not found");
        }

        if (user.password) {
          const isPasswordCorrect = await compare(credentials.password, user.password);
          if (!isPasswordCorrect) {
            throw new Error("Invalid credentials");
          }
        } else {
          throw new Error("User password not found");
        }

        return {
          id: user.id,
          email: user.email,
          kycStatus: user.kycStatus,
        } as ExtendedUser;
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
          id: dbUser.id,
          kycStatus: dbUser.kycStatus,
        } as ExtendedUser;
      }

      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as ExtendedUser).id;
        token.kycStatus = (user as ExtendedUser).kycStatus;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };