import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanProfileInput, validateProfile, suggestUsername } from "../js/profile-validation.js";

const valid = { username: "anna_21", display_name: "Anna", bio: "", favorite_suit: "hearts", avatar_url: "https://x/y.png" };

test("accepts a normal profile", () => {
  assert.deepEqual(validateProfile(cleanProfileInput(valid)), {});
});

test("rejects bad usernames", () => {
  for (const username of ["", "ab", "a".repeat(21), "anna olmos", "anna-o", "añna"]) {
    assert.ok(validateProfile(cleanProfileInput({ ...valid, username })).username, username);
  }
});

test("display name and bio limits", () => {
  assert.ok(validateProfile(cleanProfileInput({ ...valid, display_name: "   " })).display_name);
  assert.ok(validateProfile(cleanProfileInput({ ...valid, display_name: "x".repeat(41) })).display_name);
  assert.ok(validateProfile(cleanProfileInput({ ...valid, bio: "x".repeat(161) })).bio);
  assert.equal(validateProfile(cleanProfileInput({ ...valid, bio: "x".repeat(160) })).bio, undefined);
});

test("cleaning drops unknown suits and non-https avatars", () => {
  const p = cleanProfileInput({ ...valid, favorite_suit: "stars", avatar_url: "http://insecure/x.png" });
  assert.equal(p.favorite_suit, null);
  assert.equal(p.avatar_url, null);
  assert.equal(cleanProfileInput({ ...valid, display_name: "  Anna   Olmos " }).display_name, "Anna Olmos");
});

test("username suggestions fit the rules", () => {
  assert.equal(suggestUsername("Anna Olmos"), "anna_olmos");
  assert.equal(suggestUsername("José Núñez"), "jose_nunez");
  assert.equal(suggestUsername("", "card.shark@example.com"), "card_shark");
  assert.match(suggestUsername("Al"), /^al_\d{3}$/);
  for (const name of ["Anna Olmos", "A very very long name indeed here", "李"]) {
    assert.deepEqual(validateProfile(cleanProfileInput({ ...valid, username: suggestUsername(name) })), {}, name);
  }
});
