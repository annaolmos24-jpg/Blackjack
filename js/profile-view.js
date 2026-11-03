// The Profile tab: a "create your profile" form for new players, and a
// profile card with an Edit button once they have one.

import { fetchProfile, saveProfile, isUsernameAvailable } from "./profiles.js";
import {
  SUIT_SYMBOLS,
  LIMITS,
  cleanProfileInput,
  validateProfile,
  suggestUsername,
} from "./profile-validation.js";

const $ = (sel) => document.querySelector(sel);
const els = {
  view: $("#profile-view"),
  status: $("#profile-status"),
  card: $("#profile-card"),
  cardAvatar: $("#pc-avatar"),
  cardInitial: $("#pc-initial"),
  cardName: $("#pc-name"),
  cardUsername: $("#pc-username"),
  cardBio: $("#pc-bio"),
  cardSuit: $("#pc-suit"),
  cardSince: $("#pc-since"),
  edit: $("#pc-edit"),
  form: $("#profile-form"),
  formTitle: $("#pf-title"),
  formIntro: $("#pf-intro"),
  avatarPreview: $("#pf-avatar"),
  avatarInitial: $("#pf-initial"),
  useGooglePhoto: $("#pf-use-google-photo"),
  username: $("#pf-username"),
  displayName: $("#pf-display-name"),
  bio: $("#pf-bio"),
  bioCount: $("#pf-bio-count"),
  formError: $("#pf-error"),
  cancel: $("#pf-cancel"),
  save: $("#pf-save"),
};

let user = null; // { id, fullName, email, avatarUrl } from auth.profileOf
let profile = null; // row from public.profiles, or null
let onChange = () => {};

/* ---------- small helpers ---------- */

function setAvatar(img, initialEl, url, name) {
  initialEl.textContent = (name || "?").charAt(0).toUpperCase();
  const showInitial = () => {
    img.hidden = true;
    initialEl.hidden = false;
  };
  if (!url) return showInitial();
  img.onerror = showInitial;
  img.hidden = false;
  initialEl.hidden = true;
  img.src = url;
  img.alt = name || "";
}

function setStatus(text, tone = "") {
  els.status.textContent = text;
  els.status.dataset.tone = tone;
  els.status.hidden = !text;
}

function fieldError(name, message) {
  const input = els.form.elements[name];
  const holder = els.form.querySelector(`[data-error-for="${name}"]`);
  if (holder) {
    holder.textContent = message || "";
    holder.hidden = !message;
  }
  if (input && input.setAttribute) {
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }
}

function clearErrors() {
  for (const name of ["username", "display_name", "bio"]) fieldError(name, "");
  els.formError.hidden = true;
}

function formValues() {
  const data = new FormData(els.form);
  return cleanProfileInput({
    username: data.get("username"),
    display_name: data.get("display_name"),
    bio: data.get("bio"),
    favorite_suit: data.get("favorite_suit"),
    avatar_url: els.useGooglePhoto.checked ? user.avatarUrl : null,
  });
}

function updateBioCount() {
  els.bioCount.textContent = `${els.bio.value.length} / ${LIMITS.bioMax}`;
}

function updateAvatarPreview() {
  const url = els.useGooglePhoto.checked ? user.avatarUrl : null;
  setAvatar(els.avatarPreview, els.avatarInitial, url, els.displayName.value || user.fullName);
}

/* ---------- rendering ---------- */

function showCard() {
  els.form.hidden = true;
  els.card.hidden = false;
  setAvatar(els.cardAvatar, els.cardInitial, profile.avatar_url, profile.display_name);
  els.cardName.textContent = profile.display_name;
  els.cardUsername.textContent = `@${profile.username}`;
  els.cardBio.textContent = profile.bio || "No bio yet.";
  els.cardBio.classList.toggle("muted", !profile.bio);
  els.cardSuit.hidden = !profile.favorite_suit;
  if (profile.favorite_suit) {
    const suit = profile.favorite_suit;
    els.cardSuit.textContent = `${SUIT_SYMBOLS[suit]} Favorite suit: ${suit.charAt(0).toUpperCase()}${suit.slice(1)}`;
    els.cardSuit.dataset.suit = profile.favorite_suit;
  }
  const since = new Date(profile.created_at);
  els.cardSince.textContent = `Player since ${since.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
}

function showForm() {
  const creating = !profile;
  els.card.hidden = true;
  els.form.hidden = false;
  clearErrors();
  els.formTitle.textContent = creating ? "Create your profile" : "Edit your profile";
  els.formIntro.hidden = !creating;
  els.cancel.hidden = creating;
  els.save.textContent = creating ? "Create profile" : "Save changes";

  els.username.value = profile?.username ?? suggestUsername(user.fullName, user.email);
  els.displayName.value = profile?.display_name ?? user.fullName;
  els.bio.value = profile?.bio ?? "";
  const suit = profile?.favorite_suit ?? "";
  els.form.querySelectorAll('input[name="favorite_suit"]').forEach((r) => {
    r.checked = r.value === suit;
  });
  els.useGooglePhoto.disabled = !user.avatarUrl;
  els.useGooglePhoto.checked = creating ? Boolean(user.avatarUrl) : Boolean(profile.avatar_url);
  updateBioCount();
  updateAvatarPreview();
}

/* ---------- actions ---------- */

async function submit(e) {
  e.preventDefault();
  clearErrors();
  const values = formValues();
  const errors = validateProfile(values);
  for (const [field, message] of Object.entries(errors)) fieldError(field, message);
  if (Object.keys(errors).length) {
    els.form.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  els.save.disabled = true;
  const label = els.save.textContent;
  els.save.textContent = "Saving…";
  try {
    if (values.username.toLowerCase() !== profile?.username?.toLowerCase()) {
      if (!(await isUsernameAvailable(values.username, user.id))) {
        fieldError("username", "That username is already taken — try another.");
        els.username.focus();
        return;
      }
    }
    const created = !profile;
    profile = await saveProfile(user.id, values);
    showCard();
    setStatus(created ? "Profile created — welcome to the table!" : "Profile saved.", "success");
    onChange(profile, { created });
  } catch (err) {
    console.error(err);
    if (err.field) {
      fieldError(err.field, err.message);
    } else {
      els.formError.textContent = err.message;
      els.formError.hidden = false;
    }
  } finally {
    els.save.disabled = false;
    if (els.save.textContent === "Saving…") els.save.textContent = label;
  }
}

/* ---------- public API ---------- */

export function setupProfileView({ onProfileChange }) {
  onChange = onProfileChange;
  els.form.addEventListener("submit", submit);
  els.edit.addEventListener("click", () => {
    setStatus("");
    showForm();
    els.displayName.focus();
  });
  els.cancel.addEventListener("click", () => {
    setStatus("");
    showCard();
  });
  els.bio.addEventListener("input", updateBioCount);
  els.useGooglePhoto.addEventListener("change", updateAvatarPreview);
  els.displayName.addEventListener("input", updateAvatarPreview);
  els.username.addEventListener("input", () => fieldError("username", ""));
}

/** Load the signed-in player's profile. Returns the row, or null if none yet. */
export async function loadProfileFor(signedInUser) {
  user = signedInUser;
  profile = null;
  els.card.hidden = true;
  els.form.hidden = true;
  setStatus("Loading your profile…");
  try {
    profile = await fetchProfile(user.id);
  } catch (err) {
    console.error(err);
    setStatus(err.message, "error");
    throw err;
  }
  setStatus("");
  if (profile) showCard();
  else showForm();
  return profile;
}

export function clearProfileView() {
  user = null;
  profile = null;
  els.card.hidden = true;
  els.form.hidden = true;
  setStatus("");
}
