import { spawn, type ChildProcess } from "node:child_process";
import { BASE_URL, PORT } from "./config";

// Build, migrations, seed and the production server of the check, as child processes.

/** Runs a command and fails with its output when it exits with an error. */
export function run(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `${command} ${args.join(" ")} failed (${code}):\n${output.slice(-4000)}`,
            ),
          ),
    );
  });
}

export type Server = {
  /** Server output since the start (the e-mails sendMail logs instead of sending). */
  output: () => string;
  stop: () => Promise<void>;
};

/** `next start` on PORT; resolves once the login page answers. */
export async function startServer(env: NodeJS.ProcessEnv): Promise<Server> {
  // Another server on the port would answer instead of this build.
  const busy = await fetch(`${BASE_URL}/login`).then(
    () => true,
    () => false,
  );
  if (busy) throw new Error(`port ${PORT} is in use; stop that server first`);
  const child: ChildProcess = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout?.on("data", (d) => (output += d));
  child.stderr?.on("data", (d) => (output += d));
  const exited = new Promise<void>((resolve) =>
    child.on("exit", () => resolve()),
  );

  const stop = async () => {
    if (child.exitCode === null) child.kill("SIGTERM");
    await exited;
  };

  const deadline = Date.now() + 30_000;
  for (;;) {
    if (child.exitCode !== null)
      throw new Error(`next start exited:\n${output.slice(-4000)}`);
    try {
      const res = await fetch(`${BASE_URL}/login`);
      if (res.ok) break;
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) {
      await stop();
      throw new Error(`next start did not answer on ${BASE_URL}:\n${output}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return { output: () => output, stop };
}
