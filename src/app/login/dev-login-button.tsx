"use client";

import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function DevLoginButton({
  name,
  detail,
}: {
  name: string;
  detail: string;
}) {
  const t = useTranslations("login.dev");
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
      aria-label={t("signInAs", { name })}
      className="h-auto min-h-11 w-full flex-col items-start gap-0 py-2 text-left whitespace-normal"
    >
      <span>{name}</span>
      <span className="text-sm font-normal text-muted-foreground">
        {pending ? t("signingIn") : detail}
      </span>
    </Button>
  );
}
