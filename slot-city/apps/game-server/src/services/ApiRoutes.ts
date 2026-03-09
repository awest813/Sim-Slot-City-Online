import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken, apiLimiter } from "./AuthService";
import { globalTournamentManager } from "../rooms/BarRoom";

const prisma = new PrismaClient();
export const apiRouter = Router();

// GET /leaderboard
apiRouter.get("/leaderboard", async (_req: Request, res: Response) => {
  try {
    const entries = await prisma.leaderboardEntry.findMany({
      orderBy: { totalChipsWon: "desc" },
      take: 50,
      include: {
        user: { select: { username: true } },
      },
    });
    const result = entries.map((e, i) => ({
      rank: i + 1,
      userId: e.userId,
      username: e.user.username,
      totalChipsWon: e.totalChipsWon,
      tournamentWins: e.tournamentWins,
      gamesPlayed: e.gamesPlayed,
    }));
    res.json(result);
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /tournaments
apiRouter.get("/tournaments", async (_req: Request, res: Response) => {
  try {
    const summaries = globalTournamentManager.getAllSummaries();
    res.json(summaries);
  } catch (err) {
    console.error("Tournaments list error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /tournaments (create a new tournament)
apiRouter.post("/tournaments", apiLimiter, async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { userId } = verifyToken(auth.slice(7));
    const { name, buyIn, maxPlayers, blindIncreaseMinutes } = req.body as {
      name: string;
      buyIn: number;
      maxPlayers: number;
      blindIncreaseMinutes?: number;
    };

    if (!name || !buyIn || !maxPlayers) {
      res.status(400).json({ error: "name, buyIn, and maxPlayers are required" });
      return;
    }
    if (maxPlayers < 2 || maxPlayers > 50) {
      res.status(400).json({ error: "maxPlayers must be between 2 and 50" });
      return;
    }

    const tournament = globalTournamentManager.createTournament({
      name: name.slice(0, 50),
      buyIn: Math.max(0, buyIn),
      maxPlayers,
      blindIncreaseMinutes,
    });

    // Save to DB
    await prisma.tournament.create({
      data: {
        id: tournament.id,
        name: tournament.name,
        buyIn: tournament.buyIn,
        maxPlayers: tournament.maxPlayers,
        blindIncreaseMinutes: tournament.blindIncreaseMinutes,
      },
    });

    res.status(201).json(globalTournamentManager.getSummary(tournament.id));
  } catch (err) {
    console.error("Create tournament error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /profile/:userId/stats
apiRouter.get("/profile/:userId/stats", apiLimiter, async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { userId: requesterId } = verifyToken(auth.slice(7));
    const { userId } = req.params;

    // Only allow viewing own stats for now
    if (requesterId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const entry = await prisma.leaderboardEntry.findUnique({
      where: { userId },
    });

    res.json({
      totalChipsWon: entry?.totalChipsWon ?? 0,
      tournamentWins: entry?.tournamentWins ?? 0,
      gamesPlayed: entry?.gamesPlayed ?? 0,
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});
