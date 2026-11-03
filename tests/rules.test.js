import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handTotal,
  isBlackjack,
  canSplitCards,
  dealerShouldHit,
  settleHand,
} from "../js/rules.js";

// Build cards from API-style codes, e.g. "AS", "0H" (ten), "KD".
const VALUES = { A: "ACE", K: "KING", Q: "QUEEN", J: "JACK", 0: "10" };
const c = (code) => ({ code, value: VALUES[code[0]] ?? code[0], suit: "SPADES" });
const hand = (...codes) => codes.map(c);

test("hand totals count aces as 11 or 1", () => {
  assert.deepEqual(handTotal(hand("AS", "6H")), { total: 17, soft: true });
  assert.deepEqual(handTotal(hand("AS", "6H", "KD")), { total: 17, soft: false });
  assert.deepEqual(handTotal(hand("AS", "AD")), { total: 12, soft: true });
  assert.deepEqual(handTotal(hand("AS", "AD", "AC", "AH")), { total: 14, soft: true });
  assert.equal(handTotal(hand("KS", "QH", "2D")).total, 22);
  assert.equal(handTotal(hand("0S", "9H")).total, 19);
});

test("blackjack is only a two-card 21", () => {
  assert.ok(isBlackjack(hand("AS", "KH")));
  assert.ok(isBlackjack(hand("0S", "AH")));
  assert.ok(!isBlackjack(hand("7S", "7H", "7D")));
});

test("split allowed on equal point values", () => {
  assert.ok(canSplitCards(hand("8S", "8H")));
  assert.ok(canSplitCards(hand("KS", "QH")));
  assert.ok(!canSplitCards(hand("9S", "8H")));
});

test("dealer stands on all 17s", () => {
  assert.ok(dealerShouldHit(hand("0S", "6H")));
  assert.ok(!dealerShouldHit(hand("AS", "6H")));
  assert.ok(!dealerShouldHit(hand("0S", "7H")));
});

test("settlement payouts", () => {
  const dealer19 = hand("0S", "9H");
  assert.deepEqual(settleHand({ cards: hand("AS", "KH"), bet: 10 }, dealer19), { outcome: "blackjack", payout: 25 });
  assert.deepEqual(settleHand({ cards: hand("0S", "QH"), bet: 10 }, dealer19), { outcome: "win", payout: 20 });
  assert.deepEqual(settleHand({ cards: hand("0S", "9C"), bet: 10 }, dealer19), { outcome: "push", payout: 10 });
  assert.deepEqual(settleHand({ cards: hand("0S", "8C"), bet: 10 }, dealer19), { outcome: "lose", payout: 0 });
  assert.deepEqual(settleHand({ cards: hand("0S", "8C", "5D"), bet: 10 }, dealer19), { outcome: "bust", payout: 0 });
  // Player bust loses even if the dealer also busts.
  assert.equal(settleHand({ cards: hand("0S", "8C", "5D"), bet: 10 }, hand("0S", "6H", "9D")).outcome, "bust");
  assert.equal(settleHand({ cards: hand("0S", "2C"), bet: 10 }, hand("0S", "6H", "9D")).outcome, "win");
  // Naturals.
  assert.equal(settleHand({ cards: hand("AS", "KH"), bet: 10 }, hand("AD", "QS")).outcome, "push");
  assert.equal(settleHand({ cards: hand("0S", "5C", "6D"), bet: 10 }, hand("AD", "QS")).outcome, "lose");
  // 21 after a split is not a natural.
  assert.deepEqual(settleHand({ cards: hand("AS", "KH"), bet: 10, fromSplit: true }, dealer19), { outcome: "win", payout: 20 });
});
