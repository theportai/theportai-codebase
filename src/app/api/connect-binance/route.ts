import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";
import prisma from "@/lib/prisma.mjs";
import vault from "@/core/vault";
import crypto from "crypto";

// Constants
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("❌ JWT_SECRET environment variable not set");
}
const secretBytes = new TextEncoder().encode(JWT_SECRET || "fallback_secret");

// Simple in-memory rate limiter (resets on server restart)
class SimpleRateLimiter {
    private requests: Map<string, { count: number; resetTime: number }>;
    private readonly limit: number;
    private readonly windowMs: number;

    constructor(limit = 5, windowMs = 60000) {
        this.requests = new Map();
        this.limit = limit;
        this.windowMs = windowMs;
    }

    check(key: string): boolean {
        const now = Date.now();
        const requestInfo = this.requests.get(key);

        // If no previous requests or window expired, reset counter
        if (!requestInfo || now > requestInfo.resetTime) {
            this.requests.set(key, {
                count: 1,
                resetTime: now + this.windowMs
            });
            return true;
        }

        // If under limit, increment counter
        if (requestInfo.count < this.limit) {
            requestInfo.count += 1;
            return true;
        }

        // Rate limit exceeded
        return false;
    }
}

// Create limiter: 5 requests per minute
const rateLimiter = new SimpleRateLimiter(5, 60 * 1000);

export async function POST(req: NextRequest) {
    // Get client IP for rate limiting
    const ip = req.headers.get("x-forwarded-for") || req.ip || "anonymous";

    try {
        // Apply rate limiting
        if (!rateLimiter.check(ip)) {
            return NextResponse.json(
                { error: "Too many connection attempts. Please try again later." },
                { status: 429 }
            );
        }

        // Log all cookies for debugging
        console.log("🔍 Cookies received:", JSON.stringify([...req.cookies.getAll()]));

        // 1. Authenticate user with JWT from cookie
        const token = req.cookies.get("userToken")?.value;
        if (!token) {
            console.error("❌ No userToken cookie found in request");
            return NextResponse.json(
                { error: "Authentication required. Please log in." },
                { status: 401 }
            );
        }

        // Log token details (first few characters) for debugging
        console.log(`🔑 Token found (starts with): ${token.substring(0, 10)}...`);

        // Verify token
        let payload;
        try {
            const verifyResult = await jose.jwtVerify(token, secretBytes);
            payload = verifyResult.payload;
            console.log("✅ JWT verified successfully");
            console.log("📊 JWT payload:", payload);
        } catch (error: any) {
            console.error("❌ JWT verification failed:", error.code, error.message);

            // Check for common JWT errors
            if (error.code === "ERR_JWT_EXPIRED") {
                return NextResponse.json(
                    { error: "Your session has expired. Please log in again." },
                    { status: 401 }
                );
            } else if (error.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED") {
                return NextResponse.json(
                    { error: "Invalid session signature. Please log in again." },
                    { status: 401 }
                );
            } else {
                return NextResponse.json(
                    { error: "Invalid authentication token" },
                    { status: 401 }
                );
            }
        }

        // Extract user information from payload with proper fallbacks
        const phone = payload.phone as string;

        // Since userId is missing in the JWT, look up the user in the database first
        let userId = (payload.userId as string) || "";

        try {
            // Try to find user in database by phone
            if (!userId && phone) {
                const existingUser = await prisma.user.findFirst({
                    where: { phone }
                });

                if (existingUser) {
                    userId = existingUser.id;
                    console.log("🔍 Found user in database with phone:", phone);
                } else {
                    // Fallback to generated userId if not found in database
                    userId = `user_${phone}`;
                    console.log("⚠️ Generated userId from phone:", userId);
                }
            }
        } catch (dbError) {
            console.error("❌ Error looking up user in database:", dbError);
            // Continue with generated userId
            if (!userId && phone) {
                userId = `user_${phone}`;
                console.log("⚠️ Generated userId from phone after DB error:", userId);
            }
        }

        if (!userId || !phone) {
            console.error("❌ Missing user info in JWT payload:", payload);
            return NextResponse.json(
                { error: "Invalid user information in token" },
                { status: 401 }
            );
        }

        console.log("👤 User authenticated:", { userId, phone: phone.substring(0, 6) + "..." });

        // 2. Validate request body
        const body = await req.json();
        const { apiKey, apiSecret, exchangeId } = body;

        // Input validation
        if (!apiKey || typeof apiKey !== "string") {
            return NextResponse.json(
                { error: "API key is required" },
                { status: 400 }
            );
        }

        if (!apiSecret || typeof apiSecret !== "string") {
            return NextResponse.json(
                { error: "API secret is required" },
                { status: 400 }
            );
        }

        // Optional exchangeId validation for multi-exchange support
        if (exchangeId && exchangeId !== "binance") {
            return NextResponse.json(
                { error: "Unsupported exchange" },
                { status: 400 }
            );
        }

        // 3. Validate Binance credentials
        // Prepare Binance API request
        const timestamp = Date.now();
        const query = `timestamp=${timestamp}`;
        const signature = crypto
            .createHmac("sha256", apiSecret)
            .update(query)
            .digest("hex");

        console.log("🔄 Verifying Binance credentials...");
        
        // Initialize variables for API checking
        let binanceData: any = null;
        let isValidCredentials = false;
        let apiPermissions = {
            canTrade: false,
            canDeposit: false,
            canWithdraw: false
        };

        // Try account status endpoint first - this seems to work in your logs
        try {
            console.log("🔄 Trying account status endpoint...");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const statusResponse = await fetch(
                `https://api.binance.com/sapi/v1/account/status?${query}&signature=${signature}`,
                {
                    method: "GET",
                    headers: {
                        "X-MBX-APIKEY": apiKey,
                        "Accept": "application/json"
                    },
                    signal: controller.signal,
                }
            );
            clearTimeout(timeoutId);
            
            console.log("📊 Binance status API response:", statusResponse.status);
            
            // Process the status response
            if (statusResponse.ok) {
                const statusText = await statusResponse.text();
                console.log("📦 Binance status response:", statusText);
                
                try {
                    const statusData = JSON.parse(statusText);
                    
                    // Check if account is in normal state
                    if (statusData && statusData.data === "Normal") {
                        console.log("✅ Binance account status is Normal");
                        binanceData = statusData;
                        isValidCredentials = true;
                        
                        // Set basic permissions since account/status endpoint doesn't provide detailed permissions
                        apiPermissions = {
                            canTrade: true, // Assuming user can trade if status is Normal
                            canDeposit: true,
                            canWithdraw: true
                        };
                    } else {
                        console.warn("⚠️ Unusual account status:", statusData);
                    }
                } catch (jsonError) {
                    console.error("❌ Invalid JSON from status endpoint:", jsonError);
                }
            } else {
                // Get error message for logging
                try {
                    const errorText = await statusResponse.text();
                    console.error("❌ Status endpoint error:", statusResponse.status, errorText);
                } catch (e) {
                    console.error("❌ Status endpoint error:", statusResponse.status);
                }
            }
            
            // If status endpoint didn't work, try account info endpoint
            if (!isValidCredentials) {
                console.log("🔄 Status endpoint failed or returned non-normal status, trying account info endpoint...");
                
                const accountController = new AbortController();
                const accountTimeoutId = setTimeout(() => accountController.abort(), 10000);
                
                const accountResponse = await fetch(
                    `https://api.binance.com/api/v3/account?${query}&signature=${signature}`,
                    {
                        method: "GET",
                        headers: {
                            "X-MBX-APIKEY": apiKey,
                            "Accept": "application/json"
                        },
                        signal: accountController.signal,
                    }
                );
                clearTimeout(accountTimeoutId);
                
                console.log("📊 Binance account API response:", accountResponse.status);
                
                if (accountResponse.ok) {
                    const accountText = await accountResponse.text();
                    console.log("📦 Binance account response (first 100 chars):", 
                        accountText.length > 100 ? accountText.substring(0, 100) + "..." : accountText);
                    
                    try {
                        const accountData = JSON.parse(accountText);
                        
                        // If we got valid account data, use it
                        if (accountData && (accountData.accountType || accountData.makerCommission !== undefined)) {
                            console.log("✅ Got valid account info");
                            binanceData = accountData;
                            isValidCredentials = true;
                            
                            // Extract permissions
                            apiPermissions = {
                                canTrade: true, // If we got account info, trading is permitted
                                canDeposit: accountData.canDeposit === true,
                                canWithdraw: accountData.canWithdraw === true
                            };
                        }
                    } catch (jsonError) {
                        console.error("❌ Invalid JSON from account endpoint:", jsonError);
                    }
                } else {
                    // Get error message for logging
                    try {
                        const errorText = await accountResponse.text();
                        console.error("❌ Account endpoint error:", accountResponse.status, errorText);
                    } catch (e) {
                        console.error("❌ Account endpoint error:", accountResponse.status);
                    }
                }
            }

        } catch (error: any) {
            const errorMessage = error.name === "AbortError"
                ? "Connection to Binance timed out"
                : "Failed to connect to Binance";

            console.error("❌ Binance API connection error:", error);
            return NextResponse.json(
                { error: errorMessage },
                { status: 502 }
            );
        }

        // Check if we were able to validate the credentials
        if (!isValidCredentials || !binanceData) {
            console.error("❌ Failed to validate Binance credentials");
            return NextResponse.json(
                { error: "Invalid API key or secret. Please check your credentials and try again." },
                { status: 401 }
            );
        }

        // 6. Save to Vault with retry mechanism
        let vaultSuccess = false;
        let vaultAttempts = 0;
        const maxVaultAttempts = 3;

        while (!vaultSuccess && vaultAttempts < maxVaultAttempts) {
            try {
                vaultAttempts++;
                console.log(`🔒 Saving credentials to vault for user (attempt ${vaultAttempts}):`, userId);
                await vault.setUserKey(userId, "BINANCE_API_KEY", apiKey);
                await vault.setUserKey(userId, "BINANCE_API_SECRET", apiSecret);
                vaultSuccess = true;
                console.log("✅ Credentials saved to vault successfully");
            } catch (error) {
                console.error(`❌ Failed to store keys in Vault (attempt ${vaultAttempts}):`, error);
                // Wait briefly before retrying
                if (vaultAttempts < maxVaultAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }

        if (!vaultSuccess) {
            return NextResponse.json(
                { error: "Failed to securely store your exchange credentials" },
                { status: 500 }
            );
        }

        // 7. Update DB: Mark exchange connected
        try {
            console.log("💾 Updating user database record");

            // First check if the user exists in DB by phone number
            const existingUser = await prisma.user.findFirst({
                where: { phone: phone }
            });

            if (existingUser) {
                // Use the actual userId from database
                userId = existingUser.id;

                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        exchangeConnected: true,
                        // Add timestamp for audit
                        updatedAt: new Date(),
                    },
                });
                console.log("✅ User database updated successfully");
            } else {
                // Try to create the user record if it doesn't exist
                try {
                    const newUser = await prisma.user.create({
                        data: {
                            id: userId,
                            phone: phone,
                            exchangeConnected: true,
                            kycStatus: payload.kycStatus as string || "PENDING",
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        },
                    });
                    console.log("✅ New user created in database:", newUser.id);
                } catch (createError) {
                    console.error("❌ Failed to create new user in database:", createError);
                    // Continue even if user creation fails - we have the data in the vault already
                }
            }
        } catch (error) {
            console.error("❌ Failed to update user database:", error);

            // Attempt to roll back vault changes
            try {
                console.log("🔄 Rolling back vault changes");
                await vault.deleteUserKey(userId, "BINANCE_API_KEY");
                await vault.deleteUserKey(userId, "BINANCE_API_SECRET");
                console.log("✅ Vault rollback successful");
            } catch (rollbackError) {
                console.error("❌ Failed to roll back vault changes:", rollbackError);
            }

            return NextResponse.json(
                { error: "Database update failed" },
                { status: 500 }
            );
        }

        // 8. Audit logging for successful connection
        console.log("✅ Binance connected for user:", phone, "userId:", userId);

        // 9. Generate new JWT with updated exchange status
        console.log("🔄 Generating new JWT with updated exchange status");
        const kycStatus = payload.kycStatus || "PENDING";
        const newToken = await new jose.SignJWT({
            phone: phone,
            userId: userId,
            kycStatus: kycStatus,
            exchangeConnected: true  // This is the key change - update exchange status in the token
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('24h')
            .sign(secretBytes);
        
        console.log("✅ New JWT generated with exchangeConnected: true");

        // 10. Create response with the new token as a cookie
        const response = NextResponse.json({
            success: true,
            message: "Binance connected successfully",
            exchangeId: "binance",
            account: {
                status: binanceData?.data || "Normal",
                ...apiPermissions
            }
        });

        // Set the new token as a cookie
        response.cookies.set({
            name: "userToken",
            value: newToken,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
        });

        console.log("🍪 Updated JWT cookie set in response");
        return response;

    } catch (err) {
        console.error("🔥 Unhandled error in connect-binance API:", err);
        return NextResponse.json(
            { error: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}