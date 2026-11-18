import { useEffect, useState } from "react";
import { Dusk } from "@/components/dusk";
import { Page } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { parseInvite } from "@/lib/link";
import { Host } from "@/screens/host";
import { Viewer } from "@/screens/viewer";

// One page: no fragment means you're sharing, a valid `#secret~host` means you're watching.
export function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const sync = () => setHash(location.hash);
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);

  if (hash.length <= 1) return <Host />;
  const invite = parseInvite(hash);
  if (invite) return <Viewer key={hash} invite={invite} />;

  return (
    <Page>
      <Dusk className="art-edge aspect-video w-full rounded-[14px]" />
      <p className="mt-8 text-foreground/70">
        This link is incomplete. Ask whoever sent it to copy the whole thing again.
      </p>
      <div className="mt-6">
        <Button variant="outline" onClick={() => (location.hash = "")}>
          Share your own screen
        </Button>
      </div>
    </Page>
  );
}
