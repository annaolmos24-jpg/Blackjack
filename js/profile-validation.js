// Profile form rules. These mirror the CHECK constraints in
// supabase/migrations/20261103000000_create_profiles.sql so players get a
// friendly message before the database has to reject anything.

export const SUITS = ["spades", "hearts", "diamonds", "clubs"];
export const SUIT_SYMBOLS = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
export const LIMITS = { usernameMin: 3, usernameMax: 20, displayNameMax: 40, bioMax: 160 };

/** Trim and normalise raw form values. */
export function cleanProfileInput(raw) {
  return {
    username: String(raw.username ?? "").trim(),
    display_name: String(raw.display_name ?? "").trim().replace(/\s+/g, " "),
    bio: String(raw.bio ?? "").trim(),
    favorite_suit: SUITS.includes(raw.favorite_suit) ? raw.favorite_suit : null,
    avatar_url: raw.avatar_url && /^https:\/\//.test(raw.avatar_url) ? raw.avatar_url : null,
  };
}

/** Returns { field: message } for every problem; empty object means valid. */
export function validateProfile(p) {
  const errors = {};
  if (!p.username) {
    errors.username = "Pick a username.";
  } else if (p.username.length < LIMITS.usernameMin || p.username.length > LIMITS.usernameMax) {
    errors.username = `Usernames are ${LIMITS.usernameMin}–${LIMITS.usernameMax} characters.`;
  } else if (!/^[A-Za-z0-9_]+$/.test(p.username)) {
    errors.username = "Use only letters, numbers and underscores.";
  }
  if (!p.display_name) {
    errors.display_name = "Enter the name other players will see.";
  } else if (p.display_name.length > LIMITS.displayNameMax) {
    errors.display_name = `Keep it under ${LIMITS.displayNameMax + 1} characters.`;
  }
  if (p.bio.length > LIMITS.bioMax) {
    errors.bio = `Bios are limited to ${LIMITS.bioMax} characters.`;
  }
  return errors;
}

/** Suggest a username from a Google name or email, e.g. "Anna Olmos" → "anna_olmos". */
export function suggestUsername(fullName, email = "") {
  const base = (fullName || email.split("@")[0] || "player")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, LIMITS.usernameMax);
  return base.length >= LIMITS.usernameMin ? base : `${base || "player"}_${Math.floor(Math.random() * 900 + 100)}`;
}
