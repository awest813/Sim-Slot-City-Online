const API_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL || "http://localhost:2567";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  totalChipsWon: number;
  tournamentWins: number;
  gamesPlayed: number;
}

async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${API_URL}/leaderboard`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function LeaderboardPage() {
  const entries = await getLeaderboard();

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
        <h1 style={{ color: "#ffd700", marginBottom: "8px" }}>🏆 Leaderboard</h1>
        <p style={{ color: "#888888", marginBottom: "32px", fontSize: "13px" }}>
          Top players ranked by total chips won
        </p>

        <div className="card">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Chips Won</th>
                <th>Tournament Wins</th>
                <th>Games Played</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: "#666666", textAlign: "center", padding: "40px" }}>
                    No entries yet. Be the first to play!
                  </td>
                </tr>
              ) : (
                entries.map((entry, i) => (
                  <tr key={entry.userId}>
                    <td>
                      <span style={{ color: i < 3 ? "#ffd700" : "#666666", fontWeight: i < 3 ? "bold" : "normal" }}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </span>
                    </td>
                    <td style={{ color: "#ffffff" }}>{entry.username}</td>
                    <td>
                      <span className="chip">💰 {entry.totalChipsWon.toLocaleString()}</span>
                    </td>
                    <td style={{ color: "#ffd700" }}>{entry.tournamentWins}</td>
                    <td style={{ color: "#888888" }}>{entry.gamesPlayed}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
