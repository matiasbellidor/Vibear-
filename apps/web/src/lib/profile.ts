"use client";

import { useSyncExternalStore } from "react";
import { createStore } from "./storage";

// The visitor's anonymous profile: who they are to Vibear without an account. On the first visit
// the browser makes up an id (a UUID) and keeps it here; the style test's answers and the colour
// analysis go with it. It is backed up to the API (GET/PUT /v1/profile) under the same anonymous
// HttpOnly cookie as the closet, so it survives Safari wiping the site's storage. No login.

export type StyleAnswers = {
  dress: string | null; // who they shop for: mujer, hombre, ambos (lib/style.ts)
  aesthetics: string[];
  lifestyle: string[];
  goals: string[];
  budget: string | null;
};
export type ColorResult = { season: string; undertone: string; contrast: string; chroma: string };
export type Profile = {
  user: string;
  status: "new" | "done" | "skipped";
  style: StyleAnswers | null;
  color: ColorResult | null;
  updated_at: number; // epoch ms: the newest copy wins
};

const PROFILE_URL = "/api/v1/profile";
const EMPTY: Profile = { user: "", status: "new", style: null, color: null, updated_at: 0 };
const store = createStore<Profile>("vibear:profile", EMPTY);

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Older browsers: a v4-shaped id from Math.random is enough for an anonymous label.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** The profile, read from this browser (the server render sees an empty one). */
export function useProfile(): Profile {
  return useSyncExternalStore(store.subscribe, store.read, store.serverSnapshot);
}

export function readProfile(): Profile {
  return store.read();
}

function update(change: Partial<Profile>) {
  const current = store.read();
  store.write({ ...current, ...change, user: current.user || newId(), updated_at: Date.now() });
  pushProfile();
}

export function saveStyle(style: StyleAnswers) {
  update({ style });
}

export function saveColor(color: ColorResult | null) {
  update({ color, status: "done" });
}

export function finishProfile(status: "done" | "skipped") {
  update({ status });
}

export function resetProfile() {
  update({ status: "new", style: null, color: null });
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;

function pushProfile() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    fetch(PROFILE_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(store.read()),
      keepalive: true,
    }).catch(() => {}); // offline or API down: the browser copy still works, the next change retries
  }, 400);
}

let synced = false;

/**
 * Once per page load: make up this visitor's id on the first visit, restore the profile if the
 * browser lost it, or back it up if this copy is newer. The server only hears about a visitor once
 * they answer or skip the test, so a passing bot creates nothing.
 */
export function syncProfile() {
  if (synced) return;
  synced = true;
  const local = store.read();
  if (!local.user) store.write({ ...local, user: newId() });
  fetch(PROFILE_URL)
    .then((response) => (response.ok ? (response.json() as Promise<Profile>) : null))
    .then((remote) => {
      if (!remote) return;
      const mine = store.read();
      if (remote.updated_at > mine.updated_at) store.write({ ...EMPTY, ...remote, user: remote.user || mine.user });
      else if (mine.updated_at > remote.updated_at) pushProfile();
    })
    .catch(() => {});
}
