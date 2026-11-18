// A share link is `#<secret>~<hostId>`, both 22 Base62 characters.
//
// - The secret is 131 random bits. It is the room password (Trystero derives the AES key that
//   encrypts every offer and answer from it), and a hash of it is the room name, so the secret
//   itself never reaches a relay.
// - The host id is the host's Trystero userId for this share. Viewers trust only that user
//   (roles() makes them the room's admin), so someone else with the link can't pose as the host.
// - It lives after the `#`, which browsers never send to the server hosting the page.

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ID = /^[0-9A-Za-z]{22}$/;

export function newSecret(): string {
  let out = "";
  while (out.length < 22) {
    for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
      // 248 = 4 * 62: dropping the top bytes keeps every character equally likely
      if (byte < 248 && out.length < 22) out += BASE62[byte % 62];
    }
  }
  return out;
}

/** The room name for a secret: hex SHA-256, so the relays never see the secret. */
export async function roomName(secret: string): Promise<string> {
  const data = new TextEncoder().encode(`sightline:${secret}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(hash.subarray(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type Invite = { secret: string; hostId: string };

export function parseInvite(hash: string): Invite | null {
  const [secret, hostId, ...rest] = hash.replace(/^#/, "").split("~");
  if (rest.length || !ID.test(secret ?? "") || !ID.test(hostId ?? "")) return null;
  return { secret, hostId };
}

export function inviteUrl({ secret, hostId }: Invite, page: { origin: string; pathname: string }) {
  return `${page.origin}${page.pathname}#${secret}~${hostId}`;
}
