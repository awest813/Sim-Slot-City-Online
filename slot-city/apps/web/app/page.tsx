import Link from "next/link";

export default function Home() {
  const gameClientUrl = process.env.NEXT_PUBLIC_GAME_CLIENT_URL || "http://localhost:3001";

  return (
    <main>
      <nav>
        <div className="nav-inner">
          <span className="logo">🎰 Slot City</span>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/tournaments">Tournaments</Link>
          <Link href="/profile">Profile</Link>
          <a href={gameClientUrl} className="btn btn-gold">Play Now</a>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: "60px", textAlign: "center" }}>
        <h1 style={{ fontSize: "56px", color: "#ffd700", marginBottom: "16px" }}>
          🎰 SLOT CITY
        </h1>
        <p style={{ fontSize: "20px", color: "#888888", marginBottom: "8px" }}>
          The Social Isometric Casino
        </p>
        <p style={{ fontSize: "13px", color: "#444466", marginBottom: "48px" }}>
          Virtual chips only • No real money • 18+ entertainment
        </p>

        <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginBottom: "60px" }}>
          <a href={gameClientUrl} className="btn btn-gold" style={{ fontSize: "18px", padding: "16px 40px" }}>
            🎮 Play Now
          </a>
          <Link href="/tournaments" className="btn" style={{ fontSize: "18px", padding: "16px 40px" }}>
            🏆 Tournaments
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", marginBottom: "60px" }}>
          <FeatureCard
            icon="🏙️"
            title="Isometric Casino World"
            description="Walk around a fully realized 2.5D casino with other players in real time."
          />
          <FeatureCard
            icon="🃏"
            title="Real Poker"
            description="Server-authoritative Texas Hold'em with full betting rounds and hand resolution."
          />
          <FeatureCard
            icon="🏆"
            title="Tournaments"
            description="Join sit-and-go tournaments with escalating blinds and a live prize pool."
          />
          <FeatureCard
            icon="🍸"
            title="Social Lounge"
            description="Hang out at the Lucky Lounge, chat, emote, and watch tournament updates."
          />
          <FeatureCard
            icon="💰"
            title="Chip Economy"
            description="Earn chips, track your balance, and climb the leaderboard."
          />
          <FeatureCard
            icon="🎨"
            title="Avatar Cosmetics"
            description="Customize your avatar with outfits and accessories. More coming soon."
          />
        </div>

        <div className="card" style={{ maxWidth: "600px", margin: "0 auto 60px" }}>
          <h3 style={{ color: "#ffd700", marginBottom: "12px" }}>How It Works</h3>
          <ol style={{ color: "#aaaaaa", lineHeight: "2", paddingLeft: "20px", textAlign: "left" }}>
            <li>Create a free account — starts you with <strong style={{ color: "#ffd700" }}>5,000 chips</strong></li>
            <li>Enter the isometric casino lobby</li>
            <li>Walk around, chat, and meet other players</li>
            <li>Join a poker table or tournament</li>
            <li>Win chips and rise up the leaderboard</li>
          </ol>
        </div>

        <footer style={{ color: "#333355", fontSize: "12px", paddingBottom: "40px" }}>
          Slot City is for entertainment only. No real money. No real gambling.
        </footer>
      </div>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="card" style={{ textAlign: "left" }}>
      <div style={{ fontSize: "32px", marginBottom: "12px" }}>{icon}</div>
      <h3 style={{ color: "#ffffff", marginBottom: "8px", fontSize: "15px" }}>{title}</h3>
      <p style={{ color: "#888888", fontSize: "13px", lineHeight: "1.5" }}>{description}</p>
    </div>
  );
}
