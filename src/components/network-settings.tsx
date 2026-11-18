import { useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";
import { settings } from "@/lib/settings";

/** An optional TURN relay, for the networks that can't connect directly. */
export function NetworkSettings({
  trigger = "Network settings",
  variant = "link",
}: {
  trigger?: string;
  variant?: "link" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [turn, setTurn] = useState(settings.turn);
  const [invalid, setInvalid] = useState(false);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const url = turn.url.trim();
    if (url && !/^turns?:/i.test(url)) {
      setInvalid(true);
      return;
    }
    settings.setTurn({ ...turn, url });
    setOpen(false);
    toastManager.add({
      title: url ? "Relay saved" : "Relay removed",
      description: "It applies to the next share or link you open.",
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setTurn(settings.turn());
          setInvalid(false);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant={variant}
            className={
              variant === "link"
                ? "h-auto px-0 text-muted-foreground hover:text-foreground sm:h-auto"
                : undefined
            }
          />
        }
      >
        {trigger}
      </DialogTrigger>
      <DialogPopup>
        <form onSubmit={save} noValidate className="contents">
          <DialogHeader>
            <DialogTitle>Network settings</DialogTitle>
            <DialogDescription>
              When two networks can't connect directly, a TURN relay passes the video along. It
              stays encrypted end to end, so the relay can't watch.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-5">
            <Field invalid={invalid}>
              <FieldLabel>TURN server</FieldLabel>
              <Input
                name="turn-url"
                autoComplete="off"
                spellCheck={false}
                placeholder="turns:turn.example.com:443"
                value={turn.url}
                onChange={(e) => {
                  setInvalid(false);
                  setTurn({ ...turn, url: e.target.value });
                }}
              />
              {invalid ? (
                <FieldError match>Start the address with turn: or turns:</FieldError>
              ) : (
                <FieldDescription>Leave it empty to connect only directly.</FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel>Username</FieldLabel>
              <Input
                name="turn-username"
                autoComplete="off"
                value={turn.username}
                onChange={(e) => setTurn({ ...turn, username: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>Password</FieldLabel>
              <Input
                name="turn-credential"
                type="password"
                autoComplete="off"
                value={turn.credential}
                onChange={(e) => setTurn({ ...turn, credential: e.target.value })}
              />
            </Field>
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
