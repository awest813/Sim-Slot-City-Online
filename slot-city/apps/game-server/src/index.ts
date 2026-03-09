import { Server } from "colyseus";
import { monitor } from "@colyseus/monitor";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { LobbyRoom } from "./rooms/LobbyRoom";
import { PokerTableRoom } from "./rooms/PokerTableRoom";
import { BarRoom } from "./rooms/BarRoom";
import { BlackjackTableRoom } from "./rooms/BlackjackTableRoom";
import { authRouter } from "./services/AuthService";
import { apiRouter } from "./services/ApiRoutes";
import { RoomType } from "@slot-city/shared";

const PORT = parseInt(process.env.PORT || "2567");

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

// Auth routes
app.use("/auth", authRouter);

// Public API routes
app.use("/", apiRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const httpServer = createServer(app);

const gameServer = new Server({
  server: httpServer,
});

gameServer.define(RoomType.LOBBY as string, LobbyRoom).enableRealtimeListing();
gameServer.define(RoomType.POKER as string, PokerTableRoom).enableRealtimeListing();
gameServer.define(RoomType.BAR as string, BarRoom).enableRealtimeListing();
gameServer.define(RoomType.BLACKJACK as string, BlackjackTableRoom).enableRealtimeListing();

if (process.env.NODE_ENV !== "production") {
  app.use("/colyseus", monitor());
}

gameServer.listen(PORT).then(() => {
  console.log(`🎰 Slot City Game Server running on ws://localhost:${PORT}`);
  console.log(`📊 Colyseus Monitor: http://localhost:${PORT}/colyseus`);
});

export { gameServer, app };
