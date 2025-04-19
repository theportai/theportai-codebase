import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJwtToken } from "./utils/jwt";

const PROTECTED_ROUTES = ["/dashboard", "/connect-exchange", "/kyc", "/kyc-waiting", "/pricing"];
const PUBLIC_ROUTES = ["/login", "/signup", "/welcome", "/stripe-success"];

const AUTH_PAGE = "/signup"; 

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  const token = req.cookies.get("userToken")?.value || req.cookies.get("token")?.value;
  
  // Handle protected routes
  if (PROTECTED_ROUTES.some(route => pathname === route || pathname.startsWith(route))) {
    
    if (!token) {
      console.log("No token found, redirecting to auth");
      return NextResponse.redirect(new URL(AUTH_PAGE, req.url));
    }

    // Verify token
    const payload = await verifyJwtToken(token);
    if (!payload) {
      console.error("Invalid JWT Token");
      const response = NextResponse.redirect(new URL(AUTH_PAGE, req.url));
      response.cookies.delete("token");
      response.cookies.delete("userToken");
      return response;
    }

    try {
      // Extract user data from token payload
      const { kycStatus, exchangeConnected, subscriptionActive } = payload;
      
      console.log(`Middleware check: ${pathname}, User status:`, {
        kycStatus,
        exchangeConnected,
        subscriptionActive
      });
      
      // Handle welcome route redirection
      if (pathname === "/welcome") {
        if (kycStatus === "NOT_STARTED") {
          return NextResponse.redirect(new URL("/kyc", req.url));
        } else if (kycStatus === "PENDING") {
          return NextResponse.redirect(new URL("/kyc-waiting", req.url));
        } else if (kycStatus === "APPROVED") {
          if (!exchangeConnected) {
            return NextResponse.redirect(new URL("/connect-exchange", req.url));
          } else if (!subscriptionActive) {
            return NextResponse.redirect(new URL("/pricing", req.url));
          } else {
            return NextResponse.redirect(new URL("/dashboard", req.url));
          }
        }
        return NextResponse.next();
      }
      
      // Handle KYC routes
      if (pathname === "/kyc" || pathname.startsWith("/kyc/")) {
        if (kycStatus === "PENDING") {
          return NextResponse.redirect(new URL("/kyc-waiting", req.url));
        } else if (kycStatus === "APPROVED") {
          if (!exchangeConnected) {
            return NextResponse.redirect(new URL("/connect-exchange", req.url));
          } else if (!subscriptionActive) {
            return NextResponse.redirect(new URL("/pricing", req.url));
          } else {
            return NextResponse.redirect(new URL("/dashboard", req.url));
          }
        }
        return NextResponse.next();
      }
      
      // Handle KYC-Waiting routes
      if (pathname === "/kyc-waiting" || pathname.startsWith("/kyc-waiting/")) {
        if (kycStatus === "NOT_STARTED") {
          return NextResponse.redirect(new URL("/kyc", req.url));
        } else if (kycStatus === "APPROVED") {
          if (!exchangeConnected) {
            return NextResponse.redirect(new URL("/connect-exchange", req.url));
          } else if (!subscriptionActive) {
            return NextResponse.redirect(new URL("/pricing", req.url));
          } else {
            return NextResponse.redirect(new URL("/dashboard", req.url));
          }
        }
        return NextResponse.next();
      }
      
      // Handle connect-exchange route
      if (pathname === "/connect-exchange" || pathname.startsWith("/connect-exchange/")) {
        if (kycStatus !== "APPROVED") {
          return NextResponse.redirect(new URL("/kyc", req.url));
        } else if (exchangeConnected && !subscriptionActive) {
          return NextResponse.redirect(new URL("/pricing", req.url));
        } else if (exchangeConnected && subscriptionActive) {
          return NextResponse.redirect(new URL("/dashboard", req.url));
        }
        return NextResponse.next();
      }
      
      // Handle pricing route
      if (pathname === "/pricing") {
        if (kycStatus !== "APPROVED") {
          return NextResponse.redirect(new URL("/kyc", req.url));
        } else if (!exchangeConnected) {
          return NextResponse.redirect(new URL("/connect-exchange", req.url));
        } else if (subscriptionActive) {
          return NextResponse.redirect(new URL("/dashboard", req.url));
        }
        return NextResponse.next();
      }

      // Handle stripe-success route
      if (pathname === "/stripe-success" || pathname.startsWith("/stripe-success")) {
        if (kycStatus !== "APPROVED") {
          return NextResponse.redirect(new URL("/kyc", req.url));
        } else if (!exchangeConnected) {
          return NextResponse.redirect(new URL("/connect-exchange", req.url));
        }
        return NextResponse.next();
      }

      // Handle dashboard route
      if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
        if (kycStatus !== "APPROVED") {
          return NextResponse.redirect(new URL("/kyc", req.url));
        } else if (!exchangeConnected) {
          return NextResponse.redirect(new URL("/connect-exchange", req.url));
        } else if (!subscriptionActive) {
          return NextResponse.redirect(new URL("/pricing", req.url));
        }
        return NextResponse.next();
      }
      
    } catch (err) {
      console.error("Error processing token data:", err);
      return NextResponse.redirect(new URL(AUTH_PAGE, req.url));
    }
  }
  
  return NextResponse.next();
}

// Update matcher to include all required paths
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
    "/pricing",
    "/welcome",
    "/login",
    "/signup",
    "/stripe-success",
    "/stripe-success/:path*"
  ]
};