"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL || "http://localhost:2567";

interface UserProfile {
  id: string;
  username: string;
  chips: number;
  outfitId: string;
  createdAt: string;
}

interface LeaderboardEntry {
  totalChipsWon: number;
  tournamentWins: number;
  gamesPlayed: number;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("slot_city_token");
    if (!token) {
      setError("Not logged in. Launch the game to sign in.");
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setError("Session expired. Please log in again from the game.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setUser(data.user);

        // Fetch stats
        const statsRes = await fetch(`${API_URL}/profile/${data.user.id}/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch {
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <PageShell>
        <div style={{ textAlign: "center", padding: "80px", color: "#888888" }}>
          Loading profile...
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <div className="card" style={{ textAlign: "center", padding: "60px" }}>
          <div style={{ fontSize: "32px", marginBottom: "16px" }}>🔑</div>
          <p style={{ color: "#ff4444" }}>{error}</p>
          <a href={process.env.NEXT_PUBLIC_GAME_CLIENT_URL || "http://localhost:3001"}
             className="btn btn-gold" style={{ marginTop: "20px" }}>
            Open Game
          </a>
        </div>
      </PageShell>
    );
  }

  if (!user) return null;

  return (
    <PageShell>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "24px" }}>
        {/* Avatar card */}
        <div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{
              width: "80px",
              height: "100px",
              background: "#1a2a6e",
              border: "2px solid #4488ff",
              borderRadius: "8px",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "40px",
            }}>
              🧑
            </div>
            <h2 style={{ color: "#ffffff", marginBottom: "6px" }}>{user.username}</h2>
            <p style={{ color: "#888888", fontSize: "12px", marginBottom: "16px" }}>
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </p>
            <div className="chip" style={{ display: "block", textAlign: "center", marginBottom: "16px" }}>
              💰 {user.chips.toLocaleString()} chips
            </div>
            <a href={process.env.NEXT_PUBLIC_GAME_CLIENT_URL || "http://localhost:3001"}
               className="btn btn-gold" style={{ width: "100%", textAlign: "center" }}>
              🎮 Play Now
            </a>
          </div>

          <div className="card">
            <h4 style={{ color: "#888888", marginBottom: "12px", fontSize: "11px", textTransform: "uppercase" }}>
              Avatar Style
            </h4>
            <p style={{ color: "#ffffff", marginBottom: "4px" }}>Outfit: {user.outfitId}</p>
            <p style={{ color: "#555555", fontSize: "12px" }}>More cosmetics coming soon</p>
          </div>
        </div>

        {/* Stats */}
        <div>
          <div className="card">
            <h3 style={{ color: "#ffd700", marginBottom: "20px" }}>📊 Statistics</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
              <StatBox label="Chips Won" value={(stats?.totalChipsWon ?? 0).toLocaleString()} color="#ffd700" />
              <StatBox label="Tournament Wins" value={String(stats?.tournamentWins ?? 0)} color="#44ff88" />
              <StatBox label="Games Played" value={String(stats?.gamesPlayed ?? 0)} color="#4488ff" />
            </div>
          </div>

          <div className="card">
            <h3 style={{ color: "#ffffff", marginBottom: "16px" }}>🏆 Achievements</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
              <Achievement
                icon="🎰"
                name="First Steps"
                description="Created your account"
                unlocked={true}
              />
              <Achievement
                icon="🃏"
                name="Poker Face"
                description="Win your first poker hand"
                unlocked={(stats?.gamesPlayed ?? 0) > 0}
              />
              <Achievement
                icon="🏆"
                name="Champion"
                description="Win a tournament"
                unlocked={(stats?.tournamentWins ?? 0) > 0}
              />
              <Achievement
                icon="💰"
                name="High Roller"
                description="Win 10,000 chips"
                unlocked={(stats?.totalChipsWon ?? 0) >= 10000}
              />
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
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
        <h1 style={{ color: "#ffd700", marginBottom: "32px" }}>👤 Profile</h1>
        {children}
      </div>
    </main>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: "#0a0a2a",
      border: "1px solid #1a1a4e",
      borderRadius: "6px",
      padding: "16px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: "24px", color, fontWeight: "bold", marginBottom: "4px" }}>{value}</div>
      <div style={{ color: "#888888", fontSize: "11px" }}>{label}</div>
    </div>
  );
}

function Achievement({ icon, name, description, unlocked }: {
  icon: string; name: string; description: string; unlocked: boolean;
}) {
  return (
    <div style={{
      background: "#0a0a2a",
      border: `1px solid ${unlocked ? "#334488" : "#1a1a1a"}`,
      borderRadius: "6px",
      padding: "12px",
      opacity: unlocked ? 1 : 0.4,
    }}>
      <div style={{ fontSize: "20px", marginBottom: "4px" }}>{icon}</div>
      <div style={{ color: "#ffffff", fontSize: "12px", marginBottom: "2px" }}>{name}</div>
      <div style={{ color: "#666666", fontSize: "10px" }}>{description}</div>
    </div>
  );
}
