import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/connect-exchange",
  "/kyc",
  "/kyc-waiting",
  "/pricing"
];

const PUBLIC_ROUTES = ["/login", "/signup", "/welcome", "/support"];
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const secretBytes = new TextEncoder().encode(JWT_SECRET);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const url = req.nextUrl.clone();

  // Skip middleware for non-protected routes
  if (!PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for token
  const token = req.cookies.get("userToken")?.value;
  if (!token) {
    console.log("Middleware: No token found, redirecting to signup");
    url.pathname = "/signup";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jose.jwtVerify(token, secretBytes);
    const { kycStatus, exchangeConnected, subscriptionActive } = payload as any;
    console.log(`Middleware: Path=${pathname}, KYC=${kycStatus}, Exchange=${exchangeConnected}, Subscription=${subscriptionActive}`);

    // Special case: Allow /kyc-waiting page to handle its own redirects
    if (pathname.startsWith("/kyc-waiting")) {
      if (kycStatus === "NOT_STARTED") {
        url.pathname = "/kyc";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }

    // 🟡 Handle NOT_STARTED KYC status
    if (kycStatus === "NOT_STARTED") {
      if (pathname.startsWith("/kyc")) {
        return NextResponse.next();
      } else {
        url.pathname = "/kyc";
        return NextResponse.redirect(url);
      }
    }

    // 🟠 Handle PENDING KYC status
    if (kycStatus === "PENDING") {
      url.pathname = "/kyc-waiting";
      return NextResponse.redirect(url);
    }

    // 🟢 Handle APPROVED KYC status
    if (kycStatus === "APPROVED") {
      // If visiting /dashboard
      if (pathname.startsWith("/dashboard")) {
        if (!exchangeConnected) {
          url.pathname = "/connect-exchange";
          return NextResponse.redirect(url);
        }
        if (!subscriptionActive) {
          url.pathname = "/pricing";
          return NextResponse.redirect(url);
        }
        return NextResponse.next();
      }

      // If visiting /pricing
      if (pathname.startsWith("/pricing")) {
        if (!exchangeConnected) {
          url.pathname = "/connect-exchange";
          return NextResponse.redirect(url);
        }
        if (subscriptionActive) {
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
        return NextResponse.next();
      }

      // If visiting /connect-exchange
      if (pathname.startsWith("/connect-exchange")) {
        if (exchangeConnected && !subscriptionActive) {
          url.pathname = "/pricing";
          return NextResponse.redirect(url);
        }
        if (exchangeConnected && subscriptionActive) {
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
        return NextResponse.next();
      }

      // Redirect from KYC when already approved
      if (pathname.startsWith("/kyc")) {
        url.pathname = exchangeConnected ? "/pricing" : "/connect-exchange";
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  } catch (err) {
    console.error("❌ Invalid JWT Token:", err);
    url.pathname = "/signup";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/connect-exchange",
    "/connect-exchange/:path*",
    "/kyc",
    "/kyc/:path*",
    "/kyc-waiting",
    "/kyc-waiting/:path*",
    "/login",
    "/signup",
    "/welcome",
    "/support",
    "/pricing",
    "/pricing/:path*"
  ]
};