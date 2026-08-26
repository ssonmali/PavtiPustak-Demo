"use client";

import * as React from "react";
import { LogIn, Sparkles } from "lucide-react";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo/config";
import { Button } from "@/components/ui/button";
import { I18nProvider, useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/dictionaries";

/**
 * The demo's front door.
 *
 * A visitor who has to guess a password never sees the app, so the account is
 * on the screen — and one tap fills the form and submits it, because the login
 * screen is a thing to look at once, not an obstacle.
 */
export function DemoCredentials({ locale }: { locale: Locale }) {
  return (
    <I18nProvider locale={locale}>
      <Panel />
    </I18nProvider>
  );
}

function Panel() {
  const { t } = useI18n();

  const fillAndSubmit = () => {
    const form = document.querySelector<HTMLFormElement>("form");
    const email = form?.querySelector<HTMLInputElement>("#email");
    const password = form?.querySelector<HTMLInputElement>("#password");
    if (!form || !email || !password) return;

    // Set through the native setter so React sees the change: assigning
    // `.value` on a controlled-adjacent input does not fire its listeners.
    setNative(email, DEMO_EMAIL);
    setNative(password, DEMO_PASSWORD);
    form.requestSubmit();
  };

  return (
    <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-primary" />
        {t("demo.loginTitle")}
      </p>

      <p className="mt-1.5 text-sm text-muted-foreground">
        {t("demo.loginBody")}
      </p>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("auth.email")}</dt>
        {/* break-all: the address is long and must not push the card wide on a phone. */}
        <dd className="font-mono break-all select-all">{DEMO_EMAIL}</dd>
        <dt className="text-muted-foreground">{t("auth.password")}</dt>
        <dd className="font-mono select-all">{DEMO_PASSWORD}</dd>
      </dl>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={fillAndSubmit}
        className="mt-3 w-full"
      >
        <LogIn /> {t("demo.loginFill")}
      </Button>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        {t("demo.loginAny")}
      </p>
    </div>
  );
}

function setNative(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
