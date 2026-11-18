import {
  ActivityIcon,
  MaximizeIcon,
  MinimizeIcon,
  PictureInPicture2Icon,
  PlayIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dusk } from "@/components/dusk";
import { NetworkSettings } from "@/components/network-settings";
import { Page } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import type { Invite } from "@/lib/link";
import { enter, OFF_AIR, type Session, type Show } from "@/lib/room";
import { settings } from "@/lib/settings";
import { formatRate, readStats, type Stats } from "@/lib/stats";

type Phase = "ready" | "joining" | "live" | "ended" | "removed";

export function Viewer({ invite }: { invite: Invite }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [name, setName] = useState(settings.name);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [show, setShow] = useState<Show>(OFF_AIR);
  const [blocked, setBlocked] = useState(false);
  const [slow, setSlow] = useState(false);
  const session = useRef<Session | null>(null);

  const joining = phase === "joining" || phase === "live";
  useEffect(() => {
    if (!joining) return;
    let gone = false;
    let current: Session | null = null;
    const offs: (() => void)[] = [];
    const slowTimer = setTimeout(() => setSlow(true), 20_000);

    enter(invite.secret, invite.hostId).then(
      (s) => {
        if (gone) return void s.room.leave();
        current = s;
        session.current = s;
        void s.names.set(name.trim());
        offs.push(
          // only the host's stream; the host's id came with the link and Trystero verifies it
          s.room.onPeerStream(
            (incoming, { userId }) => {
              if (userId !== invite.hostId) return;
              setStream(incoming);
              setPhase("live");
            },
            { replay: true },
          ),
          s.show.onChange(
            (value) => {
              if (!s.show.getMeta()) return; // the default, before the host's state arrives
              setShow(value);
              if (!value.live) setPhase("ended");
            },
            { replay: true },
          ),
          s.room.onUserLeave(({ userId }) => userId === invite.hostId && setPhase("ended")),
          s.room.onError((error) => {
            if (error.code === "banned") setPhase("removed");
            if (error.code === "peer-connect-failed") setBlocked(true);
          }),
        );
      },
      () => setBlocked(true),
    );

    return () => {
      gone = true;
      clearTimeout(slowTimer);
      for (const off of offs) off();
      void current?.room.leave();
      session.current = null;
    };
  }, [joining, invite, name]);

  // stop listening once it's over, so the room closes and the camera-style indicators go away
  useEffect(() => {
    if (phase === "ended" || phase === "removed") setStream(null);
  }, [phase]);

  if (phase === "live" && stream)
    return <Stage stream={stream} show={show} session={session} hostId={invite.hostId} />;

  return (
    <Page>
      <Dusk className="art-edge grid aspect-video w-full place-items-center rounded-[14px]">
        {phase === "joining" && (
          <div className="relative flex items-center gap-2.5 rounded-full bg-black/60 px-3.5 py-2 text-white backdrop-blur">
            <Spinner aria-hidden="true" />
            Connecting to the host…
          </div>
        )}
      </Dusk>
      <div role="status" className="mt-8 text-pretty text-foreground/70 leading-relaxed">
        {phase === "ready" && (
          <p>Someone sent you their screen. Press Watch to see it here, with sound.</p>
        )}
        {phase === "joining" && !blocked && (
          <p>
            {slow
              ? "Still trying. If it doesn't connect, the share may have ended. Ask for a new link."
              : "This usually takes a few seconds."}
          </p>
        )}
        {phase === "joining" && blocked && (
          <p>
            Unable to connect to the host directly. A network on one side is blocking it, which a
            relay server usually gets around.
          </p>
        )}
        {phase === "ended" && (
          <p>{show.name ? `${show.name} stopped sharing.` : "The share ended."}</p>
        )}
        {phase === "removed" && <p>The host removed you from this share.</p>}
      </div>

      {phase === "ready" && (
        <form
          className="mt-8 flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            settings.setName(name);
            setPhase("joining");
          }}
        >
          <Field>
            <FieldLabel>Your name</FieldLabel>
            <Input
              name="name"
              autoComplete="given-name"
              placeholder="Luan"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-xs"
            />
            <FieldDescription>So they know who's watching.</FieldDescription>
          </Field>
          <div>
            <Button type="submit" size="lg">
              <PlayIcon aria-hidden="true" />
              Watch
            </Button>
          </div>
        </form>
      )}
      {phase === "joining" && blocked && (
        <div className="mt-6">
          <NetworkSettings trigger="Set a relay server" variant="outline" />
        </div>
      )}
    </Page>
  );
}

/** The live screen, edge to edge, with controls that get out of the way. */
function Stage({
  stream,
  show,
  session,
  hostId,
}: {
  stream: MediaStream;
  show: Show;
  session: React.RefObject<Session | null>;
  hostId: string;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(settings.volume);
  const [blockedPlay, setBlockedPlay] = useState(false);
  const [full, setFull] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [awake, setAwake] = useState(true);
  const sleepTimer = useRef(0);

  // the host can change source or add sound: re-attach so the element picks up new tracks
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const attach = () => {
      el.srcObject = stream;
      el.play().then(
        () => setBlockedPlay(false),
        () => setBlockedPlay(true),
      );
    };
    attach();
    stream.addEventListener("addtrack", attach);
    stream.addEventListener("removetrack", attach);
    return () => {
      stream.removeEventListener("addtrack", attach);
      stream.removeEventListener("removetrack", attach);
    };
  }, [stream]);

  useEffect(() => {
    if (!video.current) return;
    video.current.muted = muted;
    video.current.volume = volume;
  }, [muted, volume]);

  useEffect(() => {
    const sync = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) return void document.exitFullscreen();
    const el = stage.current;
    if (el?.requestFullscreen) return void el.requestFullscreen().catch(() => {});
    // iPhone: only the video element itself can go full screen
    (
      video.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void }
    )?.webkitEnterFullscreen?.();
  }, []);

  const wake = useCallback(() => {
    setAwake(true);
    clearTimeout(sleepTimer.current);
    sleepTimer.current = window.setTimeout(() => {
      // keep the controls while someone's using them
      if (!stage.current?.querySelector("[data-controls]:hover, [data-controls]:focus-within"))
        setAwake(false);
    }, 2500);
  }, []);

  useEffect(() => {
    wake();
    const keys = (e: KeyboardEvent) => {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        (e.target as HTMLElement).closest("input, [role=slider]")
      )
        return;
      const key = e.key.toLowerCase();
      if (key === "f") toggleFull();
      else if (key === "m") setMuted((m) => !m);
      else if (key === "i") setShowStats((s) => !s);
      else return;
      e.preventDefault();
      wake();
    };
    addEventListener("keydown", keys);
    return () => {
      removeEventListener("keydown", keys);
      clearTimeout(sleepTimer.current);
    };
  }, [toggleFull, wake]);

  const title = show.name ? `${show.name}'s screen` : "Shared screen";
  const canPip = typeof document !== "undefined" && document.pictureInPictureEnabled;

  return (
    <div
      ref={stage}
      className="relative h-dvh w-full overflow-hidden bg-black data-[asleep]:cursor-none"
      data-asleep={!awake || undefined}
      onPointerMove={wake}
      onPointerDown={wake}
    >
      {/* biome-ignore lint/a11y/useMediaCaption: a live screen has no captions to load */}
      <video
        ref={video}
        autoPlay
        playsInline
        className="size-full object-contain"
        onDoubleClick={toggleFull}
        aria-label={title}
      />

      {blockedPlay && (
        <div className="absolute inset-0 grid place-items-center bg-black/60">
          <Button size="lg" onClick={() => video.current?.play().then(() => setBlockedPlay(false))}>
            <PlayIcon aria-hidden="true" />
            Play
          </Button>
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-linear-to-b from-black/70 to-transparent px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 text-white transition-opacity duration-300 data-[asleep]:opacity-0"
        data-asleep={!awake || undefined}
      >
        <p className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-red-500" />
          <span className="truncate font-medium">{title}</span>
          <span className="shrink-0 text-white/60">Live</span>
        </p>
        {showStats && <StatsPanel session={session} hostId={hostId} />}
      </div>

      <div
        data-controls
        className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-linear-to-t from-black/70 to-transparent px-3 pt-10 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white transition-opacity duration-300 data-[asleep]:pointer-events-none data-[asleep]:opacity-0 dark"
        data-asleep={!awake || undefined}
      >
        <Control label={muted ? "Unmute" : "Mute"} shortcut="M" onClick={() => setMuted((m) => !m)}>
          {muted || volume === 0 ? (
            <VolumeXIcon aria-hidden="true" />
          ) : (
            <Volume2Icon aria-hidden="true" />
          )}
        </Control>
        <Slider
          aria-label="Volume"
          className="w-28 px-2"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onValueChange={(v) => {
            const next = Array.isArray(v) ? v[0] : v;
            setVolume(next);
            setMuted(next === 0);
            settings.setVolume(next);
          }}
        />
        <div className="flex-1" />
        <Control
          label={showStats ? "Hide stats" : "Show stats"}
          shortcut="I"
          onClick={() => setShowStats((s) => !s)}
        >
          <ActivityIcon aria-hidden="true" />
        </Control>
        {canPip && (
          <Control
            label="Picture in picture"
            onClick={() => void video.current?.requestPictureInPicture().catch(() => {})}
          >
            <PictureInPicture2Icon aria-hidden="true" />
          </Control>
        )}
        <Control
          label={full ? "Exit full screen" : "Full screen"}
          shortcut="F"
          onClick={toggleFull}
        >
          {full ? <MinimizeIcon aria-hidden="true" /> : <MaximizeIcon aria-hidden="true" />}
        </Control>
      </div>
    </div>
  );
}

function Control({
  label,
  shortcut,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={label}
            onClick={onClick}
            className="text-white hover:bg-white/10"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipPopup>
        {label}
        {shortcut && <Kbd className="ms-2">{shortcut}</Kbd>}
      </TooltipPopup>
    </Tooltip>
  );
}

function StatsPanel({
  session,
  hostId,
}: {
  session: React.RefObject<Session | null>;
  hostId: string;
}) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let sample: { bytes: number; at: number } | undefined;
    const tick = async () => {
      const peer = Object.values(session.current?.room.getPeers() ?? {}).find(
        (p) => p.userId === hostId && p.connection,
      );
      if (!peer?.connection) return;
      const read = await readStats(peer.connection, sample).catch(() => null);
      if (!read) return;
      sample = read.sample;
      setStats(read.stats);
    };
    void tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session, hostId]);

  return (
    <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-4 gap-y-0.5 rounded-[10px] bg-black/60 px-3 py-2 font-mono text-sm tabular-nums backdrop-blur">
      {stats ? (
        <>
          <dt className="text-white/60">Picture</dt>
          <dd>
            {stats.width}×{stats.height} · {stats.fps} fps
          </dd>
          <dt className="text-white/60">Codec</dt>
          <dd>
            {stats.codec || "–"} · {formatRate(stats.kbps)}
          </dd>
          <dt className="text-white/60">Route</dt>
          <dd>
            {stats.relayed ? "Relay" : "Direct"}
            {stats.rttMs !== null && ` · ${stats.rttMs} ms`}
          </dd>
        </>
      ) : (
        <dd className="col-span-2 text-white/60">Reading…</dd>
      )}
    </dl>
  );
}
