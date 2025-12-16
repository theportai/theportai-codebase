import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientProvider from "@/components/ClientProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ✅ Move metadata here (only allowed in a Server Component)
export const metadata: Metadata = {
  title: "PortAI - Built Like a Hedge Fund. Powered by Multi-Agent AI",
  description: "Meet your AI co-pilot for investing — PortAI analyzes markets, places trades, and optimizes your portfolio 24/7 with zero bias and maximum intelligence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* ✅ Wrapping app inside ClientProvider to manage session state */}
        <ClientProvider>{children}</ClientProvider>
      </body>
    </html>
  );
}