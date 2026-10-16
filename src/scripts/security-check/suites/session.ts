import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import type { BetterAuthOptions } from "better-auth";
import { getCookies } from "better-auth/cookies";
import { and, eq, like } from "drizzle-orm";
import cs from "../../../../messages/cs.json";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { lanAddresses } from "@/lib/lan";
import { session, team, user } from "@/modules/core/schema";
import { BASE_URL, PORT } from "../config";
import { allowed, denied, rows, type Ctx } from "../context";
import { newSession } from "../fixtures";
import { Client, form, sessionCookie, type PageResponse } from "../http";
import { assert } from "../report";

// Development sign-in in the production build, and sessions: sign-out, archived / deactivated
// employees, removed roles, changed e-mails, cookies and foreign origins.

const PREV = {};
const EVIL = "https://evil.example";

const toLogin = (res: PageResponse) =>
  res.redirect?.startsWith("/login") ||
  res.redirect?.startsWith(`${BASE_URL}/login`);
const notAllowed = (res: PageResponse) =>
  !!res.redirect?.includes("error=account_not_allowed");

const sessionsOf = (userId: string) => () =>
  rows(session, eq(session.userId, userId));

export async function devLoginSuite(ctx: Ctx) {
  const { report, fx } = ctx;
  report.section("Vývojové přihlášení v produkčním buildu (DEV_LOGIN=true)");
  report.cover("/api/auth/[...all]/route");

  await report.check("/login has no „Přihlásit jako…“", async () => {
    const res = await ctx.as("anon").get("/login");
    assert(res.status === 200, `status ${res.status}`);
    // The texts themselves travel with the client messages; the rendered section has the form.
    assert(
      !res.body.includes(`>${cs.login.dev.title}<`) &&
        !res.body.includes('name="employeeId"'),
      "the section is rendered",
    );
    assert(!res.body.includes("Secchk"), "employees are listed");
  });
  await denied(
    ctx,
    "devSignInAction answers 404 and creates no session",
    () =>
      ctx.call("anon", "dev", "devSignInAction", [
        form({ employeeId: fx.ids.ad }),
      ]),
    sessionsOf(fx.userIds.ad),
    (res) => {
      assert(res.kind === "notFound", `got ${res.kind}`);
      assert(
        !(res.headers.get("set-cookie") ?? "").includes("session_token"),
        "a session cookie was set",
      );
    },
  );
  await report.check("the dev-login endpoint has no HTTP route", async () => {
    for (const path of ["/api/auth/dev-sign-in", "/api/auth/devSignIn"]) {
      const res = await ctx.as("anon").request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: BASE_URL },
        body: JSON.stringify({ email: "secchk-ad@example.invalid", name: "x" }),
      });
      assert(res.status === 404, `${path}: status ${res.status}`);
      assert(
        !(res.headers.get("set-cookie") ?? "").includes("session_token"),
        `${path}: cookie`,
      );
    }
  });
  await report.check(
    "DEV_LOGIN is not switched on in committed configuration",
    async () => {
      const example = readFileSync(".env.example", "utf8");
      assert(
        !/^\s*DEV_LOGIN\s*=/m.test(example),
        ".env.example sets DEV_LOGIN",
      );
      const compose = readFileSync("docker-compose.yml", "utf8");
      assert(
        !compose.includes("DEV_LOGIN"),
        "docker-compose.yml mentions DEV_LOGIN",
      );
    },
  );
}

export async function sessionSuite(ctx: Ctx) {
  const { report, fx, secret } = ctx;
  const { ids, userIds } = fx;
  report.section(
    "Session: odhlášení, archivace, role, e-mail, cookies, origin",
  );

  // ── Sign-out ends the session on the server ──
  await report.check(
    "signOut deletes the session; the old cookie is useless",
    async () => {
      const cookie = await newSession(userIds.ea, secret);
      const client = new Client("ea-signout", cookie);
      assert(
        !toLogin(await client.get("/timesheets")),
        "session does not work before sign-out",
      );
      const ref = ctx.actions.get("src/lib/auth-actions.ts#signOut")!;
      ctx.report.cover(ref.key);
      const token = decodeURIComponent(cookie.split("=")[1]).split(".")[0];
      const res = await client.action(ref, []);
      assert(
        res.location === "/login",
        `signOut redirected to ${res.location}`,
      );
      const setCookie = res.headers.get("set-cookie") ?? "";
      assert(
        /session_token=;|Max-Age=0/.test(setCookie),
        "the cookie is not cleared",
      );
      const [left] = await db
        .select()
        .from(session)
        .where(eq(session.token, token));
      assert(!left, "the session row still exists");
      assert(
        toLogin(await client.get("/timesheets")),
        "the old cookie still opens pages",
      );
    },
  );
  await report.check("/api/auth/sign-out deletes the session", async () => {
    const cookie = await newSession(userIds.ea, secret);
    const token = decodeURIComponent(cookie.split("=")[1]).split(".")[0];
    const res = await new Client("ea-api", cookie).request(
      "/api/auth/sign-out",
      {
        method: "POST",
        headers: { Origin: BASE_URL, "Content-Type": "application/json" },
        body: "{}",
      },
    );
    assert(res.status === 200, `status ${res.status}`);
    const [left] = await db
      .select()
      .from(session)
      .where(eq(session.token, token));
    assert(!left, "the session row still exists");
  });

  // ── Sessions of people who may no longer sign in ──
  await report.check(
    "archived employee: the running session stops at once",
    async () => {
      const client = ctx.as("ar");
      assert(
        !toLogin(await client.get("/timesheets")),
        "ar cannot open Docházka before",
      );
      const res = await ctx.call("mg", "core", "setEmployeeStateAction", [
        ids.ar,
        "archive",
      ]);
      assert(res.kind === "ok", `archiving failed: ${res.kind}`);
      const page = await client.get("/timesheets");
      assert(notAllowed(page), `page: ${page.status} ${page.redirect}`);
    },
  );
  await denied(
    ctx,
    "archived employee: actions refused",
    () =>
      ctx.call("ar", "timeline", "timelineAction", [
        {
          employeeId: ids.ar,
          date: fx.days[3],
          reason: null,
          command: {
            type: "create",
            start: 480,
            end: 540,
            kind: "work",
            jobId: fx.jobs.j1,
            workTypeId: fx.workTypes.job,
          },
        },
      ]),
    async () => null,
    (res) =>
      assert(
        res.location?.includes("/login"),
        `got ${res.kind} ${res.location}`,
      ),
  );
  await report.check("deactivated employee: the session stops", async () => {
    // de was deactivated by the manager in the action checks.
    assert(
      notAllowed(await ctx.as("de").get("/timesheets")),
      "de still signed in",
    );
  });
  await report.check(
    "changed e-mail: the old account loses access",
    async () => {
      const client = ctx.as("ec");
      assert(
        !toLogin(await client.get("/timesheets")),
        "ec cannot open Docházka before",
      );
      const res = await ctx.call("ad", "core", "updateEmployeeAction", [
        ids.ec,
        PREV,
        form({
          personalNumber: "S-ec",
          firstName: "Secchk2",
          lastName: "SecchkEc",
          email: "secchk-ec-new@example.invalid",
          tracksTime: true,
        }),
      ]);
      assert(res.kind === "ok", `update failed: ${res.kind}`);
      assert(
        notAllowed(await client.get("/timesheets")),
        "ec's old account still works",
      );
    },
  );
  await report.check(
    "account without an employee and expired session",
    async () => {
      const [stranger] = await db
        .insert(user)
        .values({
          name: "Stranger",
          email: "stranger@example.invalid",
          emailVerified: true,
        })
        .returning();
      const strangerClient = new Client(
        "stranger",
        await newSession(stranger.id, secret),
      );
      assert(
        notAllowed(await strangerClient.get("/timesheets")),
        "a stranger got in",
      );
      const token = randomBytes(24).toString("base64url");
      await db.insert(session).values({
        token,
        userId: userIds.mg,
        expiresAt: new Date(Date.now() - 60_000),
      });
      const expired = new Client("expired", sessionCookie(token, secret));
      assert(
        toLogin(await expired.get("/timesheets")),
        "an expired session works",
      );
      const wrongSecret = new Client(
        "wrong-secret",
        sessionCookie(token, "a-different-secret-of-at-least-32-chars"),
      );
      assert(
        toLogin(await wrongSecret.get("/timesheets")),
        "a cookie signed with another secret works",
      );
    },
  );

  // ── Removed roles take effect on the next request ──
  await report.check(
    "removed manager role: Uzávěrka is gone at once",
    async () => {
      const client = ctx.as("rm");
      assert(
        !(await client.get("/timesheets/close")).notFound,
        "rm cannot open Uzávěrka before",
      );
      const res = await ctx.call("ad", "core", "setRolesAction", [
        ids.rm,
        PREV,
        form({}),
      ]);
      assert(res.kind === "ok", `removing the role failed: ${res.kind}`);
      assert(
        (await client.get("/timesheets/close")).notFound,
        "rm still opens Uzávěrka",
      );
    },
  );
  await denied(
    ctx,
    "removed manager role: closing actions refused",
    () => ctx.call("rm", "ts", "remindMissingAction", [fx.p1, PREV, form({})]),
    async () => null,
    (res) => assert(res.kind === "notFound", `got ${res.kind}`),
  );
  await report.check("lead replaced: Schvalování is gone at once", async () => {
    const client = ctx.as("lb");
    assert(
      !(await client.get("/timesheets/approval")).notFound,
      "lb cannot open it before",
    );
    const res = await ctx.call("mg", "core", "updateTeamAction", [
      fx.teams.b,
      PREV,
      form({ name: "Secchk B" }),
    ]);
    assert(res.kind === "ok", `changing the lead failed: ${res.kind}`);
    const [b] = await db.select().from(team).where(eq(team.id, fx.teams.b));
    assert(b.leadEmployeeId === null, "the lead was not removed");
    assert(
      (await client.get("/timesheets/approval")).notFound,
      "lb still opens Schvalování",
    );
  });

  // ── Cookies ──
  await report.check("auth cookies are HttpOnly and SameSite=Lax", async () => {
    const res = await ctx.as("anon").request("/api/auth/sign-in/social", {
      method: "POST",
      headers: { Origin: BASE_URL, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "google", callbackURL: "/" }),
    });
    assert(res.status === 200, `status ${res.status}`);
    const cookies = res.headers.getSetCookie();
    assert(cookies.length > 0, "no cookie set");
    for (const c of cookies) {
      assert(
        /;\s*HttpOnly/i.test(c),
        `not HttpOnly: ${c.split(";")[0].split("=")[0]}`,
      );
      assert(
        /;\s*SameSite=Lax/i.test(c),
        `not SameSite=Lax: ${c.split(";")[0].split("=")[0]}`,
      );
    }
    const ctxAuth = await auth.$context;
    const token = ctxAuth.authCookies.sessionToken;
    assert(
      token.attributes.httpOnly && token.attributes.sameSite === "lax",
      "session cookie",
    );
  });
  await report.check(
    "with an https BETTER_AUTH_URL (production) cookies are Secure",
    async () => {
      const cookies = getCookies({
        ...auth.options,
        baseURL: "https://dochazka.example.cz",
      });
      for (const c of [cookies.sessionToken, cookies.sessionData]) {
        assert(
          c.name.startsWith("__Secure-"),
          `${c.name} has no __Secure- prefix`,
        );
        assert(
          c.attributes.secure && c.attributes.httpOnly,
          `${c.name} not Secure/HttpOnly`,
        );
        assert(c.attributes.sameSite === "lax", `${c.name} not SameSite=Lax`);
      }
      assert(
        !(auth.options as BetterAuthOptions).session?.cookieCache?.enabled,
        "session cookie cache is on",
      );
    },
  );

  // ── Foreign origins ──
  const lan = lanAddresses(networkInterfaces()).map(
    (ip) => `http://${ip}:${PORT}`,
  );
  const foreign = [EVIL, ...lan.slice(0, 1)];
  const teams = () => rows(team, like(team.name, "Secchk%"));
  for (const origin of foreign) {
    await denied(
      ctx,
      `server action from origin ${origin}`,
      () =>
        ctx.call(
          "mg",
          "core",
          "createTeamAction",
          [PREV, form({ name: "Secchk origin" })],
          {
            origin,
          },
        ),
      teams,
    );
    await report.check(`Better Auth refuses origin ${origin}`, async () => {
      const cookie = await newSession(userIds.mg, secret);
      const token = decodeURIComponent(cookie.split("=")[1]).split(".")[0];
      const res = await new Client("mg-origin", cookie).request(
        "/api/auth/sign-out",
        {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body: "{}",
        },
      );
      assert(res.status === 403, `status ${res.status}`);
      const [left] = await db
        .select()
        .from(session)
        .where(and(eq(session.token, token), eq(session.userId, userIds.mg)));
      assert(left, "the session was deleted from a foreign origin");
    });
  }
  await allowed(
    ctx,
    "server action from the app's own origin (control)",
    () =>
      ctx.call("mg", "core", "createTeamAction", [
        PREV,
        form({ name: "Secchk origin" }),
      ]),
    teams,
  );
}
