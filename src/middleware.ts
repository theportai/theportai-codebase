import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose";

const PROTECTED_ROUTES = ["/dashboard", "/connect-exchange", "/kyc", "/kyc-waiting"];
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const secretBytes = new TextEncoder().encode(JWT_SECRET);

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const url = req.nextUrl.clone();

    if (!PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    const token = req.cookies.get("userToken")?.value;
    if (!token) {
        url.pathname = "/signup";
        return NextResponse.redirect(url);
    }

    try {
        const { payload } = await jose.jwtVerify(token, secretBytes);
        const { kycStatus, exchangeConnected } = payload as any;

        console.log(`Middleware: Path=${pathname}, KYC=${kycStatus}, Exchange=${exchangeConnected}`);

        // Handle NOT_STARTED KYC status
        if (kycStatus === "NOT_STARTED") {
            if (pathname.startsWith("/kyc")) {
                return NextResponse.next();
            } else if (pathname === "/kyc-waiting" || 
                      pathname.startsWith("/connect-exchange") || 
                      pathname.startsWith("/dashboard")) {
                url.pathname = "/kyc";
                return NextResponse.redirect(url);
            }
        }

        // Handle PENDING KYC status
        if (kycStatus === "PENDING") {
            if (pathname.startsWith("/kyc-waiting")) {
                return NextResponse.next();
            } else if (pathname.startsWith("/kyc") || 
                      pathname.startsWith("/connect-exchange") || 
                      pathname.startsWith("/dashboard")) {
                url.pathname = "/kyc-waiting";
                return NextResponse.redirect(url);
            }
        }

        // Handle APPROVED KYC status
        if (kycStatus === "APPROVED") {
            if (pathname.startsWith("/dashboard")) {
                if (!exchangeConnected) {
                    url.pathname = "/connect-exchange";
                    return NextResponse.redirect(url);
                }
                return NextResponse.next();
            } else if (pathname.startsWith("/connect-exchange")) {
                return NextResponse.next();
            } else if (pathname.startsWith("/kyc") || 
                      pathname.startsWith("/kyc-waiting")) {
                url.pathname = exchangeConnected ? "/dashboard" : "/connect-exchange";
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
    matcher: PROTECTED_ROUTES,
};