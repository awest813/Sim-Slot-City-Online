import { TournamentStatus } from "@slot-city/shared";

const API_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL || "http://localhost:2567";

interface TournamentSummary {
  id: string;
  name: string;
  buyIn: number;
  prizePool: number;
  maxPlayers: number;
  registeredPlayers: number;
  status: TournamentStatus;
  startTime: number | null;
  blindLevel: number;
  blindIncreaseMinutes: number;
}

async function getTournaments(): Promise<TournamentSummary[]> {
  try {
    const res = await fetch(`${API_URL}/tournaments`, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

const STATUS_LABELS: Record<TournamentStatus, { label: string; badge: string }> = {
  [TournamentStatus.WAITING_FOR_PLAYERS]: { label: "Registration Open", badge: "badge-green" },
  [TournamentStatus.STARTING]: { label: "Starting Soon", badge: "badge-yellow" },
  [TournamentStatus.RUNNING]: { label: "In Progress", badge: "badge-blue" },
  [TournamentStatus.FINAL_TABLE]: { label: "Final Table", badge: "badge-yellow" },
  [TournamentStatus.FINISHED]: { label: "Finished", badge: "badge-gray" },
};

export default async function TournamentsPage() {
  const tournaments = await getTournaments();

  return (
    <main>
      <nav>
        <div className="nav-inner">
          <a href="/" className="logo">🎰 Slot City</a>
          <a href="/leaderboard">Leaderboard</a>
          <a href="/tournaments">Tournaments</a>
          <a href="/profile">Profile</a>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: "40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <h1 style={{ color: "#ffd700" }}>🏆 Tournaments</h1>
          <span style={{ color: "#888888", fontSize: "12px" }}>Updates every 30 seconds</span>
        </div>
        <p style={{ color: "#888888", marginBottom: "32px", fontSize: "13px" }}>
          Join tournaments in-game to register. Buy-in is deducted from your chip balance.
        </p>

        {tournaments.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "60px" }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>🎯</div>
            <p style={{ color: "#888888" }}>No active tournaments right now.</p>
            <p style={{ color: "#555555", fontSize: "12px", marginTop: "8px" }}>
              Jump into the game and create one from the lobby!
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            {tournaments.map((t) => {
              const statusInfo = STATUS_LABELS[t.status] ?? { label: t.status, badge: "badge-gray" };
              const spotsLeft = t.maxPlayers - t.registeredPlayers;
              return (
                <div key={t.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h3 style={{ color: "#ffffff", marginBottom: "8px" }}>{t.name}</h3>
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        <span className="chip">Buy-in: {t.buyIn.toLocaleString()} chips</span>
                        <span className="chip">Prize: {t.prizePool.toLocaleString()} chips</span>
                        <span style={{ color: "#888888", fontSize: "12px" }}>
                          Players: {t.registeredPlayers}/{t.maxPlayers}
                        </span>
                        <span style={{ color: "#888888", fontSize: "12px" }}>
                          Blinds every {t.blindIncreaseMinutes}min
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className={`badge ${statusInfo.badge}`} style={{ display: "block", marginBottom: "8px" }}>
                        {statusInfo.label}
                      </span>
                      {t.status === TournamentStatus.WAITING_FOR_PLAYERS && (
                        <span style={{ color: "#44ff88", fontSize: "12px" }}>
                          {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
                        </span>
                      )}
                      {t.startTime && (
                        <span style={{ color: "#888888", fontSize: "11px", display: "block" }}>
                          Started: {new Date(t.startTime).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {t.status === TournamentStatus.RUNNING && (
                    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #1a1a4e" }}>
                      <span style={{ color: "#888888", fontSize: "12px" }}>
                        Blind Level: {t.blindLevel} • Active in-game
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
