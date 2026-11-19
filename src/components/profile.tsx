import { DicesIcon, ShuffleIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { randomSeed } from "@/lib/avatar";
import { cleanName, MAX_NAME, type Profile, randomName } from "@/lib/profile";
import { settings } from "@/lib/settings";
import { cn } from "@/lib/utils";

// This browser's profile, in one place every screen reads: change it anywhere and the page, the
// host's show and the viewer's room all follow.
let current: Profile | null = null;
const subscribers = new Set<() => void>();

export function getProfile() {
  current ??= settings.profile();
  return current;
}

export function saveProfile(profile: Profile) {
  current = profile;
  settings.setProfile(profile);
  for (const notify of subscribers) notify();
}

const subscribe = (notify: () => void) => {
  subscribers.add(notify);
  return () => subscribers.delete(notify);
};

export function useProfile() {
  return useSyncExternalStore(subscribe, getProfile);
}

const CHOICES = 12;
const more = (keep: number) => [keep, ...Array.from({ length: CHOICES - 1 }, randomSeed)];

/** Name and critter, changeable at any time: before sharing, while watching, mid-share. */
export function ProfileDialog({
  open,
  onOpenChange,
  container,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where to put it when something is full screen, so it shows up there. */
  container?: HTMLElement | null;
}) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(0);
  const [choices, setChoices] = useState<number[]>([]);

  // start from what's saved every time it opens, whatever opened it
  useEffect(() => {
    if (!open) return;
    const saved = getProfile();
    setName(saved.name);
    setAvatar(saved.avatar);
    setChoices(more(saved.avatar));
  }, [open]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    saveProfile({ name: cleanName(name) || getProfile().name, avatar });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup portalProps={container ? { container } : undefined}>
        <form onSubmit={save} className="contents">
          <DialogHeader>
            <DialogTitle>How others see you</DialogTitle>
            <DialogDescription>
              Everyone in the share sees your name and critter, and sees changes as soon as you
              save. This browser remembers them.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-6">
            <div className="flex items-end gap-4">
              <Avatar seed={avatar} size={64} />
              <Field className="min-w-0 flex-1">
                <FieldLabel>Name</FieldLabel>
                <div className="flex w-full gap-2">
                  <Input
                    name="name"
                    autoComplete="nickname"
                    spellCheck={false}
                    maxLength={MAX_NAME}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="min-w-0 flex-1"
                  />
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Random name"
                          onClick={() => setName(randomName())}
                        />
                      }
                    >
                      <DicesIcon aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipPopup>Random name</TooltipPopup>
                  </Tooltip>
                </div>
              </Field>
            </div>
            <fieldset className="flex flex-col items-start gap-3">
              <legend className="font-medium text-sm">Critter</legend>
              <div className="grid w-full grid-cols-[repeat(auto-fill,48px)] gap-2.5">
                {choices.map((seed, i) => (
                  <label key={seed} className="cursor-pointer">
                    <input
                      type="radio"
                      name="avatar"
                      aria-label={`Critter ${i + 1}`}
                      checked={avatar === seed}
                      onChange={() => setAvatar(seed)}
                      className="peer sr-only"
                    />
                    <Avatar
                      seed={seed}
                      size={48}
                      className={cn(
                        "ring-offset-2 ring-offset-popover transition-shadow duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-2",
                        avatar === seed
                          ? "ring-2 ring-foreground"
                          : "hover:ring-2 hover:ring-input",
                      )}
                    />
                  </label>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="-ms-2.5"
                onClick={() => setChoices(more(avatar))}
              >
                <ShuffleIcon aria-hidden="true" />
                More critters
              </Button>
            </fieldset>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" type="button" />}>Cancel</DialogClose>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

/** You, in the corner of every page: your critter and name, a click from changing them. */
export function ProfileButton({ className }: { className?: string }) {
  const profile = useProfile();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              aria-label={`${profile.name}. Change your name and critter`}
              onClick={() => setOpen(true)}
              className={cn("h-auto min-w-0 gap-2.5 p-1 sm:h-auto sm:pe-3", className)}
            />
          }
        >
          <Avatar seed={profile.avatar} />
          {/* on a phone the critter alone leaves the tagline room; the name stays in the label */}
          <span className="truncate max-sm:sr-only">{profile.name}</span>
        </TooltipTrigger>
        <TooltipPopup>Change your name and critter</TooltipPopup>
      </Tooltip>
      <ProfileDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
