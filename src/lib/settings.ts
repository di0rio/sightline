// Per-browser conveniences. Storage can be missing or throw (private windows, blocked site
// data), so every read falls back to a default and every write is best effort.

import type { TurnServerConfig } from "trystero";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`sightline:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(`sightline:${key}`, JSON.stringify(value));
  } catch {
    // nothing to do: it just won't be remembered
  }
}

export type Turn = { url: string; username: string; credential: string };

export const settings = {
  name: () => read("name", ""),
  setName: (name: string) => write("name", name.trim().slice(0, 40)),
  volume: () => read("volume", 1),
  setVolume: (volume: number) => write("volume", volume),
  turn: () => read<Turn>("turn", { url: "", username: "", credential: "" }),
  setTurn: (turn: Turn) => write("turn", turn),
};

/** The TURN server, in Trystero's shape, or nothing when none is set. */
export function turnConfig(): TurnServerConfig[] | undefined {
  const { url, username, credential } = settings.turn();
  return url ? [{ urls: url, username, credential }] : undefined;
}
