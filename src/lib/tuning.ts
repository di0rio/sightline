// Pure parts of the WebRTC tuning, kept free of browser globals so `bun test` can run them.

export type Mode = "sharp" | "smooth";

/** Per-viewer caps. The browser's congestion control still adapts below them. */
export const MODES: Record<Mode, { hint: string; fps: number; bitrate: number }> = {
  // text and code: keep every pixel, frames can wait
  sharp: { hint: "detail", fps: 30, bitrate: 6_000_000 },
  // video and games: keep the motion, resolution can give
  smooth: { hint: "motion", fps: 60, bitrate: 8_000_000 },
};

/** Opus bitrate asked for. Stereo music is clean at this rate and it's cheap per viewer. */
const OPUS_BITRATE = 128_000;

/**
 * Asks the other side for stereo Opus at a music bitrate. Browsers negotiate mono speech by
 * default, and an encoder only sends stereo when the remote description says `stereo=1`, so
 * this runs on every description a peer receives.
 */
export function stereoOpus(sdp: string): string {
  const pt = /a=rtpmap:(\d+) opus\/48000\/2/i.exec(sdp)?.[1];
  if (!pt) return sdp;
  const want: Record<string, string> = {
    stereo: "1",
    "sprop-stereo": "1",
    maxaveragebitrate: String(OPUS_BITRATE),
  };
  const fmtp = new RegExp(`^a=fmtp:${pt} ([^\\r\\n]*)`, "m");
  const line = fmtp.exec(sdp);
  if (!line) {
    const params = Object.entries(want).map(([k, v]) => `${k}=${v}`);
    return sdp.replace(
      new RegExp(`^(a=rtpmap:${pt} [^\\r\\n]*)(\\r?\\n)`, "m"),
      `$1$2a=fmtp:${pt} ${params.join(";")}$2`,
    );
  }
  const params = new Map(
    line[1]
      .split(";")
      .filter(Boolean)
      .map((p) => p.trim().split("=") as [string, string]),
  );
  for (const [k, v] of Object.entries(want)) params.set(k, v);
  const joined = Array.from(params, ([k, v]) => (v === undefined ? k : `${k}=${v}`)).join(";");
  return sdp.replace(fmtp, `a=fmtp:${pt} ${joined}`);
}

type Codec = { mimeType: string; sdpFmtpLine?: string };

/** Best quality first, when the encoder runs in hardware. */
const QUALITY = ["video/AV1", "video/VP9", "video/H264"];
/** In software, VP9 first: AV1 costs a lot more CPU, and the host encodes once per viewer. */
const SOFTWARE = ["video/VP9", "video/AV1", "video/H264", "video/VP8"];

/**
 * Picks the codec to send from those both sides negotiated: a hardware encoder in quality
 * order if there is one, else the cheapest good software one.
 */
export function pickCodec<T extends Codec>(
  negotiated: readonly T[],
  hardware: ReadonlySet<string>,
) {
  const find = (mime: string) =>
    negotiated.find((c) => c.mimeType.toLowerCase() === mime.toLowerCase());
  for (const mime of QUALITY) if (hardware.has(mime) && find(mime)) return find(mime);
  for (const mime of SOFTWARE) if (find(mime)) return find(mime);
  return undefined;
}
