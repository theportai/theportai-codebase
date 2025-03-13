import jwt, { Secret, SignOptions, JwtPayload } from "jsonwebtoken";

const SECRET: Secret = process.env.JWT_SECRET || "your_secret_key"; 

// Function to sign JWT Token
export function signJwtToken(payload: Record<string, unknown>, expiresIn: string | number = "7d"): string {
  const options: SignOptions = {
    expiresIn: typeof expiresIn === "number" ? expiresIn : (expiresIn as unknown as SignOptions["expiresIn"])
  }; 
  return jwt.sign(payload, SECRET, options);
}

// Function to verify JWT Token
export function verifyJwtToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as JwtPayload;
  } catch {
    return null;
  }
}