// Settings of `pnpm security:check`: a separate local database and a production server on its own
// port, so the check never touches the development data, production or other services.

export const PORT = 3100;
export const BASE_URL = `http://localhost:${PORT}`;
/** Created, migrated and seeded for every run; dropped at the end. */
export const DB_NAME = "tbe_security";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The check database next to the development database (same local server and user). Throws unless
 * DATABASE_URL points to a local PostgreSQL, so the check can never run against a remote database.
 */
export function securityDatabaseUrls(devUrl: string | undefined): {
  url: string;
  adminUrl: string;
} {
  if (!devUrl) throw new Error("DATABASE_URL is not set (see .env.example)");
  const url = new URL(devUrl);
  if (!/^postgres(ql)?:$/.test(url.protocol))
    throw new Error("DATABASE_URL must be a postgres:// URL");
  if (!LOCAL_HOSTS.has(url.hostname))
    throw new Error(
      `security:check runs only against a local database, DATABASE_URL points to ${url.hostname}`,
    );
  if (url.pathname === `/${DB_NAME}`)
    throw new Error(
      `DATABASE_URL already points to ${DB_NAME}; use the development database`,
    );
  const check = new URL(url);
  check.pathname = `/${DB_NAME}`;
  const admin = new URL(url);
  admin.pathname = "/postgres";
  return { url: check.toString(), adminUrl: admin.toString() };
}

/**
 * Environment of the build, the server and this script: the check database, this server's URL,
 * development sign-in requested (a production build must ignore it) and no SMTP, so no e-mail
 * leaves the machine (sendMail only logs).
 */
export function checkEnv(
  base: NodeJS.ProcessEnv,
  databaseUrl: string,
): NodeJS.ProcessEnv {
  // next build / next start set NODE_ENV=production themselves.
  const inherited = Object.fromEntries(
    Object.entries(base).filter(([key]) => key !== "NODE_ENV"),
  );
  return {
    ...inherited,
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_URL: BASE_URL,
    PORT: String(PORT),
    DEV_LOGIN: "true",
    SMTP_HOST: "",
    SMTP_USER: "",
    SMTP_PASSWORD: "",
    // Next.js types NODE_ENV as always set; here it is left out on purpose.
  } as unknown as NodeJS.ProcessEnv;
}
