import { Shoe, SHOE_SIZE, CARD_BACK } from "./api.js";
import {
  handTotal,
  isBust,
  isBlackjack,
  canSplitCards,
  dealerShouldHit,
  settleHand,
  MAX_HANDS,
} from "./rules.js";

const STARTING_BANKROLL = 1000;
const BANKROLL_KEY = "blackjack.bankroll";
const RESHUFFLE_AT = Math.floor(SHOE_SIZE * 0.25); // cut card at 75% penetration
const DEALER_DELAY_MS = 650;

const $ = (sel) => document.querySelector(sel);
const els = {
  bankroll: $("#bankroll"),
  shoe: $("#shoe-remaining"),
  dealerCards: $("#dealer-cards"),
  dealerTotal: $("#dealer-total"),
  hands: $("#player-hands"),
  message: $("#message"),
  betting: $("#betting-controls"),
  playing: $("#play-controls"),
  bet: $("#current-bet"),
  chips: document.querySelectorAll("[data-chip]"),
  clearBet: $("#clear-bet"),
  deal: $("#deal"),
  hit: $("#hit"),
  stand: $("#stand"),
  double: $("#double"),
  split: $("#split"),
  reset: $("#reset-bankroll"),
};

const shoe = new Shoe();

const state = {
  phase: "loading", // loading | betting | player | dealer | busy
  bankroll: loadBankroll(),
  bet: 0,
  lastBet: 0,
  dealer: [],
  holeHidden: true,
  hands: [], // { cards, bet, done, fromSplit, doubled, result }
  active: 0,
};

/* ---------- persistence ---------- */

function loadBankroll() {
  try {
    const saved = Number(localStorage.getItem(BANKROLL_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : STARTING_BANKROLL;
  } catch {
    return STARTING_BANKROLL;
  }
}

function saveBankroll() {
  try {
    localStorage.setItem(BANKROLL_KEY, String(state.bankroll));
  } catch {
    /* ignore */
  }
}

/* ---------- helpers ---------- */

const money = (n) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function setMessage(text, tone = "") {
  els.message.textContent = text;
  els.message.dataset.tone = tone;
}

function activeHand() {
  return state.hands[state.active];
}

/** Run an async action with buttons locked; surface any API error. */
async function guarded(fn) {
  const prev = state.phase;
  state.phase = "busy";
  render();
  try {
    await fn();
  } catch (err) {
    console.error(err);
    setMessage(err.message, "error");
    if (state.phase === "busy") state.phase = prev;
  }
  render();
}

/* ---------- rendering ---------- */

function cardImg(card, { hidden = false, index = 0 } = {}) {
  const img = document.createElement("img");
  img.className = "card";
  img.style.setProperty("--i", index);
  if (hidden) {
    img.src = CARD_BACK;
    img.alt = "Face-down card";
  } else {
    img.src = card.image;
    img.alt = `${card.value.toLowerCase()} of ${card.suit.toLowerCase()}`;
  }
  img.draggable = false;
  // Only animate a card the first time it appears face up (or face down),
  // so re-renders don't replay the deal animation for the whole table.
  const seenKey = hidden ? "_seenBack" : "_seen";
  if (card[seenKey]) img.classList.add("settled");
  card[seenKey] = true;
  return img;
}

function totalLabel(cards) {
  if (!cards.length) return "";
  if (isBlackjack(cards)) return "Blackjack";
  const { total, soft } = handTotal(cards);
  if (total > 21) return `${total} · Bust`;
  return soft && total < 21 ? `${total - 10} / ${total}` : String(total);
}

const OUTCOME_TEXT = {
  blackjack: "Blackjack!",
  win: "Win",
  push: "Push",
  lose: "Lose",
  bust: "Bust",
};

function renderDealer() {
  els.dealerCards.replaceChildren(
    ...state.dealer.map((c, i) => cardImg(c, { hidden: i === 1 && state.holeHidden, index: i })),
  );
  if (!state.dealer.length) {
    els.dealerTotal.textContent = "";
  } else if (state.holeHidden) {
    els.dealerTotal.textContent = totalLabel([state.dealer[0]]);
  } else {
    els.dealerTotal.textContent = totalLabel(state.dealer);
  }
}

function renderHands() {
  const nodes = state.hands.map((hand, i) => {
    const wrap = document.createElement("div");
    wrap.className = "hand";
    const isActive = state.phase === "player" && i === state.active && state.hands.length > 1;
    wrap.classList.toggle("active", isActive);
    if (hand.result) wrap.dataset.result = hand.result.outcome;

    const cards = document.createElement("div");
    cards.className = "cards";
    cards.append(...hand.cards.map((c, j) => cardImg(c, { index: j })));

    const meta = document.createElement("div");
    meta.className = "hand-meta";
    const total = document.createElement("span");
    total.className = "badge";
    total.textContent = totalLabel(hand.cards);
    const bet = document.createElement("span");
    bet.className = "hand-bet";
    bet.textContent = `Bet ${money(hand.bet)}${hand.doubled ? " (doubled)" : ""}`;
    meta.append(total, bet);

    if (hand.result) {
      const res = document.createElement("span");
      res.className = "result";
      res.textContent = OUTCOME_TEXT[hand.result.outcome];
      meta.append(res);
    }

    wrap.append(cards, meta);
    return wrap;
  });
  els.hands.replaceChildren(...nodes);
}

function renderControls() {
  const { phase } = state;
  const betting = phase === "betting";
  const playing = phase === "player";

  const inRound = state.hands.length > 0 && !state.hands.every((h) => h.result);
  els.betting.hidden = inRound;
  els.playing.hidden = !inRound;

  els.bet.textContent = money(state.bet);
  els.chips.forEach((chip) => {
    chip.disabled = !betting || Number(chip.dataset.chip) > state.bankroll;
  });
  els.clearBet.disabled = !betting || state.bet === 0;
  els.deal.disabled = !betting || state.bet === 0;

  const hand = activeHand();
  const twoCards = playing && hand && hand.cards.length === 2;
  const affordable = hand && state.bankroll >= hand.bet;
  els.hit.disabled = !playing;
  els.stand.disabled = !playing;
  els.double.disabled = !(twoCards && affordable);
  els.split.disabled = !(
    twoCards &&
    affordable &&
    canSplitCards(hand.cards) &&
    state.hands.length < MAX_HANDS
  );

  const broke = betting && state.bankroll === 0 && state.bet === 0;
  els.reset.hidden = !broke;
}

function render() {
  els.bankroll.textContent = money(state.bankroll);
  els.shoe.textContent = shoe.deckId ? `${shoe.remaining} / ${SHOE_SIZE}` : "—";
  renderDealer();
  renderHands();
  renderControls();
}

/* ---------- betting ---------- */

function addChip(amount) {
  if (state.phase !== "betting" || amount > state.bankroll) return;
  // A new bet clears the previous round's cards off the table.
  if (state.hands.some((h) => h.result)) clearTable();
  state.bankroll -= amount;
  state.bet += amount;
  setMessage("Place your bet, then deal.");
  render();
}

function clearBet() {
  if (state.phase !== "betting") return;
  state.bankroll += state.bet;
  state.bet = 0;
  render();
}

function clearTable() {
  state.dealer = [];
  state.hands = [];
  state.holeHidden = true;
}

function resetBankroll() {
  state.bankroll = STARTING_BANKROLL;
  saveBankroll();
  setMessage("Bankroll reset. Good luck!");
  render();
}

/* ---------- round flow ---------- */

async function deal() {
  if (state.phase !== "betting" || state.bet === 0) return;
  await guarded(async () => {
    if (shoe.remaining < RESHUFFLE_AT) {
      setMessage("Shuffling the shoe…");
      render();
      await shoe.reshuffle();
    }

    clearTable();
    // Deal order: player, dealer, player, dealer (hole card).
    const [p1, d1, p2, d2] = await shoe.draw(4);
    state.lastBet = state.bet;
    state.hands = [{ cards: [p1, p2], bet: state.bet, done: false, fromSplit: false }];
    state.dealer = [d1, d2];
    state.active = 0;
    state.bet = 0;
    saveBankroll();

    const playerBJ = isBlackjack(state.hands[0].cards);
    const dealerBJ = isBlackjack(state.dealer);
    if (playerBJ || dealerBJ) {
      // Dealer peeks for blackjack; either natural ends the round immediately.
      state.hands[0].done = true;
      finishRound();
      return;
    }
    state.phase = "player";
    setMessage("Hit, stand, double or split?");
  });
}

async function hit() {
  if (state.phase !== "player") return;
  await guarded(async () => {
    const hand = activeHand();
    const [card] = await shoe.draw(1);
    hand.cards.push(card);
    if (isBust(hand.cards) || handTotal(hand.cards).total === 21) {
      hand.done = true;
      await advance();
    } else {
      state.phase = "player";
    }
  });
}

async function stand() {
  if (state.phase !== "player") return;
  await guarded(async () => {
    activeHand().done = true;
    await advance();
  });
}

async function doubleDown() {
  const hand = activeHand();
  if (state.phase !== "player" || hand.cards.length !== 2 || state.bankroll < hand.bet) return;
  await guarded(async () => {
    const [card] = await shoe.draw(1);
    state.bankroll -= hand.bet;
    hand.bet *= 2;
    hand.doubled = true;
    hand.cards.push(card);
    hand.done = true;
    saveBankroll();
    await advance();
  });
}

async function split() {
  const hand = activeHand();
  if (
    state.phase !== "player" ||
    !canSplitCards(hand.cards) ||
    state.bankroll < hand.bet ||
    state.hands.length >= MAX_HANDS
  ) {
    return;
  }
  await guarded(async () => {
    const [c1, c2] = await shoe.draw(2);
    const splittingAces = hand.cards[0].value === "ACE";
    const second = { cards: [hand.cards[1], c2], bet: hand.bet, done: false, fromSplit: true };
    hand.cards = [hand.cards[0], c1];
    hand.fromSplit = true;
    state.bankroll -= hand.bet;
    state.hands.splice(state.active + 1, 0, second);
    saveBankroll();

    if (splittingAces) {
      // Split aces get exactly one card each.
      hand.done = true;
      second.done = true;
      await advance();
      return;
    }
    if (handTotal(hand.cards).total === 21) {
      hand.done = true;
      await advance();
      return;
    }
    state.phase = "player";
  });
}

/** Move to the next unfinished hand, or hand over to the dealer. */
async function advance() {
  const next = state.hands.findIndex((h) => !h.done);
  if (next !== -1) {
    state.active = next;
    const hand = activeHand();
    // A split hand may already be on 21.
    if (handTotal(hand.cards).total === 21) {
      hand.done = true;
      return advance();
    }
    state.phase = "player";
    setMessage(state.hands.length > 1 ? `Playing hand ${next + 1} of ${state.hands.length}.` : "");
    return;
  }
  await dealerTurn();
}

async function dealerTurn() {
  state.phase = "dealer";
  state.holeHidden = false;
  render();

  const anyLive = state.hands.some((h) => !isBust(h.cards));
  if (anyLive) {
    while (dealerShouldHit(state.dealer)) {
      await sleep(DEALER_DELAY_MS);
      const [card] = await shoe.draw(1);
      state.dealer.push(card);
      render();
    }
  }
  finishRound();
}

function finishRound() {
  state.holeHidden = false;
  let returned = 0;
  let staked = 0;
  for (const hand of state.hands) {
    hand.result = settleHand(hand, state.dealer);
    returned += hand.result.payout;
    staked += hand.bet;
  }
  state.bankroll += returned;
  saveBankroll();

  const net = returned - staked;
  const single = state.hands.length === 1 ? state.hands[0].result.outcome : null;
  let text;
  if (single === "blackjack") text = `Blackjack! You win ${money(net)}.`;
  else if (isBlackjack(state.dealer) && single === "lose") text = `Dealer has blackjack. You lose ${money(staked)}.`;
  else if (net > 0) text = `You win ${money(net)}!`;
  else if (net < 0) text = `You lose ${money(-net)}.`;
  else text = "Push — your bet is returned.";
  setMessage(text, net > 0 ? "win" : net < 0 ? "lose" : "push");

  state.phase = "betting";
  // Offer the same bet again if it's affordable.
  if (state.lastBet && state.lastBet <= state.bankroll) {
    state.bankroll -= state.lastBet;
    state.bet = state.lastBet;
  }
  if (state.bankroll + state.bet === 0) setMessage("You're out of chips.", "lose");
}

/* ---------- wiring ---------- */

els.chips.forEach((chip) => chip.addEventListener("click", () => addChip(Number(chip.dataset.chip))));
els.clearBet.addEventListener("click", clearBet);
els.deal.addEventListener("click", deal);
els.hit.addEventListener("click", hit);
els.stand.addEventListener("click", stand);
els.double.addEventListener("click", doubleDown);
els.split.addEventListener("click", split);
els.reset.addEventListener("click", resetBankroll);

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  const key = e.key.toLowerCase();
  const actions = { h: hit, s: stand, d: doubleDown, p: split };
  if (state.phase === "player" && actions[key]) {
    e.preventDefault();
    actions[key]();
  } else if (state.phase === "betting" && (key === "enter" || key === " ") && state.bet > 0) {
    if (document.activeElement?.tagName === "BUTTON" && key === " ") return; // let buttons handle space
    e.preventDefault();
    deal();
  }
});

async function init() {
  render();
  setMessage("Opening a fresh 6-deck shoe…");
  try {
    await shoe.open();
    state.phase = "betting";
    setMessage("Place your bet, then deal.");
  } catch (err) {
    console.error(err);
    setMessage(`${err.message} Reload the page to retry.`, "error");
  }
  render();
}

init();
