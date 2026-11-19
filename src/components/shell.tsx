import { ArrowUpRightIcon } from "lucide-react";
import { NetworkSettings } from "./network-settings";
import { ProfileButton } from "./profile";

export const SOURCE_URL = "https://github.com/luannzin/sightline";

/** The one column every page that isn't a live stage sits in. */
export function Page({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-6 pt-16 pb-12 sm:pt-24">
      <header className="flex items-center gap-3">
        <img
          src="./icon.png"
          alt=""
          width={40}
          height={40}
          className="art-edge size-10 rounded-[10px] [image-rendering:pixelated]"
        />
        <div className="min-w-0 flex-1 leading-snug">
          <h1 className="font-medium">Sightline</h1>
          <p className="truncate text-muted-foreground">Show your screen with a link</p>
        </div>
        <ProfileButton className="-me-3 max-w-[50%]" />
      </header>
      <div className="mt-10 flex flex-1 flex-col">{children}</div>
      <footer className="mt-20 flex items-center justify-between gap-6 text-muted-foreground">
        <NetworkSettings />
        <a
          href={SOURCE_URL}
          className="inline-flex items-center gap-1 underline decoration-1 underline-offset-4 transition-colors duration-150 hover:text-foreground"
        >
          Source
          <ArrowUpRightIcon aria-hidden="true" className="size-4" />
        </a>
      </footer>
    </main>
  );
}
