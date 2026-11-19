// The host's side of a share: one captured screen, one room, everyone with the link watching.

import { captureScreen, captureSound, hint, newController } from "./capture";
import { inviteUrl, newSecret } from "./link";
import { setMode } from "./peer";
import type { Profile } from "./profile";
import { enter, type Session } from "./room";
import type { Mode } from "./tuning";

const META = { kind: "screen" };

/** `profile` is null until their name and critter arrive. */
export type Watcher = { userId: string; profile: Profile | null; connections: RTCPeerConnection[] };

export class Share {
  readonly link: string;
  /** What viewers receive: the screen's video, its sound, and the extra sound source. */
  readonly out: MediaStream;
  private screen: MediaStream;
  private extra: MediaStreamTrack | null = null;
  private stopped = false;
  private offs: (() => void)[] = [];

  private constructor(
    private session: Session,
    screen: MediaStream,
    link: string,
    private profile: Profile,
    private onChange: () => void,
    private onEnd: () => void,
  ) {
    this.screen = screen;
    this.link = link;
    this.out = new MediaStream(screen.getTracks());
    this.watchEnd();
    const { room, profiles } = session;
    // newcomers get the stream as they arrive; everyone else already has it
    this.offs.push(
      room.onUserJoin(({ userId }) => {
        void room.addStream(this.out, { target: userId, metadata: META });
        onChange();
      }),
      room.onUserLeave(onChange),
      profiles.onChange(onChange),
    );
  }

  /** Asks for a screen, then opens the room. Throws if the person cancels the picker. */
  static async start(profile: Profile, mode: Mode, onChange: () => void, onEnd: () => void) {
    const ctl = newController();
    const screen = await captureScreen(ctl?.controller);
    ctl?.stayHere();
    hint(screen.getVideoTracks()[0], mode);
    setMode(mode);
    try {
      const secret = newSecret();
      const session = await enter(secret);
      const { userId } = await session.room.getSelf();
      const link = inviteUrl({ secret, hostId: userId }, location);
      const share = new Share(session, screen, link, profile, onChange, onEnd);
      await share.publish();
      return share;
    } catch (error) {
      for (const t of screen.getTracks()) t.stop();
      throw error;
    }
  }

  get sound() {
    return { screen: this.screen.getAudioTracks().length > 0, extra: this.extra };
  }

  watchers(): Watcher[] {
    const { room, profiles } = this.session;
    const peers = Object.values(room.getPeers());
    return Object.keys(room.getUsers()).map((userId) => ({
      userId,
      profile: profiles.has(userId) ? profiles.get(userId) : null,
      connections: peers.flatMap((p) =>
        p.userId === userId && p.connection ? [p.connection] : [],
      ),
    }));
  }

  /** A new name or critter, shown to everyone watching right away. */
  async setProfile(profile: Profile) {
    if (this.stopped) return;
    this.profile = profile;
    await this.session.show.set((s) => ({ ...s, ...profile }));
  }

  setMode(mode: Mode) {
    hint(this.screen.getVideoTracks()[0], mode);
    setMode(mode);
  }

  /** Picks another screen, window or tab; the link stays the same. */
  async changeSource(mode: Mode) {
    const ctl = newController();
    const next = await captureScreen(ctl?.controller);
    ctl?.stayHere();
    hint(next.getVideoTracks()[0], mode);
    for (const t of this.screen.getTracks()) {
      this.out.removeTrack(t);
      t.stop();
    }
    this.screen = next;
    for (const t of next.getTracks()) this.out.addTrack(t);
    this.watchEnd();
    await this.publish();
  }

  /** Sends a sound input too: a mic, or desktop sound exposed as an input on Linux. */
  async addSound(deviceId?: string) {
    const [track] = (await captureSound(deviceId)).getAudioTracks();
    this.dropExtra();
    this.extra = track;
    this.out.addTrack(track);
    await this.publish();
  }

  async removeSound() {
    this.dropExtra();
    await this.publish();
  }

  async remove(userId: string) {
    await this.session.room.ban(userId);
    this.onChange();
  }

  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    for (const off of this.offs) off();
    for (const t of this.out.getTracks()) t.stop();
    await this.session.show.set({ ...this.profile, live: false, sound: false }).catch(() => {});
    await this.session.room.leave();
  }

  /** Syncs the outgoing tracks to every viewer (Trystero adds and removes the difference). */
  private async publish() {
    await this.session.room.addStream(this.out, { metadata: META });
    await this.session.show.set({
      ...this.profile,
      live: true,
      sound: this.out.getAudioTracks().length > 0,
    });
    this.onChange();
  }

  private dropExtra() {
    if (!this.extra) return;
    this.out.removeTrack(this.extra);
    this.extra.stop();
    this.extra = null;
  }

  /** The browser's own "Stop sharing" button ends the video track: end the share with it. */
  private watchEnd() {
    const video = this.screen.getVideoTracks()[0];
    video?.addEventListener(
      "ended",
      () => {
        if (this.screen.getVideoTracks()[0] !== video) return; // replaced, not stopped
        void this.stop().then(this.onEnd);
      },
      { once: true },
    );
  }
}
