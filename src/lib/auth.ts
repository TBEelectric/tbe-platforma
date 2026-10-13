import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { z } from "zod";
import { db } from "@/lib/db";
import { findEmployeeByEmail, signInRejection } from "@/modules/core";
import * as coreSchema from "@/modules/core/schema";

const authEnv = z
  .object({
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET must have at least 32 characters"),
    BETTER_AUTH_URL: z.url(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
  })
  .parse(process.env);

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
    additionalFields: {
      // Set by requireUser (by e-mail), never by the client.
      employeeId: { type: "string", required: false, input: false },
    },
    // Runs when a user is created and on every Google sign-in (with the fresh Google e-mail):
    // only an active employee with this e-mail may sign in.
    validateUserInfo: async ({ user }) => {
      const employee = user.email
        ? await findEmployeeByEmail(db, user.email)
        : null;
      const error = signInRejection(user, employee);
      if (error) return { error };
    },
  },
  plugins: [nextCookies()],
});
