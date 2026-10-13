import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { z } from "zod";
import { parseAllowedEmails, signInRejection } from "@/lib/allowed-emails";
import { db } from "@/lib/db";
import * as coreSchema from "@/modules/core/schema";

const authEnv = z
  .object({
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET must have at least 32 characters"),
    BETTER_AUTH_URL: z.url(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    AUTH_ALLOWED_EMAILS: z.string().default(""),
  })
  .parse(process.env);

/** Temporary allow-list; replaced by active employees in milestone 2. */
export const allowedEmails = parseAllowedEmails(authEnv.AUTH_ALLOWED_EMAILS);

export const auth = betterAuth({
  appName: "TBE platforma",
  secret: authEnv.BETTER_AUTH_SECRET,
  baseURL: authEnv.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: coreSchema.user,
      session: coreSchema.session,
      account: coreSchema.account,
      verification: coreSchema.verification,
    },
  }),
  advanced: { database: { generateId: "uuid" } },
  // Google only; no e-mail/password sign-in.
  socialProviders: {
    google: {
      clientId: authEnv.GOOGLE_CLIENT_ID,
      clientSecret: authEnv.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    },
  },
  user: {
    // Runs when a user is created and on every Google sign-in (with the fresh Google e-mail).
    validateUserInfo: ({ user }) => {
      const error = signInRejection(allowedEmails, user);
      if (error) return { error };
    },
  },
  plugins: [nextCookies()],
});
