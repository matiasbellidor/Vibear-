"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Look, Match, Place } from "./api";

// Per-browser state (saved products, recent looks). localStorage can be missing or throw
// (private windows, blocked storage), so every access is guarded and an in-memory copy backs it.

const CHANGE_EVENT = "vibear:storage";

function createStore<T>(key: string, fallback: T) {
  let cachedRaw: string | null | undefined;
  let value = fallback;

  const read = (): T => {
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return value;
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      try {
        value = raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        value = fallback;
      }
    }
    return value;
  };

  const write = (next: T) => {
    value = next;
    try {
      const raw = JSON.stringify(next);
      window.localStorage.setItem(key, raw);
      cachedRaw = raw;
    } catch {
      // Keep the in-memory value; it lasts for this tab.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const subscribe = (onChange: () => void) => {
    window.addEventListener("storage", onChange);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  };

  return { read, write, subscribe, serverSnapshot: () => fallback };
}

export type SavedItem = Match & { savedAt: number };
export type RecentLook = { image_id: string; width: number; height: number; count: number; at: number };

const EMPTY_SAVED: SavedItem[] = [];
const EMPTY_RECENT: RecentLook[] = [];
const savedStore = createStore("vibear:saved", EMPTY_SAVED);
const recentStore = createStore("vibear:recent", EMPTY_RECENT);
const MAX_RECENT = 12;

export function useSaved() {
  const items = useSyncExternalStore(savedStore.subscribe, savedStore.read, savedStore.serverSnapshot);

  const isSaved = useCallback((link: string) => items.some((item) => item.link === link), [items]);

  const toggle = useCallback((match: Match) => {
    const current = savedStore.read();
    const exists = current.some((item) => item.link === match.link);
    savedStore.write(
      exists ? current.filter((item) => item.link !== match.link) : [{ ...match, savedAt: Date.now() }, ...current],
    );
    savedAtStore.write(Date.now());
    pushCloset();
  }, []);

  return { items, isSaved, toggle };
}

// ─── Closet backup (GET/PUT /v1/closet in the API) ──────────────────────────────────────────────
// The saved products are copied to the API under an anonymous id that lives in an HttpOnly cookie
// set by the server. Safari wipes a site's storage after 7 days without a visit, but not that
// cookie, so the next visit restores the closet. No account: it stays tied to this browser.
// The newest copy wins, by updated_at (epoch ms).

const savedAtStore = createStore("vibear:saved-at", 0);
const CLOSET_URL = "/api/v1/closet";
type Closet = { items: SavedItem[]; updated_at: number };

let pushTimer: ReturnType<typeof setTimeout> | undefined;

function pushCloset() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    const body = JSON.stringify({ items: savedStore.read(), updated_at: savedAtStore.read() } satisfies Closet);
    // keepalive lets the last save finish if the tab closes, but only for small bodies.
    fetch(CLOSET_URL, { method: "PUT", headers: { "Content-Type": "application/json" }, body, keepalive: body.length < 60_000 }).catch(
      () => {}, // offline or API down: the browser copy still works, the next change retries
    );
  }, 400);
}

let synced = false;

/** Once per page load: restore the closet if the browser lost it, or back it up if it's newer. */
export function syncCloset() {
  if (synced) return;
  synced = true;
  fetch(CLOSET_URL)
    .then((response) => (response.ok ? (response.json() as Promise<Closet>) : null))
    .then((remote) => {
      if (!remote) return;
      // Closets saved before the backup existed have no timestamp: count them as old but real.
      const local = savedAtStore.read() || (savedStore.read().length > 0 ? 1 : 0);
      if (remote.updated_at > local) {
        savedStore.write(remote.items);
        savedAtStore.write(remote.updated_at);
      } else if (local > remote.updated_at) {
        if (!savedAtStore.read()) savedAtStore.write(local);
        pushCloset();
      }
    })
    .catch(() => {});
}

export function useRecentLooks(): RecentLook[] {
  return useSyncExternalStore(recentStore.subscribe, recentStore.read, recentStore.serverSnapshot);
}

export function rememberLook(look: Look) {
  const entry: RecentLook = {
    image_id: look.image_id,
    width: look.width,
    height: look.height,
    count: look.items.filter((item) => item.label !== "full_image").length,
    at: Date.now(),
  };
  const others = recentStore.read().filter((item) => item.image_id !== look.image_id);
  recentStore.write([entry, ...others].slice(0, MAX_RECENT));
}

const locationStore = createStore<Place | null>("vibear:location", null);

/** The last place the visitor searched shops around. Stays in this browser only. */
export function useSavedLocation() {
  const value = useSyncExternalStore(locationStore.subscribe, locationStore.read, locationStore.serverSnapshot);
  const set = useCallback((next: Place | null) => locationStore.write(next), []);
  return [value, set] as const;
}

export type MotionPreference = "running" | "paused";
const motionStore = createStore<MotionPreference>("vibear:motion", "running");

/** The visitor's "Pausar movimiento" choice (WCAG 2.2.2), remembered in this browser. */
export function useMotionPreference() {
  const value = useSyncExternalStore(motionStore.subscribe, motionStore.read, motionStore.serverSnapshot);
  const set = useCallback((next: MotionPreference) => motionStore.write(next), []);
  return [value, set] as const;
}

export function forgetLook(imageId: string) {
  recentStore.write(recentStore.read().filter((item) => item.image_id !== imageId));
}
