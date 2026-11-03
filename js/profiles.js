// Reading and saving the signed-in player's row in public.profiles.
// Row Level Security (see supabase/migrations) makes sure a player can only
// write their own profile.

import { supabase } from "./auth.js";

const COLUMNS = "id, username, display_name, bio, favorite_suit, avatar_url, created_at, updated_at";

/** Turn Supabase/Postgres errors into messages a player can act on. */
function friendlyError(error) {
  const msg = `${error.message ?? ""} ${error.details ?? ""}`;
  if (error.code === "23505" || /profiles_username_lower_key|duplicate key/i.test(msg)) {
    return Object.assign(new Error("That username is already taken — try another."), { field: "username" });
  }
  if (error.code === "42P01" || error.code === "PGRST205" || /could not find the table/i.test(msg)) {
    return new Error("Profiles aren't set up in the database yet. Run the SQL in supabase/migrations first.");
  }
  if (error.code === "23514") {
    return new Error("Some profile details aren't allowed — check the fields and try again.");
  }
  if (error.code === "42501") {
    return new Error("You don't have permission to change this profile. Try signing out and back in.");
  }
  return new Error(error.message || "Something went wrong talking to the database.");
}

/** The player's profile, or null if they haven't created one yet. */
export async function fetchProfile(userId) {
  const { data, error } = await supabase.from("profiles").select(COLUMNS).eq("id", userId).maybeSingle();
  if (error) throw friendlyError(error);
  return data;
}

/** Create or update the player's profile and return the saved row. */
export async function saveProfile(userId, fields) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...fields }, { onConflict: "id" })
    .select(COLUMNS)
    .single();
  if (error) throw friendlyError(error);
  return data;
}

/** True if no other player has this username (case-insensitive). */
export async function isUsernameAvailable(username, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username.replace(/[\\%_]/g, (c) => `\\${c}`))
    .neq("id", userId)
    .limit(1);
  if (error) throw friendlyError(error);
  return data.length === 0;
}
