// Starts the dev server for phones on the same Wi-Fi and prints the address to open there.
// Usage: pnpm dev:lan (port from PORT, default 3000). See CLAUDE.md, "Phone in the home network".
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { isDevLoginEnabled } from "@/lib/dev-login";
import { lanAddresses, lanOrigins } from "@/lib/lan";

const port = process.env.PORT ?? "3000";
const origins = lanOrigins(lanAddresses(networkInterfaces()), port);

if (origins.length === 0) {
  console.warn("No network address found; is the Mac connected to Wi-Fi?");
} else {
  console.log("\nOpen on the phone (same Wi-Fi):");
  for (const origin of origins) console.log(`  ${origin}`);
  console.log();
}
if (
  !isDevLoginEnabled({
    NODE_ENV: "development",
    DEV_LOGIN: process.env.DEV_LOGIN,
  })
)
  console.warn(
    'DEV_LOGIN=true is not set in .env: the phone cannot sign in ("Přihlásit jako…" is hidden; Google works only on localhost).\n',
  );

const child = spawn(
  "pnpm",
  ["exec", "next", "dev", "--hostname", "0.0.0.0", "--port", port],
  { stdio: "inherit" },
);
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
