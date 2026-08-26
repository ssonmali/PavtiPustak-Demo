import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/server";
import { LanguageToggle } from "@/components/language-toggle";
import { LoginForm } from "./login-form";
import { DemoCredentials } from "@/components/demo/demo-credentials";
import { MotionProvider } from "@/components/motion/motion-provider";
import { Reveal } from "@/components/motion/reveal";

export const metadata = { title: "Login · SGMM Pustak" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const { locale, t } = await getDictionary();

  return (
    <main className="app-surface flex flex-1 items-center justify-center p-4">
      <MotionProvider>
        <div className="w-full max-w-sm">
          <Reveal
            className="mb-6 flex flex-col items-center gap-2 text-center"
            y={22}
          >
            <Image
              src="/idol.jpg"
              alt=""
              width={56}
              height={56}
              className="size-14 rounded-2xl object-cover"
              priority
            />
            <h1 className="font-display text-2xl tracking-tight">
              {process.env.NEXT_PUBLIC_MANDAL_NAME ??
                "Shri Ganesh Mitra Mandal"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("auth.bookName")}
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <Card className="card-elevated accent-top">
              <CardHeader>
                <CardTitle>{t("auth.signIn")}</CardTitle>
                <CardDescription>{t("auth.subtitle")}</CardDescription>
              </CardHeader>
              <CardContent>
                <LoginForm
                  next={typeof next === "string" ? next : undefined}
                  locale={locale}
                />
              </CardContent>
            </Card>
          </Reveal>

          <Reveal delay={0.22}>
            <DemoCredentials locale={locale} />
          </Reveal>

          <Reveal delay={0.32} className="mt-4 flex justify-center">
            <LanguageToggle locale={locale} />
          </Reveal>
        </div>
      </MotionProvider>
    </main>
  );
}
