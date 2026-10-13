"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Submit button that asks for confirmation first (for archive, deactivate…). */
export function ConfirmButton({
  confirm,
  children,
  ...props
}: ComponentProps<typeof Button> & { confirm: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirm)) event.preventDefault();
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
