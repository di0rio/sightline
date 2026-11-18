// Every WebRTC policy Sightline has lives in this one RTCPeerConnection subclass, handed to
// Trystero as `rtcPolyfill`, so Trystero keeps doing the signaling and the media plumbing.

import { MODES, type Mode, pickCodec, stereoOpus } from "./tuning";

// Chrome 126+ lets a sender switch between negotiated codecs; the DOM typings don't know yet.
type Encoding = RTCRtpEncodingParameters & { codec?: RTCRtpCodec };

const peers = new Set<TunedPeerConnection>();
let mode: Mode = "sharp";
let hardware = new Set<string>();

export class TunedPeerConnection extends RTCPeerConnection {
  constructor(config?: RTCConfiguration) {
    super(config);
    peers.add(this);
    const settle = () => {
      if (this.connectionState === "closed" || this.connectionState === "failed")
        peers.delete(this);
      // after the first connect and after every renegotiation (a viewer joining, a new source)
      else if (this.connectionState === "connected" && this.signalingState === "stable")
        void tune(this);
    };
    this.addEventListener("connectionstatechange", settle);
    this.addEventListener("signalingstatechange", settle);
  }

  override setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    return super.setRemoteDescription(
      description.sdp ? { type: description.type, sdp: stereoOpus(description.sdp) } : description,
    );
  }

  override close() {
    peers.delete(this);
    super.close();
  }
}

/** Applies a mode to every live connection, and to the ones that come later. */
export function setMode(next: Mode) {
  mode = next;
  for (const pc of peers) void tune(pc);
}

/** Which codecs this machine encodes in hardware at 1080p60. Run once, before sharing. */
export async function detectHardware() {
  const found = new Set<string>();
  await Promise.all(
    ["video/AV1", "video/VP9", "video/H264"].map(async (contentType) => {
      try {
        const info = await navigator.mediaCapabilities.encodingInfo({
          type: "webrtc",
          video: { contentType, width: 1920, height: 1080, bitrate: 6_000_000, framerate: 60 },
        });
        if (info.supported && info.powerEfficient) found.add(contentType);
      } catch {
        // not supported here: the browser's default order applies
      }
    }),
  );
  hardware = found;
}

async function tune(pc: RTCPeerConnection) {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== "video") continue;
    const params = sender.getParameters();
    const encoding = params.encodings[0] as Encoding | undefined;
    if (!encoding) continue;
    encoding.maxBitrate = MODES[mode].bitrate;
    encoding.maxFramerate = MODES[mode].fps;
    encoding.codec = pickCodec(params.codecs, hardware);
    try {
      await sender.setParameters(params);
    } catch {
      // a browser without per-encoding codecs rejects the whole call: keep the caps at least
      delete encoding.codec;
      await sender.setParameters(params).catch(() => {});
    }
  }
}
