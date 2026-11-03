// Pure Blackjack rules — no DOM, no network. Easy to unit test.
//
// Cards follow the Deck of Cards API shape:
//   { code: "KH", value: "KING", suit: "HEARTS", image: "https://..." }
// where value is one of: ACE, 2-10, JACK, QUEEN, KING.

export const BLACKJACK_PAYOUT = 1.5; // 3:2
export const DEALER_HITS_SOFT_17 = false; // dealer stands on all 17s
export const MAX_HANDS = 4; // split up to 3 times

/** Point value of a single card, counting an Ace as 11. */
export function cardValue(card) {
  switch (card.value) {
    case "ACE":
      return 11;
    case "KING":
    case "QUEEN":
    case "JACK":
      return 10;
    default:
      return Number(card.value);
  }
}

/**
 * Best total for a hand. Aces count as 11 unless that would bust,
 * in which case they drop to 1 one at a time.
 * `soft` is true when an Ace is still being counted as 11.
 */
export function handTotal(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += cardValue(card);
    if (card.value === "ACE") aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

export function isBust(cards) {
  return handTotal(cards).total > 21;
}

/** A natural: exactly two cards totalling 21. */
export function isBlackjack(cards) {
  return cards.length === 2 && handTotal(cards).total === 21;
}

/** Two cards of equal point value (so K + Q may be split). */
export function canSplitCards(cards) {
  return cards.length === 2 && cardValue(cards[0]) === cardValue(cards[1]);
}

export function dealerShouldHit(cards) {
  const { total, soft } = handTotal(cards);
  if (total < 17) return true;
  if (total === 17 && soft && DEALER_HITS_SOFT_17) return true;
  return false;
}

/**
 * Settle one player hand against the dealer's final hand.
 * `hand` = { cards, bet, fromSplit }. The bet has already been taken from
 * the bankroll, so `payout` is the total amount returned to the player
 * (0 on a loss, bet on a push, 2x on a win, 2.5x on a natural).
 */
export function settleHand(hand, dealerCards) {
  const player = handTotal(hand.cards).total;
  const dealer = handTotal(dealerCards).total;
  const playerBJ = isBlackjack(hand.cards) && !hand.fromSplit;
  const dealerBJ = isBlackjack(dealerCards);

  if (player > 21) return { outcome: "bust", payout: 0 };
  if (playerBJ && dealerBJ) return { outcome: "push", payout: hand.bet };
  if (playerBJ) return { outcome: "blackjack", payout: hand.bet * (1 + BLACKJACK_PAYOUT) };
  if (dealerBJ) return { outcome: "lose", payout: 0 };
  if (dealer > 21) return { outcome: "win", payout: hand.bet * 2 };
  if (player > dealer) return { outcome: "win", payout: hand.bet * 2 };
  if (player === dealer) return { outcome: "push", payout: hand.bet };
  return { outcome: "lose", payout: 0 };
}
