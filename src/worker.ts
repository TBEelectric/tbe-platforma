// Scheduled jobs, run as a separate process: pnpm worker (on the VPS the `worker` service of Docker
// Compose). Every minute it sends queued notifications (returned timesheet, reopened month) and, on
// working days from reminder_time (Prague), the daily reminders. reminder_log and notification.sent_at
// make every run safe to repeat, also after a restart.
//
//   pnpm worker            run until stopped (SIGINT / SIGTERM)
//   pnpm worker --once     one pass, then exit (for checking the output)

import { closeDb } from "@/lib/db";
import { todayInPrague } from "@/lib/dates";
import {
  runDailyReminders,
  sendPendingNotifications,
} from "@/modules/timesheets/reminders";

const TICK_MS = 60_000;
/** After a failed send the daily run is tried again after this long (every recipient once). */
const RETRY_MS = 10 * 60_000;

let dailyDoneOn: string | null = null;
let retryAt = 0;
let stopping = false;

function log(text: string) {
  console.log(`[worker ${new Date().toISOString()}] ${text}`);
}

async function tick(now: Date) {
  const notifications = await sendPendingNotifications(now);
  if (notifications.sent || notifications.failed)
    log(
      `notifications: ${notifications.sent} sent, ${notifications.failed} failed`,
    );

  const today = todayInPrague(now);
  if (dailyDoneOn === today || now.getTime() < retryAt) return;
  const result = await runDailyReminders(now);
  if (!result) return;
  log(`daily reminders: ${result.sent} sent, ${result.failed} failed`);
  if (result.failed > 0) retryAt = now.getTime() + RETRY_MS;
  else dailyDoneOn = today;
}

async function safeTick() {
  try {
    await tick(new Date());
  } catch (error) {
    console.error("[worker] tick failed:", error);
  }
}

async function main() {
  if (process.argv.includes("--once")) {
    await safeTick();
    await closeDb();
    return;
  }
  log("started");
  let running: Promise<void> = safeTick();
  const timer = setInterval(() => {
    running = running.then(safeTick);
  }, TICK_MS);
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log(`${signal}, stopping`);
    clearInterval(timer);
    await running;
    await closeDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));
}

void main();
