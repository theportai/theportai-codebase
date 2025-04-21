import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJwtToken } from "./utils/jwt";

const PROTECTED_ROUTES = ["/dashboard", "/connect-exchange", "/kyc", "/kyc-waiting", "/pricing", "/welcome"];
const PUBLIC_ROUTES = ["/login", "/signup"];
const BYPASS_ROUTES = ["/stripe-success", "/api/stripe-success"];

const AUTH_PAGE = "/signup";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Completely bypass middleware for specific routes
  if (BYPASS_ROUTES.some(route => pathname === route || pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  const token = req.cookies.get("userToken")?.value || req.cookies.get("token")?.value;
  
  // Handle protected routes
  if (PROTECTED_ROUTES.some(route => pathname === route || pathname.startsWith(route))) {
    
    if (!token) {
      console.log("No token found, redirecting to auth");
      return NextResponse.redirect(new URL(AUTH_PAGE, req.url));
    }

    // Verify token structure only (no database operations)
    const payload = await verifyJwtToken(token);
    if (!payload) {
      console.error("Invalid JWT Token");
      const response = NextResponse.redirect(new URL(AUTH_PAGE, req.url));
      response.cookies.delete("token");
      response.cookies.delete("userToken");
      return response;
    }

    try {
      // Use the data from token for navigation decisions
      const { kycStatus, exchangeConnected, subscriptionActive, isNewUser } = payload;
      
      console.log(`Middleware check: ${pathname}, User status:`, {
        kycStatus,
        exchangeConnected,
        subscriptionActive,
        isNewUser
      });
      
      // If the user is new and trying to access any route other than welcome, redirect to welcome
      if (isNewUser === true && pathname !== "/welcome") {
        return NextResponse.redirect(new URL("/welcome", req.url));
      }
      
      // Handle normal user flow based on KYC status
      if (kycStatus === "NOT_STARTED") {
        // If user hasn't started KYC and trying to access any protected route except KYC or welcome
        if (pathname !== "/kyc" && !pathname.startsWith("/kyc/") && pathname !== "/welcome") {
          return NextResponse.redirect(new URL("/kyc", req.url));
        }
      } else if (kycStatus === "PENDING") {
        // If KYC is pending, user should be on kyc-waiting
        if (pathname !== "/kyc-waiting" && !pathname.startsWith("/kyc-waiting/")) {
          return NextResponse.redirect(new URL("/kyc-waiting", req.url));
        }
      } else if (kycStatus === "APPROVED") {
        // KYC is approved, check exchange connection
        if (!exchangeConnected) {
          // If exchange not connected and user not on connect-exchange page
          if (pathname !== "/connect-exchange" && !pathname.startsWith("/connect-exchange/")) {
            return NextResponse.redirect(new URL("/connect-exchange", req.url));
          }
        } else {
          // Exchange is connected, now check subscription status
          if (subscriptionActive === true) {
            // If subscription is active and user tries to access earlier steps, redirect to dashboard
            if ((pathname === "/pricing" || pathname === "/kyc" || pathname === "/kyc-waiting" || 
                pathname === "/connect-exchange" || pathname === "/welcome")) {
              return NextResponse.redirect(new URL("/dashboard", req.url));
            }
          } else {
            // If subscription is not active (false or undefined), direct to pricing
            // unless they're already on pricing page
            if (pathname !== "/pricing") {
              return NextResponse.redirect(new URL("/pricing", req.url));
            }
          }
        }
      }
      
      return NextResponse.next();
    } catch (err) {
      console.error("Error processing token data:", err);
      return NextResponse.redirect(new URL(AUTH_PAGE, req.url));
    }
  }
  
  // For public routes or unmatched routes, proceed without redirection
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
    "/stripe-success/:path*",
    "/api/stripe-success"
  ]
};