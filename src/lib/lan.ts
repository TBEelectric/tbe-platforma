// Addresses of this computer in the local network, for opening the dev server from a phone on the
// same Wi-Fi (pnpm dev:lan). Pure functions; callers pass os.networkInterfaces().

type NetworkInterfaces = Record<
  string,
  | Array<{ address: string; family: string | number; internal: boolean }>
  | undefined
>;

/** IPv4 addresses reachable from other devices (no loopback, no link-local 169.254.x.x). */
export function lanAddresses(interfaces: NetworkInterfaces): string[] {
  const addresses = Object.values(interfaces)
    .flatMap((list) => list ?? [])
    .filter(
      (i) =>
        (i.family === "IPv4" || i.family === 4) &&
        !i.internal &&
        !i.address.startsWith("169.254."),
    )
    .map((i) => i.address);
  return [...new Set(addresses)];
}

/** Browser origins of the dev server on those addresses, e.g. http://192.168.0.10:3000. */
export function lanOrigins(addresses: string[], port: string): string[] {
  return addresses.map((address) => `http://${address}:${port}`);
}
