import {
  createDeck,
  shuffleDeck,
  handValue,
  isBlackjack,
  isBust,
  rankValue,
  createServerGame,
  addPlayer,
  removePlayer,
  placeBet,
  dealHands,
  playerHit,
  playerStand,
  playerDouble,
  resetRound,
  BJServerPhase,
} from "../systems/BlackjackEngine";
import { CardSuit, CardRank, Card } from "@slot-city/shared";

function card(rank: CardRank, suit: CardSuit = CardSuit.SPADES): Card {
  return { rank, suit };
}

// ── Deck ──────────────────────────────────────────────────────────────────────

describe("BlackjackEngine — deck", () => {
  it("createDeck produces 52 unique cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    const keys = new Set(deck.map(c => `${c.rank}${c.suit}`));
    expect(keys.size).toBe(52);
  });

  it("shuffleDeck returns same 52 cards", () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(52);
    expect(shuffled).not.toEqual(deck); // extremely unlikely to be identical
  });

  it("shuffleDeck does not mutate original", () => {
    const deck = createDeck();
    const first = deck[0];
    shuffleDeck(deck);
    expect(deck[0]).toEqual(first);
  });
});

// ── Card values ───────────────────────────────────────────────────────────────

describe("BlackjackEngine — rankValue", () => {
  it("Ace = 11", () => expect(rankValue(CardRank.ACE)).toBe(11));
  it("King = 10", () => expect(rankValue(CardRank.KING)).toBe(10));
  it("Queen = 10", () => expect(rankValue(CardRank.QUEEN)).toBe(10));
  it("Jack = 10", () => expect(rankValue(CardRank.JACK)).toBe(10));
  it("Ten = 10", () => expect(rankValue(CardRank.TEN)).toBe(10));
  it("Nine = 9", () => expect(rankValue(CardRank.NINE)).toBe(9));
  it("Two = 2", () => expect(rankValue(CardRank.TWO)).toBe(2));
});

// ── Hand value ────────────────────────────────────────────────────────────────

describe("BlackjackEngine — handValue", () => {
  it("Ace + King = 21 (soft)", () => {
    expect(handValue([card(CardRank.ACE), card(CardRank.KING)])).toBe(21);
  });

  it("Ace + Ace = 12 (one ace reduced)", () => {
    expect(handValue([card(CardRank.ACE), card(CardRank.ACE)])).toBe(12);
  });

  it("Ace + Nine + Nine = 19 (ace reduced to 1)", () => {
    expect(handValue([card(CardRank.ACE), card(CardRank.NINE), card(CardRank.NINE)])).toBe(19);
  });

  it("Seven + Eight = 15", () => {
    expect(handValue([card(CardRank.SEVEN), card(CardRank.EIGHT)])).toBe(15);
  });

  it("King + Queen + Two = 22 (bust)", () => {
    expect(handValue([card(CardRank.KING), card(CardRank.QUEEN), card(CardRank.TWO)])).toBe(22);
  });

  it("Ace + Five + King = 16 (ace becomes 1)", () => {
    expect(handValue([card(CardRank.ACE), card(CardRank.FIVE), card(CardRank.KING)])).toBe(16);
  });
});

// ── isBlackjack / isBust ──────────────────────────────────────────────────────

describe("BlackjackEngine — isBlackjack / isBust", () => {
  it("Ace + King is blackjack", () => {
    expect(isBlackjack([card(CardRank.ACE), card(CardRank.KING)])).toBe(true);
  });

  it("Three cards totalling 21 is NOT blackjack", () => {
    expect(isBlackjack([card(CardRank.SEVEN), card(CardRank.SEVEN), card(CardRank.SEVEN)])).toBe(false);
  });

  it("King + Queen + Two is bust", () => {
    expect(isBust([card(CardRank.KING), card(CardRank.QUEEN), card(CardRank.TWO)])).toBe(true);
  });

  it("King + Ace is not bust", () => {
    expect(isBust([card(CardRank.KING), card(CardRank.ACE)])).toBe(false);
  });
});

// ── Game state machine ────────────────────────────────────────────────────────

function makeState(overrides = {}) {
  const base = createServerGame();
  return addPlayer(base, {
    playerId:  "p1",
    username:  "Alice",
    chips:     1000,
    seatIndex: 0,
  });
}

describe("BlackjackEngine — state machine", () => {
  it("createServerGame starts in WAITING", () => {
    expect(createServerGame().phase).toBe(BJServerPhase.WAITING);
  });

  it("addPlayer adds a player", () => {
    const state = makeState();
    expect(state.players).toHaveLength(1);
    expect(state.players[0].playerId).toBe("p1");
  });

  it("removePlayer removes the player", () => {
    const state = removePlayer(makeState(), "p1");
    expect(state.players).toHaveLength(0);
  });

  it("placeBet rejects when not in BETTING phase", () => {
    const state = makeState(); // phase = WAITING
    expect(placeBet(state, "p1", 25, 10, 500)).toBeNull();
  });

  it("placeBet accepts valid bet in BETTING phase", () => {
    const state = { ...makeState(), phase: BJServerPhase.BETTING };
    const next  = placeBet(state, "p1", 50, 10, 500);
    expect(next).not.toBeNull();
    expect(next!.players[0].bet).toBe(50);
    expect(next!.players[0].chips).toBe(950);
  });

  it("placeBet rejects bet exceeding chips", () => {
    const state = { ...makeState(), phase: BJServerPhase.BETTING };
    expect(placeBet(state, "p1", 2000, 10, 500)).toBeNull();
  });

  it("placeBet rejects bet below minimum", () => {
    const state = { ...makeState(), phase: BJServerPhase.BETTING };
    expect(placeBet(state, "p1", 5, 10, 500)).toBeNull();
  });

  it("dealHands transitions to PLAYER_TURN and gives 2 cards each", () => {
    let state = { ...makeState(), phase: BJServerPhase.BETTING };
    state = placeBet(state, "p1", 25, 10, 500)!;
    state = dealHands(state);

    expect(state.players[0].hand).toHaveLength(2);
    expect(state.dealerHand).toHaveLength(2);
    // Phase is PLAYER_TURN unless player immediately got blackjack
    expect([BJServerPhase.PLAYER_TURN, BJServerPhase.RESULT]).toContain(state.phase);
  });

  it("playerHit adds a card to player hand", () => {
    let state = { ...makeState(), phase: BJServerPhase.BETTING };
    state = placeBet(state, "p1", 25, 10, 500)!;
    state = dealHands(state);

    // Only test HIT if still in PLAYER_TURN (no blackjack on deal)
    if (state.phase !== BJServerPhase.PLAYER_TURN) return;

    const before = state.players[0].hand.length;
    const next   = playerHit(state, "p1");
    expect(next).not.toBeNull();
    expect(next!.players[0].hand.length).toBe(before + 1);
  });

  it("playerStand marks player as acted", () => {
    let state = { ...makeState(), phase: BJServerPhase.BETTING };
    state = placeBet(state, "p1", 25, 10, 500)!;
    state = dealHands(state);

    if (state.phase !== BJServerPhase.PLAYER_TURN) return;

    const next = playerStand(state, "p1");
    expect(next).not.toBeNull();
    // After only player stands, round should resolve
    expect([BJServerPhase.RESULT, BJServerPhase.DEALER_TURN]).toContain(next!.phase);
  });

  it("resetRound clears hands and returns to BETTING", () => {
    let state = { ...makeState(), phase: BJServerPhase.BETTING };
    state = placeBet(state, "p1", 25, 10, 500)!;
    state = dealHands(state);
    // Force to RESULT
    state = { ...state, phase: BJServerPhase.RESULT };
    state = resetRound(state);

    expect(state.phase).toBe(BJServerPhase.BETTING);
    expect(state.players[0].hand).toHaveLength(0);
    expect(state.players[0].bet).toBe(0);
  });

  it("playerDouble doubles the bet and draws one card", () => {
    // Construct a known non-blackjack hand: 8♠ + 8♥ = 16
    let state = { ...makeState(), phase: BJServerPhase.BETTING };
    state = placeBet(state, "p1", 50, 10, 500)!;
    state = dealHands(state);

    if (state.phase !== BJServerPhase.PLAYER_TURN) return;

    // Override hand to guarantee non-bust double (8+8)
    state = {
      ...state,
      players: state.players.map(p =>
        p.playerId === "p1"
          ? { ...p, hand: [card(CardRank.EIGHT), card(CardRank.EIGHT)], hasActed: false }
          : p,
      ),
    };

    const next = playerDouble(state, "p1");
    expect(next).not.toBeNull();
    // Bet should be doubled
    expect(next!.players[0].bet).toBe(100);
    // Exactly one card was drawn
    expect(next!.players[0].hand.length).toBe(3);
    // Round is resolved immediately after double (dealer plays)
    expect(next!.players[0].result).not.toBeNull();
  });
});

// ── Dealer blackjack edge cases ────────────────────────────────────────────────

describe("BlackjackEngine — dealer blackjack rules", () => {
  /** Build a rigged deck whose first N draws match the supplied cards. */
  function riggedDeck(...topCards: Card[]): Card[] {
    const full = createDeck().filter(
      c => !topCards.some(t => t.rank === c.rank && t.suit === c.suit),
    );
    return [...topCards, ...full];
  }

  it("player BJ + dealer BJ = push (bet returned, no 1.5× bonus)", () => {
    // Deal order with 1 player: p1-card1, dealer-card1, p1-card2, dealer-card2
    // → p1: Ace♠ + King♠ = BJ,  dealer: Ace♥ + King♥ = BJ
    const deck = riggedDeck(
      card(CardRank.ACE,  CardSuit.SPADES),
      card(CardRank.ACE,  CardSuit.HEARTS),
      card(CardRank.KING, CardSuit.SPADES),
      card(CardRank.KING, CardSuit.HEARTS),
    );

    let state = { ...makeState(), phase: BJServerPhase.BETTING, deck };
    state     = placeBet(state, "p1", 100, 10, 500)!;
    state     = dealHands(state);

    const p1 = state.players[0];
    expect(p1.result).toBe("push");
    // Chips: started 1000, bet 100 (chips=900 after placeBet), push returns 100 → chips = 1000
    expect(p1.chips).toBe(1000);
    expect(state.phase).toBe(BJServerPhase.RESULT);
    expect(state.dealerRevealed).toBe(true);
  });

  it("player BJ only (no dealer BJ) = blackjack win with 1.5× bonus", () => {
    // p1: Ace♠ + King♠ = BJ,  dealer: Two♥ + Three♥ = 5 (no BJ)
    const deck = riggedDeck(
      card(CardRank.ACE,   CardSuit.SPADES),
      card(CardRank.TWO,   CardSuit.HEARTS),
      card(CardRank.KING,  CardSuit.SPADES),
      card(CardRank.THREE, CardSuit.HEARTS),
    );

    let state = { ...makeState(), phase: BJServerPhase.BETTING, deck };
    state     = placeBet(state, "p1", 100, 10, 500)!;
    state     = dealHands(state);

    const p1 = state.players[0];
    expect(p1.result).toBe("blackjack");
    // Chips: 900 + (100 + floor(100 * 1.5)) = 900 + 250 = 1150
    expect(p1.chips).toBe(1150);
    expect(state.phase).toBe(BJServerPhase.RESULT);
  });

  it("player BJ + dealer BJ — two players both get push", () => {
    let state = createServerGame();
    state = addPlayer(state, { playerId: "p1", username: "Alice", chips: 1000, seatIndex: 0 });
    state = addPlayer(state, { playerId: "p2", username: "Bob",   chips: 500,  seatIndex: 1 });

    // Deal order with 2 players: p1-c1, p2-c1, d-c1, p1-c2, p2-c2, d-c2
    // p1: A♠+K♠=BJ,  p2: A♥+K♥=BJ,  dealer: A♦+K♦=BJ
    const deck = riggedDeck(
      card(CardRank.ACE,  CardSuit.SPADES),
      card(CardRank.ACE,  CardSuit.HEARTS),
      card(CardRank.ACE,  CardSuit.DIAMONDS),
      card(CardRank.KING, CardSuit.SPADES),
      card(CardRank.KING, CardSuit.HEARTS),
      card(CardRank.KING, CardSuit.DIAMONDS),
    );

    state = { ...state, phase: BJServerPhase.BETTING, deck };
    state = placeBet(state, "p1", 100, 10, 500)!;
    state = placeBet(state, "p2", 50,  10, 500)!;
    state = dealHands(state);

    const p1 = state.players.find(p => p.playerId === "p1")!;
    const p2 = state.players.find(p => p.playerId === "p2")!;
    expect(p1.result).toBe("push");
    expect(p2.result).toBe("push");
    expect(p1.chips).toBe(1000);  // bet returned
    expect(p2.chips).toBe(500);   // bet returned
    expect(state.phase).toBe(BJServerPhase.RESULT);
  });

  it("placeBet rejects duplicate bet from same player", () => {
    let state = { ...makeState(), phase: BJServerPhase.BETTING };
    state = placeBet(state, "p1", 25, 10, 500)!;
    expect(placeBet(state, "p1", 25, 10, 500)).toBeNull();
  });

  it("placeBet rejects bet above maxBet", () => {
    const state = { ...makeState(), phase: BJServerPhase.BETTING };
    expect(placeBet(state, "p1", 501, 10, 500)).toBeNull();
  });

  it("playerHit rejects action when not PLAYER_TURN", () => {
    const state = makeState();  // WAITING phase
    expect(playerHit(state, "p1")).toBeNull();
  });

  it("playerStand rejects action when not PLAYER_TURN", () => {
    const state = makeState();
    expect(playerStand(state, "p1")).toBeNull();
  });

  it("playerDouble rejects when player hand has 3+ cards", () => {
    let state = { ...makeState(), phase: BJServerPhase.BETTING };
    state = placeBet(state, "p1", 50, 10, 500)!;
    state = dealHands(state);

    if (state.phase !== BJServerPhase.PLAYER_TURN) return;

    // Give player a 3-card hand
    state = {
      ...state,
      players: state.players.map(p =>
        p.playerId === "p1"
          ? { ...p, hand: [card(CardRank.FOUR), card(CardRank.FIVE), card(CardRank.SIX)], hasActed: false }
          : p,
      ),
    };
    expect(playerDouble(state, "p1")).toBeNull();
  });

  it("playerDouble rejects when player cannot afford the second bet half", () => {
    let state = createServerGame();
    state = addPlayer(state, { playerId: "p1", username: "Alice", chips: 50, seatIndex: 0 });
    state = { ...state, phase: BJServerPhase.BETTING };
    state = placeBet(state, "p1", 50, 10, 500)!;
    state = dealHands(state);

    if (state.phase !== BJServerPhase.PLAYER_TURN) return;

    // Player has 0 chips left after betting all 50; double requires 50 more
    state = {
      ...state,
      players: state.players.map(p =>
        p.playerId === "p1"
          ? { ...p, hand: [card(CardRank.EIGHT), card(CardRank.EIGHT)], hasActed: false, chips: 0 }
          : p,
      ),
    };
    expect(playerDouble(state, "p1")).toBeNull();
  });

  it("bust player does not trigger dealer play while another player is still active", () => {
    let state = createServerGame();
    state = addPlayer(state, { playerId: "p1", username: "Alice", chips: 500, seatIndex: 0 });
    state = addPlayer(state, { playerId: "p2", username: "Bob",   chips: 500, seatIndex: 1 });

    state = { ...state, phase: BJServerPhase.BETTING };
    state = placeBet(state, "p1", 25, 10, 500)!;
    state = placeBet(state, "p2", 25, 10, 500)!;
    state = dealHands(state);

    if (state.phase !== BJServerPhase.PLAYER_TURN) return;

    // Force p1 hand to a guaranteed bust (10+10+10 = 30 before hit — hit adds one more)
    state = {
      ...state,
      players: state.players.map(p =>
        p.playerId === "p1"
          ? { ...p, hand: [card(CardRank.TEN), card(CardRank.TEN), card(CardRank.TEN)], hasActed: false }
          : p,
      ),
    };

    const after = playerHit(state, "p1");
    expect(after).not.toBeNull();
    const p1 = after!.players.find(p => p.playerId === "p1")!;
    expect(p1.result).toBe("bust");
    // p2 has not acted yet → round must remain in PLAYER_TURN
    expect(after!.phase).toBe(BJServerPhase.PLAYER_TURN);
  });
});
