import { useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useInstallApp } from "@/lib/install";
import { Button } from "@/components/ui";

const DISMISS_KEY = "alternate-install-dismissed";

function IosSteps() {
  return (
    <p className="text-[14px] text-muted">
      In Safari, tap <Share className="inline h-4 w-4 align-[-3px] text-ink" aria-label="Share" /> Share, then <span className="text-ink">Add to Home Screen</span>.
    </p>
  );
}

/** Account page section. */
export function InstallAppSection() {
  const app = useInstallApp();
  return (
    <div className="grid gap-3">
      {app.installed ? (
        <p className="text-muted">You're using the VAA ALTERNATE app. Open it any time from your home screen.</p>
      ) : (
        <>
          <p className="text-muted">Add VAA ALTERNATE to your home screen. It opens full screen like an app, with no app store and almost no storage.</p>
          {app.canPrompt ? (
            <Button className="justify-self-start" onClick={app.install}><Download className="h-4 w-4" /> Install VAA ALTERNATE</Button>
          ) : app.ios ? (
            <IosSteps />
          ) : (
            <p className="text-[14px] text-muted">In Chrome, open the ⋮ menu and choose <span className="text-ink">Add to Home screen</span> or <span className="text-ink">Install app</span>.</p>
          )}
        </>
      )}
    </div>
  );
}

/** Small bar above the phone navigation. Shows once until installed or dismissed. */
export function InstallBanner() {
  const app = useInstallApp();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (dismissed || !(app.canPrompt || app.ios)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode */
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-ink bg-paper px-4 py-3 md:hidden" role="region" aria-label="Install the app">
      <div className="flex items-center gap-3">
        <img src="/brand/icon-192.png" alt="" className="h-10 w-10 border border-rule" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium">Get the VAA ALTERNATE app</p>
          {app.ios ? <IosSteps /> : <p className="text-[13px] text-muted">Opens full screen from your home screen.</p>}
        </div>
        {app.canPrompt && <Button size="sm" onClick={() => app.install().then((ok) => ok && dismiss())}>Install</Button>}
        <button onClick={dismiss} className="grid h-9 w-9 shrink-0 place-items-center hover:bg-sunk" aria-label="Not now">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
