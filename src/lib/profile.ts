// Who you are in a share: a name and a critter. Everyone starts with a random pair, so nobody has
// to type anything before watching, and can change either at any time.

export type Profile = { name: string; avatar: number };

const ADJECTIVES = [
  "Amber",
  "Violet",
  "Ember",
  "Golden",
  "Plum",
  "Velvet",
  "Lunar",
  "Hazy",
  "Quiet",
  "Sleepy",
  "Dusky",
  "Rosy",
  "Misty",
  "Starry",
  "Mellow",
  "Cosmic",
  "Sunny",
  "Gentle",
  "Brave",
  "Swift",
  "Cozy",
  "Lucky",
  "Tiny",
  "Fuzzy",
];
const ANIMALS = [
  "Fox",
  "Owl",
  "Moth",
  "Heron",
  "Otter",
  "Lynx",
  "Finch",
  "Badger",
  "Hare",
  "Wren",
  "Crow",
  "Gecko",
  "Newt",
  "Koala",
  "Panda",
  "Raven",
  "Seal",
  "Sparrow",
  "Toad",
  "Yak",
  "Lemur",
  "Marten",
  "Quokka",
  "Bat",
];

export const MAX_NAME = 40;

export function randomName() {
  const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
}

/** Spaces collapsed, trimmed, cut to fit. */
export function cleanName(name: string) {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

/** Profiles come from other browsers: take only the shape we expect. */
export function isProfile(value: unknown): value is Profile {
  const p = value as Profile;
  return (
    typeof p === "object" &&
    p !== null &&
    typeof p.name === "string" &&
    p.name.length <= MAX_NAME &&
    Number.isInteger(p.avatar) &&
    p.avatar >= 0 &&
    p.avatar <= 0xffffffff
  );
}
