import { describe, expect, it } from "vitest";
import { checkEnv, securityDatabaseUrls } from "./config";

describe("securityDatabaseUrls", () => {
  it("uses a separate database on the local server", () => {
    expect(
      securityDatabaseUrls("postgres://tbe:tbe@localhost:5432/tbe"),
    ).toEqual({
      url: "postgres://tbe:tbe@localhost:5432/tbe_security",
      adminUrl: "postgres://tbe:tbe@localhost:5432/postgres",
    });
    expect(securityDatabaseUrls("postgresql://u:p@127.0.0.1/tbe").url).toBe(
      "postgresql://u:p@127.0.0.1/tbe_security",
    );
  });

  it("refuses anything but a local database", () => {
    expect(() =>
      securityDatabaseUrls("postgres://tbe:secret@db.example.com:5432/tbe"),
    ).toThrow(/local database/);
    expect(() =>
      securityDatabaseUrls("postgres://tbe@localhost.example.com/tbe"),
    ).toThrow(/local database/);
    expect(() => securityDatabaseUrls("mysql://localhost/tbe")).toThrow();
    expect(() => securityDatabaseUrls(undefined)).toThrow();
  });

  it("never points the check at the development database itself", () => {
    expect(() =>
      securityDatabaseUrls("postgres://tbe:tbe@localhost:5432/tbe_security"),
    ).toThrow();
  });
});

describe("checkEnv", () => {
  it("switches SMTP off and requests development sign-in", () => {
    const env = checkEnv(
      {
        SMTP_HOST: "smtp.example.com",
        SMTP_PASSWORD: "x",
        NODE_ENV: "development",
      },
      "postgres://localhost/tbe_security",
    );
    expect(env.SMTP_HOST).toBe("");
    expect(env.SMTP_PASSWORD).toBe("");
    expect(env.DEV_LOGIN).toBe("true");
    expect(env.NODE_ENV).toBeUndefined();
    expect(env.DATABASE_URL).toBe("postgres://localhost/tbe_security");
  });
});
