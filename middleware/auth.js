
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ObjectId } from "mongodb";

const authUrl = process.env.CLIENT_URL || "http://localhost:3000";

const JWKS = createRemoteJWKSet(
  new URL(`${authUrl}/api/auth/jwks`)
);

// Verify JWT and fetch current user from MongoDB
export const verifyToken = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login.",
      });
    }

    const token = authorization.slice(7);

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: authUrl,
      audience: authUrl,
    });

    if (!payload.sub) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User ID missing.",
      });
    }

    const db = req.app.locals.db;
    const userId = payload.sub;

    // Find user using string ID or MongoDB ObjectId
    const userQuery = [{ id: userId }];

    if (ObjectId.isValid(userId)) {
      userQuery.push(
        { _id: new ObjectId(userId) },
        { _id: userId }
      );
    }

    const user = await db.collection("user").findOne({
      $or: userQuery,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    // Check blocked account
    if (user.isBlocked === true || user.banned === true) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

const verifyRole = (role, roleLabel) => (req, res, next) => {
  if (req.user?.role !== role) {
    return res.status(403).json({
      success: false,
      message: `Access denied. ${roleLabel} only.`,
    });
  }

  next();
};

export const verifyAdmin = verifyRole("admin", "Admin");
export const verifyCustomer = verifyRole("customer", "Customer");
