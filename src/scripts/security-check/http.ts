import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { BASE_URL } from "./config";

// HTTP client of the check: pages, route handlers and server actions are requested exactly as a
// browser (or an attacker with a valid session) would, against the production server.

/** What Next.js renders for notFound() (also inside a streamed page that already sent 200). */
export const NOT_FOUND_MARK = "NEXT_HTTP_ERROR_FALLBACK;404";
export const SESSION_COOKIE = "better-auth.session_token";

/** Better Auth session cookie value: the token signed with BETTER_AUTH_SECRET (HMAC-SHA256). */
export function sessionCookie(token: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return `${SESSION_COOKIE}=${encodeURIComponent(`${token}.${signature}`)}`;
}

// ── Server actions ──

type ManifestEntry = {
  filename: string;
  exportedName: string;
  workers: Record<string, unknown>;
};

export type ActionRef = {
  id: string;
  /** "src/modules/core/actions.ts#createJobAction" */
  key: string;
  /** A page that includes the action (POST target, as the browser does). */
  path: string;
};

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

/** "app/(app)/employees/[id]/page" → "/employees/<uuid>" */
export function workerPath(worker: string): string {
  const segments = worker
    .replace(/^app/, "")
    .replace(/\/(page|route)$/, "")
    .split("/")
    .filter((s) => s && !/^\(.*\)$/.test(s))
    .map((s) => (/^\[.*\]$/.test(s) ? ZERO_UUID : s));
  return `/${segments.join("/")}`;
}

/** All server actions of the build (.next/server/server-reference-manifest.json). */
export function loadActions(): Map<string, ActionRef> {
  const manifest = JSON.parse(
    readFileSync(".next/server/server-reference-manifest.json", "utf8"),
  ) as { node: Record<string, ManifestEntry> };
  const actions = new Map<string, ActionRef>();
  for (const [id, entry] of Object.entries(manifest.node)) {
    const workers = Object.keys(entry.workers);
    const worker = workers.find((w) => !w.includes("[")) ?? workers[0];
    const key = `${entry.filename}#${entry.exportedName}`;
    actions.set(key, { id, key, path: workerPath(worker) });
  }
  return actions;
}

/** Pages and route handlers of the build (.next/server/app-paths-manifest.json). */
export function loadRoutes(): string[] {
  const manifest = JSON.parse(
    readFileSync(".next/server/app-paths-manifest.json", "utf8"),
  ) as Record<string, string>;
  return Object.keys(manifest)
    .filter((k) => /\/(page|route)$/.test(k) && !k.startsWith("/_"))
    .map((k) => k.replace(/\/\([^)]*\)/g, ""))
    .sort();
}

// React's encoder for server action arguments, the same one the browser bundle uses.
const load = createRequire(import.meta.url);
const { encodeReply } = load(
  "next/dist/compiled/react-server-dom-turbopack/client.node.js",
) as { encodeReply: (value: unknown) => Promise<string | FormData> };

export type ActionResponse = {
  status: number;
  kind: "ok" | "notFound" | "redirect" | "error";
  /** Target of a redirect (e.g. "/login"). */
  location: string | null;
  /** Returned value (JSON) for kind "ok". */
  value: unknown;
  body: string;
  headers: Headers;
};

/** Parses the RSC answer of an action: row 0 points to the row with the result ("$@1"). */
export function parseActionResponse(
  status: number,
  redirectHeader: string | null,
  body: string,
  headers: Headers = new Headers(),
): ActionResponse {
  const base = { status, location: null, value: undefined, body, headers };
  if (redirectHeader)
    return {
      ...base,
      kind: "redirect",
      location: redirectHeader.split(";")[0],
    };
  const rows = new Map<string, string>();
  for (const line of body.split("\n")) {
    const match = /^([0-9a-f]+):(.*)$/.exec(line);
    if (match) rows.set(match[1], match[2]);
  }
  let ref: string | undefined;
  try {
    const head = JSON.parse(rows.get("0") ?? "null") as { a?: string } | null;
    ref = head?.a?.replace(/^\$@/, "");
  } catch {
    ref = undefined;
  }
  const row = ref !== undefined ? rows.get(ref) : undefined;
  if (row?.startsWith("E")) {
    if (row.includes(NOT_FOUND_MARK)) return { ...base, kind: "notFound" };
    const redirect = /NEXT_REDIRECT;[^;]*;([^;"]+)/.exec(row);
    if (redirect) return { ...base, kind: "redirect", location: redirect[1] };
    return { ...base, kind: "error" };
  }
  if (status >= 400 || row === undefined) return { ...base, kind: "error" };
  let value: unknown = row;
  try {
    value = JSON.parse(row);
  } catch {
    // A plain text row (e.g. "$undefined"); keep it as text.
  }
  return { ...base, kind: "ok", value };
}

export type PageResponse = {
  status: number;
  location: string | null;
  headers: Headers;
  body: string;
  /** notFound() rendered (status 404, or the marker in a streamed page). */
  notFound: boolean;
  /**
   * Redirect target: the Location header, or redirect() inside a streamed page (status 200, the
   * browser follows NEXT_REDIRECT from the payload; nothing of the page is rendered).
   */
  redirect: string | null;
};

export class Client {
  constructor(
    readonly label: string,
    private cookie: string | null,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return this.cookie ? { cookie: this.cookie, ...extra } : extra;
  }

  async get(path: string, extra: Record<string, string> = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: this.headers(extra),
      redirect: "manual",
    });
    return pageResponse(res);
  }

  async getBytes(path: string) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: this.headers(),
      redirect: "manual",
    });
    return {
      status: res.status,
      location: res.headers.get("location"),
      headers: res.headers,
      bytes: Buffer.from(await res.arrayBuffer()),
    };
  }

  /** Any request (e.g. Better Auth endpoints); no redirects followed. */
  async request(path: string, init: RequestInit = {}) {
    return fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: this.headers((init.headers as Record<string, string>) ?? {}),
      redirect: "manual",
    });
  }

  /** Calls a server action like the browser: POST to a page with the Next-Action header. */
  async action(
    ref: ActionRef,
    args: unknown[],
    options: { origin?: string } = {},
  ): Promise<ActionResponse> {
    const body = await encodeReply(args);
    const res = await fetch(`${BASE_URL}${ref.path}`, {
      method: "POST",
      headers: this.headers({
        "Next-Action": ref.id,
        Accept: "text/x-component",
        Origin: options.origin ?? BASE_URL,
        ...(typeof body === "string"
          ? { "Content-Type": "text/plain;charset=UTF-8" }
          : {}),
      }),
      body,
      redirect: "manual",
    });
    return parseActionResponse(
      res.status,
      res.headers.get("x-action-redirect") ?? res.headers.get("location"),
      await res.text(),
      res.headers,
    );
  }
}

async function pageResponse(res: Response): Promise<PageResponse> {
  const body = await res.text();
  return {
    status: res.status,
    location: res.headers.get("location"),
    headers: res.headers,
    body,
    notFound: res.status === 404 || body.includes(NOT_FOUND_MARK),
    redirect:
      res.headers.get("location") ??
      /NEXT_REDIRECT;[a-z]+;([^;"\\]+);/.exec(body)?.[1] ??
      null,
  };
}

/** FormData from a plain object (form fields are strings; booleans become checkbox "on"). */
export function form(
  fields: Record<string, string | boolean | null>,
): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === false) continue;
    data.set(key, value === true ? "on" : value);
  }
  return data;
}
