
import { createRemoteJWKSet, jwtVerify } from "jose";

const authUrl = process.env.CLIENT_URL || "http://localhost:3000";

const JWKS = createRemoteJWKSet(
  new URL(`${authUrl}/api/auth/jwks`)
);

// Verify JWT
export const verifyToken = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login.",
      });
    }

    const token = authorization.split(" ")[1];

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: authUrl,
      audience: authUrl,
    });

    req.user = payload;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

// Admin Only
export const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only.",
    });
  }

  next();
};
