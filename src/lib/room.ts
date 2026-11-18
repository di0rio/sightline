import { joinRoom, roles } from "trystero";
import { roomName } from "./link";
import { TunedPeerConnection } from "./peer";
import { turnConfig } from "./settings";

// Trystero's default public relays share one namespace, so the app id keeps rooms apart.
const APP_ID = "luannzin/sightline";

/** What the host publishes; only the host can write it. */
export type Show = { name: string; live: boolean; sound: boolean };
export const OFF_AIR: Show = { name: "", live: false, sound: false };

/**
 * Joins the room for `secret`. The host owns it (its userId becomes the room's admin and is
 * appended to the room name); a viewer passes that `hostId` and trusts only that user.
 */
export async function enter(secret: string, hostId?: string) {
  const base = await roomName(secret);
  const room = joinRoom(
    {
      appId: APP_ID,
      password: secret,
      // The host gets a fresh identity per share, so two shares from one browser can't be
      // linked. A viewer keeps one per browser, so being removed survives a reload.
      identity: hostId ? "local" : "none",
      rtcPolyfill: TunedPeerConnection,
      turnConfig: turnConfig(),
      use: [roles(hostId ? {} : { selfAsAdmin: true })],
    },
    hostId ? `${base}~${hostId}` : base,
  );
  const show = room.makeState<Show>("show", OFF_AIR, {
    validate: (s) => typeof s.name === "string" && s.name.length <= 40,
  });
  const names = room.makeUserState("name", "", { validate: (n) => n.length <= 40 });
  return { room, show, names };
}

export type Session = Awaited<ReturnType<typeof enter>>;
