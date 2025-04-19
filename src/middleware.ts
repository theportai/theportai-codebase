import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJwtToken } from "./utils/jwt";

const PROTECTED_ROUTES = ["/dashboard", "/connect-exchange", "/kyc", "/kyc-waiting", "/pricing"];
const PUBLIC_ROUTES = ["/login", "/signup", "/welcome", "/stripe-success"];

const AUTH_PAGE = "/login"; 

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const url = req.nextUrl.clone();
  
  const token = req.cookies.get("userToken")?.value || req.cookies.get("token")?.value;
  
  if ((pathname === "/pricing" || pathname === "/dashboard") || 
      PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    
    if (!token) {
      console.log("No token found, redirecting to auth");
      return NextResponse.redirect(new URL(AUTH_PAGE, req.url));
    }

    // Verify token - now async with jose
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
        if (subscriptionActive === true) {
          if (kycStatus === "APPROVED" && exchangeConnected === true) {
            return NextResponse.redirect(new URL("/dashboard", req.url));
          } else if (kycStatus === "APPROVED") {
            return NextResponse.redirect(new URL("/connect-exchange", req.url));
          } else {
            return NextResponse.redirect(new URL("/kyc", req.url));
          }
        }
        // Continue normal flow
        return NextResponse.next();
      }
      
      // Handle pricing route
      if (pathname === "/pricing") {
        if (subscriptionActive === true) {
          return NextResponse.redirect(new URL("/dashboard", req.url));
        }
        if (kycStatus !== "APPROVED") {
          return NextResponse.redirect(new URL("/kyc", req.url));
        }
        return NextResponse.next();
      }

      // Handle dashboard route
      if (pathname === "/dashboard") {
        if (
          kycStatus !== "APPROVED" ||
          exchangeConnected !== true ||
          subscriptionActive !== true
        ) {
          // Prioritize what needs to be done next
          if (kycStatus !== "APPROVED") {
            return NextResponse.redirect(new URL("/kyc", req.url));
          } else if (subscriptionActive !== true) {
            return NextResponse.redirect(new URL("/pricing", req.url));
          } else {
            return NextResponse.redirect(new URL("/connect-exchange", req.url));
          }
        }
        return NextResponse.next();
      }
      
      // Handle other protected routes
      if (PROTECTED_ROUTES.some(route => pathname.startsWith(route)) && 
          !pathname.startsWith("/pricing") && 
          !pathname.startsWith("/dashboard")) {
        
        // Special case: Allow /kyc-waiting page to handle its own redirects
        if (pathname.startsWith("/kyc-waiting")) {
          if (kycStatus === "NOT_STARTED") {
            return NextResponse.redirect(new URL("/kyc", req.url));
          }
          return NextResponse.next();
        }
        
        // Redirect to dashboard if all requirements are met
        if (subscriptionActive === true && kycStatus === "APPROVED" && exchangeConnected === true) {
          return NextResponse.redirect(new URL("/dashboard", req.url));
        }
        
        // Handle NOT_STARTED KYC status
        if (kycStatus === "NOT_STARTED") {
          if (pathname.startsWith("/kyc")) {
            return NextResponse.next();
          } else {
            return NextResponse.redirect(new URL("/kyc", req.url));
          }
        }
        
        // Handle PENDING KYC status
        if (kycStatus === "PENDING") {
          return NextResponse.redirect(new URL("/kyc-waiting", req.url));
        }
        
        // Handle APPROVED KYC status
        if (kycStatus === "APPROVED") {
          // Check if subscription is active
          if (subscriptionActive !== true && 
              (pathname.startsWith("/connect-exchange"))) {
            return NextResponse.redirect(new URL("/pricing", req.url));
          }
          
          // Allow access to connect-exchange page when needed
          if (pathname.startsWith("/connect-exchange")) {
            if (exchangeConnected === true && subscriptionActive === true) {
              return NextResponse.redirect(new URL("/dashboard", req.url));
            }
            return NextResponse.next();
          }
          
          // Redirect from KYC pages when already approved
          if (pathname.startsWith("/kyc")) {
            if (subscriptionActive === true) {
              url.pathname = exchangeConnected === true ? "/dashboard" : "/connect-exchange";
            } else {
              url.pathname = "/pricing";
            }
            return NextResponse.redirect(url);
          }
        }
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
    "/stripe-success"
  ]
};