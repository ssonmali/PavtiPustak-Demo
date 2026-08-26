"use client";

import { Info, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useDemoFlag } from "./use-demo-flag";

const DISMISSED_KEY = "pp-demo-banner-dismissed";

/**
 * Says once, plainly, that none of this is real.
 *
 * It matters more than it looks: the ledger is convincing enough that a visitor
 * could reasonably wonder whose money they are looking at, and whether their
 * clicking around breaks something for someone else.
 */
export function DemoBanner() {
  const { t } = useI18n();
  const [dismissed, dismiss] = useDemoFlag(DISMISSED_KEY);

  // Nothing on the server, and nothing once dismissed. The banner appearing a
  // beat after hydration is the price of not flashing it at someone who has
  // already read it.
  if (dismissed !== null) return null;

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pt-3 sm:px-4 print:hidden">
      <div className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm leading-relaxed">
          <span className="font-medium">{t("demo.bannerTitle")}</span>{" "}
          <span className="text-muted-foreground">{t("demo.bannerBody")}</span>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("demo.guideClose")}
          className="-mt-0.5 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
