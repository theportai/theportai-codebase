import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJwtToken } from "./utils/jwt";

const PROTECTED_ROUTES = ["/dashboard", "/connect-exchange", "/kyc", "/kyc-waiting", "/pricing", "/welcome"];
const PUBLIC_ROUTES = ["/login", "/signup"];
const BYPASS_ROUTES = ["/stripe-success", "/api/stripe-success", "/api/otp", "/api/auth/refresh-token", "/api/user-status"];

const AUTH_PAGE = "/signup";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  
  console.log(`Middleware processing: ${pathname}`);
  
  // Get all cookies we might need
  const token = req.cookies.get("userToken")?.value || req.cookies.get("token")?.value;
  const postAuthAction = req.cookies.get("postAuthAction")?.value === "true";
  const paymentSuccess = req.cookies.get("paymentSuccess")?.value === "true";
  const forceRedirect = req.cookies.get("forceRedirect")?.value;
  
  // CRITICAL FIX: Check for special bypass cookie that indicates a real KYC approval
  const kycApproved = req.cookies.get("kycApproved")?.value === "true";
  
  // Check if there's a payment success flag in URL (our backup mechanism)
  const isPaymentSuccessURL = req.nextUrl.searchParams.get("payment") === "success";
  
  // Completely bypass middleware for specific routes
  if (BYPASS_ROUTES.some(route => pathname === route || pathname.startsWith(route))) {
    console.log(`Bypassing middleware for ${pathname}`);
    return NextResponse.next();
  }
  
  // Special handling for post-payment flows
  if ((paymentSuccess || isPaymentSuccessURL) && token && pathname !== "/dashboard") {
    console.log("Payment success detected, redirecting to dashboard");
    const response = NextResponse.redirect(new URL("/dashboard", req.url));
    // Clean up the cookies
    if (paymentSuccess) {
      response.cookies.delete("paymentSuccess");
    }
    return response;
  }
  
  // CRITICAL FIX: Handle KYC approval override
  // This takes precedence over token data when we know the user has a fresh KYC approval
  if (kycApproved && forceRedirect === "/connect-exchange" && pathname !== "/connect-exchange") {
    console.log("KYC override detected - allowing redirect to connect-exchange");
    const response = NextResponse.redirect(new URL("/connect-exchange", req.url));
    // Keep the kycApproved cookie but remove forceRedirect to prevent loops
    response.cookies.delete("forceRedirect");
    return response;
  }
  
  // Handle force redirect if present (used by frontend for critical redirects)
  if (forceRedirect && token) {
    console.log(`Force redirect detected to: ${forceRedirect}`);
    
    // CRITICAL FIX: Check redirect destination against user status to prevent loops
    const payload = await verifyJwtToken(token);
    if (payload) {
      // Extract user status from token
      const { kycStatus } = payload;
      
      // If trying to go to connect-exchange but KYC is not approved in token
      if (forceRedirect === "/connect-exchange" && kycStatus !== "APPROVED") {
        console.log("Potential redirect loop detected. Checking if it's from kyc-waiting...");
        
        // If coming from kyc-waiting, this might be a real approval that the token doesn't know about yet
        const referer = req.headers.get("referer") || "";
        if (referer.includes("/kyc-waiting")) {
          console.log("Coming from kyc-waiting - setting override cookie and proceeding with redirect");
          const response = NextResponse.redirect(new URL(forceRedirect, req.url));
          // Set a special override cookie with short expiry
          response.cookies.set("kycApproved", "true", { 
            path: "/", 
            maxAge: 60, // 1 minute expiry
            httpOnly: true,
            sameSite: "strict" 
          });
          response.cookies.delete("forceRedirect");
          return response;
        } else {
          // Not coming from kyc-waiting, might be a stale redirect attempt
          console.log("Blocking potential redirect loop - clearing cookies");
          const response = NextResponse.redirect(new URL("/kyc-waiting", req.url));
          response.cookies.delete("forceRedirect");
          return response;
        }
      }

      // Normal force redirect processing - no issues detected
      const response = NextResponse.redirect(new URL(forceRedirect, req.url));
      response.cookies.delete("forceRedirect");
      return response;
    }
  }
  
  // Special case for handling post-login redirects
  if (postAuthAction && token) {
    // For users coming from OTP verification or payment, check their status
    const payload = await verifyJwtToken(token);
    if (payload) {
      const { redirectTo } = payload;
      
      console.log(`Post-Auth Middleware check: ${pathname}, Redirecting to: ${redirectTo}`);
      
      // Clear the post-auth cookie as we're handling the redirect now
      const response = NextResponse.redirect(new URL(redirectTo || "/dashboard", req.url));
      response.cookies.delete("postAuthAction");
      return response;
    }
  }
  
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
      const { kycStatus, exchangeConnected, subscriptionActive, isNewUser, paymentSuccess } = payload;
      
      console.log(`Middleware check: ${pathname}, User status:`, {
        kycStatus,
        exchangeConnected,
        subscriptionActive,
        isNewUser,
        paymentSuccess
      });
      
      // CRITICAL FIX: If kycApproved cookie is set, treat user as having APPROVED status
      // This lets fresh API approvals override the token data temporarily
      const effectiveKycStatus = kycApproved ? "APPROVED" : kycStatus;
      
      // Special case: If this is immediately after payment and trying to access dashboard
      if (paymentSuccess === true && pathname === "/dashboard") {
        // Allow direct access to dashboard
        return NextResponse.next();
      }
      
      // Special case for welcome to KYC flow
      if (isNewUser === true && pathname === "/kyc") {
        console.log("New user accessing KYC from welcome page - allowing");
        return NextResponse.next();
      }
      
      // Priority for new users - welcome page first
      if (isNewUser === true) {
        if (pathname !== "/welcome") {
          return NextResponse.redirect(new URL("/welcome", req.url));
        } else {
          // Already on welcome page, proceed
          return NextResponse.next();
        }
      }
      
      // CRITICAL FIX: Handle KYC APPROVED state first to ensure proper flow
      // Now using effectiveKycStatus which might be overridden by cookie
      if (effectiveKycStatus === "APPROVED") {
        // If on connect-exchange page with APPROVED status (real or temporary), always allow
        if (pathname === "/connect-exchange") {
          console.log("KYC APPROVED user accessing connect-exchange - allowing");
          return NextResponse.next();
        }
        
        // KYC is approved, check exchange connection
        if (!exchangeConnected) {
          // If exchange not connected and user not on connect-exchange page
          if (pathname !== "/connect-exchange" && !pathname.startsWith("/connect-exchange/")) {
            console.log("KYC APPROVED but exchange not connected - redirecting to connect-exchange");
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
      // Handle other KYC states
      else if (kycStatus === "NOT_STARTED") {
        // If user hasn't started KYC and trying to access any protected route except welcome
        if (pathname === "/welcome") {
          // Let them stay on welcome if that's where they need to be
          return NextResponse.next();
        } else if (pathname !== "/kyc" && !pathname.startsWith("/kyc/")) {
          // Only redirect to KYC if they're not already there and not on welcome
          return NextResponse.redirect(new URL("/kyc", req.url));
        }
      } else if (kycStatus === "PENDING") {
        // CRITICAL FIX: Special case - if coming from connect-exchange to kyc-waiting, this is likely a redirect loop
        // Allow staying on kyc-waiting to break the loop
        if (pathname === "/kyc-waiting") {
          console.log("KYC PENDING - allowing to stay on kyc-waiting");
          
          // Clear any problematic cookies to prevent further loops
          const response = NextResponse.next();
          response.cookies.delete("forceRedirect");
          return response;
        }
        
        // If KYC is pending and not on kyc-waiting, redirect there
        if (pathname !== "/kyc-waiting" && !pathname.startsWith("/kyc-waiting/")) {
          console.log("KYC PENDING - redirecting to kyc-waiting");
          return NextResponse.redirect(new URL("/kyc-waiting", req.url));
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

// Update matcher to include all required paths and the dashboard query param
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