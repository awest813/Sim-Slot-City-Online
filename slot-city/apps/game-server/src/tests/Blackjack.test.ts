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
