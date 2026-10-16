/**
 * Development sign-in ("Přihlásit jako…") is available only in `next dev` with DEV_LOGIN=true.
 * A production build inlines NODE_ENV=production, so no env value can turn it on there.
 */
export function isDevLoginEnabled(env: {
  NODE_ENV?: string;
  DEV_LOGIN?: string;
}): boolean {
  return env.NODE_ENV === "development" && env.DEV_LOGIN === "true";
}

/**
 * isDevLoginEnabled for this process. Reads `process.env.NODE_ENV` literally so that the build
 * replaces it with "production" and the check is false in a production build even when NODE_ENV
 * is overridden at runtime.
 */
export function devLoginEnabled(): boolean {
  return isDevLoginEnabled({
    NODE_ENV: process.env.NODE_ENV,
    DEV_LOGIN: process.env.DEV_LOGIN,
  });
}
