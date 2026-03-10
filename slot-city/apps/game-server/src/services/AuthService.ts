import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { STARTING_CHIPS } from "@slot-city/shared";

const prisma = new PrismaClient();
export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "slot-city-dev-secret-change-in-prod";
const JWT_EXPIRES_IN = "7d";

// Rate limiter for sensitive auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
  if (typeof decoded.userId !== "string" || !decoded.userId) {
    throw new Error("Invalid token: missing userId");
  }
  return { userId: decoded.userId };
}

// POST /auth/register
authRouter.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username: string; password: string };

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }
    if (username.length < 3 || username.length > 20) {
      res.status(400).json({ error: "Username must be 3-20 characters" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      res.status(400).json({ error: "Username may only contain letters, numbers, _ and -" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { username, passwordHash, chips: STARTING_CHIPS },
      select: { id: true, username: true, chips: true, createdAt: true },
    });

    // Create leaderboard entry
    await prisma.leaderboardEntry.create({
      data: { userId: user.id },
    });

    const token = generateToken(user.id);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/login
authRouter.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username: string; password: string };

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, chips: true, passwordHash: true, createdAt: true },
    });

    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = generateToken(user.id);
    const { passwordHash: _ph, ...publicUser } = user;
    res.json({ token, user: publicUser });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /auth/me  (requires Bearer token)
authRouter.get("/me", apiLimiter, async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token provided" });
      return;
    }
    const token = auth.slice(7);
    const { userId } = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, chips: true, outfitId: true, createdAt: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});
