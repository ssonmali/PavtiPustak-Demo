"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Compass, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDemoFlag } from "./use-demo-flag";
import { useI18n } from "@/lib/i18n/client";
import { formatNumberMarathi } from "@/lib/receipt-utils";
import type { MessageKey } from "@/lib/i18n/dictionaries";

type Step = {
  title: MessageKey;
  body: MessageKey;
  /** Where the step is about. The tour offers to go there. */
  href?: string;
};

/**
 * The tour, in the order the app is worth seeing in: what it is, the money, how
 * a receipt is written, what happens to it, and what the treasurer takes away.
 */
const STEPS: Step[] = [
  { title: "demo.tourWelcomeTitle", body: "demo.tourWelcomeBody" },
  {
    title: "demo.tourOverviewTitle",
    body: "demo.tourOverviewBody",
    href: "/dashboard",
  },
  {
    title: "demo.tourPledgeTitle",
    body: "demo.tourPledgeBody",
    href: "/dashboard",
  },
  {
    title: "demo.tourReceiptsTitle",
    body: "demo.tourReceiptsBody",
    href: "/dashboard/receipts",
  },
  {
    title: "demo.tourWhatsappTitle",
    body: "demo.tourWhatsappBody",
    href: "/dashboard/receipts",
  },
  {
    title: "demo.tourExpensesTitle",
    body: "demo.tourExpensesBody",
    href: "/dashboard/expenses",
  },
  {
    title: "demo.tourActivityTitle",
    body: "demo.tourActivityBody",
    href: "/dashboard/activity",
  },
  {
    title: "demo.tourReportTitle",
    body: "demo.tourReportBody",
    href: "/dashboard/report",
  },
  { title: "demo.tourEndTitle", body: "demo.tourEndBody" },
];

const SEEN_KEY = "pp-demo-tour-seen";

/**
 * A guided walk through the demo.
 *
 * Deliberately not a spotlight overlay pinned to elements: this app is used on
 * a phone, where a cut-out over a 44px button covers the thing it is pointing
 * at, and the layout it would anchor to changes between the ledger and the
 * report. A card at the bottom that names the page and says what to try leaves
 * the whole screen usable while it is open — a visitor can follow the step and
 * tap the button it is describing without dismissing anything.
 */
export function DemoTour() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  // Marathi renders its own numerals everywhere else in the app; a Latin "4 / 9"
  // in the middle of a Marathi sentence is the sort of seam a demo shows off.
  const num = (n: number) => (locale === "mr" ? formatNumberMarathi(n) : String(n));
  const [index, setIndex] = React.useState(0);
  const [seen, markSeen] = useDemoFlag(SEEN_KEY);
  /** Null until the visitor opens or closes it themselves. */
  const [chosen, setChosen] = React.useState<boolean | null>(null);

  // Opens itself once per browser, and never again — someone who has been
  // shown around and comes back to try something does not want it a second
  // time. `seen === undefined` is the server render, where nothing shows.
  const open = chosen ?? seen === null;

  const close = () => {
    markSeen();
    setChosen(false);
  };

  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  // Only worth offering when it would actually move: on the page already, the
  // "Next" button is the only thing that should be competing for the tap.
  const elsewhere = step.href && step.href !== pathname ? step.href : null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setIndex(0);
          setChosen(true);
        }}
        className="fixed right-3 bottom-16 z-30 flex h-11 items-center gap-2 rounded-full border bg-background/95 px-4 text-sm font-medium shadow-lg backdrop-blur-md transition hover:bg-accent md:bottom-4 print:hidden"
      >
        <Compass className="size-4 text-primary" />
        {t("demo.guideOpen")}
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label={t("demo.guideTitle")}
      className="fixed inset-x-3 bottom-16 z-30 mx-auto max-w-md rounded-2xl border bg-background/97 p-4 shadow-2xl backdrop-blur-md md:bottom-4 print:hidden"
    >
      <div className="flex items-start gap-2">
        <Compass className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            {t("demo.guideStep", {
              n: num(index + 1),
              total: num(STEPS.length),
            })}
          </p>
          <h2 className="mt-0.5 font-display text-base leading-tight font-semibold">
            {t(step.title)}
          </h2>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t("demo.guideClose")}
          className="-mt-1 -mr-1 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {t(step.body)}
      </p>

      <div className="mt-3 flex items-center gap-2">
        {index > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIndex((i) => i - 1)}
          >
            {t("demo.guideBack")}
          </Button>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {elsewhere ? (
            <Link
              href={elsewhere}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {t("demo.guideGo")}
            </Link>
          ) : null}

          {last ? (
            <Button type="button" size="sm" onClick={close}>
              {t("demo.guideDone")}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => setIndex((i) => i + 1)}
            >
              {t("demo.guideNext")} <ArrowRight />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
