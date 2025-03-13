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
  }

  interface User {
    id: string;
    phone: string;
    email?: string;
    kycStatus: "PENDING" | "APPROVED" | "REJECTED";
    role: "USER" | "ADMIN";
  }
}