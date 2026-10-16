"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

/** Team picker of Schvalování: choosing a team opens the same month for it. */
export function TeamSelect({
  label,
  value,
  options,
}: {
  label: string;
  value: string;
  /** href per option, "all" first. */
  options: Array<{ value: string; label: string; href: string }>;
}) {
  const router = useRouter();
  return (
    <NativeSelect
      aria-label={label}
      value={value}
      className="w-auto min-w-44"
      onChange={(event) => {
        const option = options.find((o) => o.value === event.target.value);
        if (option) router.push(option.href);
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}
