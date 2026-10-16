import { describe, expect, it } from "vitest";
import { lanAddresses, lanOrigins } from "./lan";

describe("lanAddresses", () => {
  it("keeps external IPv4 addresses only, without duplicates", () => {
    expect(
      lanAddresses({
        lo0: [
          { address: "127.0.0.1", family: "IPv4", internal: true },
          { address: "::1", family: "IPv6", internal: true },
        ],
        en0: [
          { address: "fe80::1c2b:3a4d", family: "IPv6", internal: false },
          { address: "192.168.0.189", family: "IPv4", internal: false },
        ],
        en1: [{ address: "10.0.0.5", family: 4, internal: false }],
        bridge0: [{ address: "169.254.10.2", family: "IPv4", internal: false }],
        vpn: [{ address: "192.168.0.189", family: "IPv4", internal: false }],
        utun0: undefined,
      }),
    ).toEqual(["192.168.0.189", "10.0.0.5"]);
  });

  it("is empty without a network", () => {
    expect(
      lanAddresses({
        lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
      }),
    ).toEqual([]);
  });
});

describe("lanOrigins", () => {
  it("builds http origins with the dev server port", () => {
    expect(lanOrigins(["192.168.0.189", "10.0.0.5"], "3000")).toEqual([
      "http://192.168.0.189:3000",
      "http://10.0.0.5:3000",
    ]);
  });
});
