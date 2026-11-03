// Thin wrapper around https://deckofcardsapi.com
//
// The game uses a single 6-deck "shoe". Its deck_id is saved in localStorage
// so a page refresh keeps playing from the same shoe. The API throws away a
// deck after two weeks of inactivity, so if a saved id stops working we just
// open a new shoe.

const API = "https://deckofcardsapi.com/api/deck";
const STORAGE_KEY = "blackjack.deckId";

export const DECK_COUNT = 6;
export const SHOE_SIZE = DECK_COUNT * 52;
export const CARD_BACK = "https://deckofcardsapi.com/static/img/back.png";

async function request(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Couldn't reach the card server. Check your connection and try again.");
  }
  if (!res.ok) throw new Error(`Card server error (${res.status}).`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "The card server rejected the request.");
  return data;
}

function saveDeckId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage unavailable — fine, we'll just open a new shoe next time */
  }
}

function loadDeckId() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export class Shoe {
  constructor() {
    this.deckId = null;
    this.remaining = 0;
  }

  /** Reuse the saved shoe if it still exists, otherwise open a fresh one. */
  async open() {
    const saved = loadDeckId();
    if (saved) {
      try {
        // Reshuffle on load so every session starts from a full shoe.
        const data = await request(`${API}/${saved}/shuffle/`);
        this.deckId = data.deck_id;
        this.remaining = data.remaining;
        return;
      } catch {
        /* expired or invalid — fall through and open a new one */
      }
    }
    const data = await request(`${API}/new/shuffle/?deck_count=${DECK_COUNT}`);
    this.deckId = data.deck_id;
    this.remaining = data.remaining;
    saveDeckId(this.deckId);
  }

  /** Put every card back and shuffle the whole shoe. */
  async reshuffle() {
    const data = await request(`${API}/${this.deckId}/shuffle/`);
    this.remaining = data.remaining;
  }

  async draw(count = 1) {
    const data = await request(`${API}/${this.deckId}/draw/?count=${count}`);
    this.remaining = data.remaining;
    if (data.cards.length < count) throw new Error("The shoe ran out of cards.");
    return data.cards;
  }
}
