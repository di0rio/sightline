// One line of numbers per connection, read from getStats() once a second.

export type Stats = {
  width: number;
  height: number;
  fps: number;
  kbps: number;
  codec: string;
  rttMs: number | null;
  relayed: boolean;
  /** Sender only: why the encoder is holding back, when it is. */
  limit: string | null;
};

type Sample = { bytes: number; at: number };

/** Reads a connection's video stats; pass the previous sample back to get a bitrate. */
export async function readStats(pc: RTCPeerConnection, last?: Sample) {
  const report = await pc.getStats();
  let video: Record<string, unknown> | undefined;
  let pair: Record<string, unknown> | undefined;
  for (const s of report.values()) {
    if ((s.type === "outbound-rtp" || s.type === "inbound-rtp") && s.kind === "video") video = s;
    if (s.type === "transport" && s.selectedCandidatePairId)
      pair = report.get(s.selectedCandidatePairId);
  }
  // Firefox has no transport stats: fall back to the nominated pair
  if (!pair)
    for (const s of report.values())
      if (s.type === "candidate-pair" && s.nominated && s.state === "succeeded") pair = s;
  if (!video) return null;

  const bytes = Number(video.bytesSent ?? video.bytesReceived ?? 0);
  const now = performance.now();
  const kbps = last ? Math.max(0, ((bytes - last.bytes) * 8) / (now - last.at)) : 0;
  const local = pair && report.get(pair.localCandidateId as string);
  const remote = pair && report.get(pair.remoteCandidateId as string);
  const codec = video.codecId ? report.get(video.codecId as string) : undefined;
  const limit = video.qualityLimitationReason as string | undefined;

  const stats: Stats = {
    width: Number(video.frameWidth ?? 0),
    height: Number(video.frameHeight ?? 0),
    fps: Math.round(Number(video.framesPerSecond ?? 0)),
    kbps: Math.round(kbps),
    codec: String(codec?.mimeType ?? "").replace(/^video\//, ""),
    rttMs:
      pair?.currentRoundTripTime != null
        ? Math.round(Number(pair.currentRoundTripTime) * 1000)
        : null,
    relayed: local?.candidateType === "relay" || remote?.candidateType === "relay",
    limit: limit && limit !== "none" ? limit : null,
  };
  return { stats, sample: { bytes, at: now } satisfies Sample };
}

export function formatRate(kbps: number) {
  return kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kbps`;
}
