import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { devLoginEnabled } from "@/lib/dev-login";

/**
 * Development sign-in: a server-only endpoint (auth.api.devSignIn, no HTTP route) that creates a
 * normal Better Auth session for an e-mail, as a Google sign-in would. Creates the user on first use.
 * The caller (devSignInAction) checks that the e-mail belongs to an active employee.
 */
export const devLogin = () =>
  ({
    id: "dev-login",
    endpoints: {
      devSignIn: createAuthEndpoint.serverOnly(
        {
          method: "POST",
          body: z.object({ email: z.email(), name: z.string().min(1) }),
        },
        async (ctx) => {
          if (!devLoginEnabled()) throw new APIError("NOT_FOUND");
          const { email, name } = ctx.body;
          const adapter = ctx.context.internalAdapter;
          const user =
            (await adapter.findUserByEmail(email))?.user ??
            // Runs validateUserInfo like a Google sign-in (only an active employee passes).
            (await adapter.createUser(
              { email, name, emailVerified: true },
              { method: "dev-login" },
            ));
          const session = await adapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ userId: user.id, sessionId: session.id });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
