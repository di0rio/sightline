import { expect, test } from "bun:test";
import { inviteUrl, newSecret, parseInvite, roomName } from "./link";
import { pickCodec, stereoOpus } from "./tuning";

const SDP = [
  "v=0",
  "m=audio 9 UDP/TLS/RTP/SAVPF 111 63",
  "a=rtpmap:111 opus/48000/2",
  "a=fmtp:111 minptime=10;useinbandfec=1",
  "a=rtpmap:63 red/48000/2",
  "",
].join("\r\n");

test("stereoOpus adds stereo to the opus fmtp and keeps the rest", () => {
  const out = stereoOpus(SDP);
  expect(out).toContain(
    "a=fmtp:111 minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1;maxaveragebitrate=128000\r\n",
  );
  expect(out).toContain("a=rtpmap:63 red/48000/2\r\n");
  expect(stereoOpus(out)).toBe(out); // running twice changes nothing
});

test("stereoOpus overrides stereo=0 and adds a missing fmtp line", () => {
  expect(stereoOpus(SDP.replace("useinbandfec=1", "stereo=0"))).toContain(
    "a=fmtp:111 minptime=10;stereo=1;sprop-stereo=1;maxaveragebitrate=128000\r\n",
  );
  const bare = SDP.replace("a=fmtp:111 minptime=10;useinbandfec=1\r\n", "");
  expect(stereoOpus(bare)).toContain(
    "a=rtpmap:111 opus/48000/2\r\na=fmtp:111 stereo=1;sprop-stereo=1;maxaveragebitrate=128000\r\n",
  );
  expect(stereoOpus("v=0\r\nm=video 9 UDP 96\r\n")).toBe("v=0\r\nm=video 9 UDP 96\r\n");
});

test("pickCodec prefers hardware by quality, else VP9 in software", () => {
  const all = ["video/VP8", "video/H264", "video/VP9", "video/AV1", "video/rtx"].map(
    (mimeType) => ({
      mimeType,
    }),
  );
  expect(pickCodec(all, new Set())?.mimeType).toBe("video/VP9");
  expect(pickCodec(all, new Set(["video/H264"]))?.mimeType).toBe("video/H264");
  expect(pickCodec(all, new Set(["video/H264", "video/AV1"]))?.mimeType).toBe("video/AV1");
  expect(pickCodec(all.slice(0, 1), new Set(["video/AV1"]))?.mimeType).toBe("video/VP8");
  expect(pickCodec([{ mimeType: "video/rtx" }], new Set())).toBeUndefined();
});

test("invite links round-trip and reject anything else", async () => {
  const secret = newSecret();
  expect(secret).toMatch(/^[0-9A-Za-z]{22}$/);
  expect(newSecret()).not.toBe(secret);
  const hostId = "9fX2kLm8pQr7vBn3wZy4xT";
  const url = inviteUrl({ secret, hostId }, { origin: "https://x.dev", pathname: "/sightline/" });
  expect(url).toBe(`https://x.dev/sightline/#${secret}~${hostId}`);
  expect(parseInvite(new URL(url).hash)).toEqual({ secret, hostId });
  for (const bad of [
    "",
    "#",
    `#${secret}`,
    `#${secret}~${hostId}~x`,
    `#${secret}~short`,
    `#${secret}!~${hostId}`,
  ])
    expect(parseInvite(bad)).toBeNull();
  const room = await roomName(secret);
  expect(room).toMatch(/^[0-9a-f]{32}$/);
  expect(room).not.toContain(secret);
});
