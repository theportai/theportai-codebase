"use client";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface ExtendedUser {
  id: string;
  email: string;
  kycStatus: string;
}

export default function Dashboard() {
  const { data: session } = useSession();
  const router = useRouter();

  if (!session?.user) {
    router.push("/auth/login");
    return null;
  }

  const user = session.user as ExtendedUser; // ✅ Explicitly cast session.user

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white shadow-md p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">Welcome, {user.email}</h2>
        <p>KYC Status: {user.kycStatus || "pending"}</p>
        <button onClick={() => signOut()} className="bg-red-500 text-white px-4 py-2 rounded-md">
          Logout
        </button>
      </div>
    </div>
  );
}