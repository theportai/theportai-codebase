import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      phone: string;
      email?: string;
      kycStatus: "PENDING" | "APPROVED" | "REJECTED";
      role: "USER" | "ADMIN";
    };
    redirectTo?: string; 
  }

  interface User {  // ✅ Keeping User if you prefer
    id: string;
    phone: string;
    email?: string;
    kycStatus: "PENDING" | "APPROVED" | "REJECTED";
    role: "USER" | "ADMIN";
    redirectTo?: string;
  }

  interface JWT {
    id: string;
    phone: string;
    kycStatus: "PENDING" | "APPROVED" | "REJECTED";
    role: "USER" | "ADMIN";
    redirectTo?: string; // ✅ Store redirectTo in token
  }
}