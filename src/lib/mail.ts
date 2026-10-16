import nodemailer, { type Transporter } from "nodemailer";
import { z } from "zod";

// E-mails (reminders, notifications) over SMTP. Without SMTP_HOST nothing is sent: the e-mail is
// written to the log instead, so the worker can run locally without a mail server.

/** An empty value in .env (e.g. `SMTP_PORT=`) means "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema);

const mailEnv = z
  .object({
    SMTP_HOST: z.string().trim().optional(),
    SMTP_PORT: optional(z.coerce.number().int().positive().default(587)),
    /** true = TLS from the start (port 465); false = STARTTLS when the server offers it. */
    SMTP_SECURE: optional(
      z
        .enum(["true", "false"])
        .default("false")
        .transform((v) => v === "true"),
    ),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: optional(
      z.string().default("TBE platforma <dochazka@localhost>"),
    ),
    /** Public URL of the app for links in e-mails (the same as for sign-in). */
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  })
  .parse(process.env);

export type MailMessage = { to: string; subject: string; text: string };

/** Base URL of the app for links in e-mails, without a trailing slash. */
export const appUrl = mailEnv.BETTER_AUTH_URL.replace(/\/+$/, "");

let transporter: Transporter | null = null;

function smtp(): Transporter | null {
  if (!mailEnv.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: mailEnv.SMTP_HOST,
    port: mailEnv.SMTP_PORT,
    secure: mailEnv.SMTP_SECURE,
    auth: mailEnv.SMTP_USER
      ? { user: mailEnv.SMTP_USER, pass: mailEnv.SMTP_PASSWORD }
      : undefined,
  });
  return transporter;
}

/**
 * Sends a plain-text e-mail, or logs it when SMTP_HOST is not set. Throws when the SMTP server refuses
 * it, so the caller can roll back what it recorded as sent.
 */
export async function sendMail(
  message: MailMessage,
): Promise<"sent" | "logged"> {
  const transport = smtp();
  if (!transport) {
    console.log(
      [
        "── e-mail (SMTP_HOST not set, not sent) ──",
        `To: ${message.to}`,
        `Subject: ${message.subject}`,
        "",
        message.text,
      ].join("\n"),
    );
    return "logged";
  }
  await transport.sendMail({ from: mailEnv.SMTP_FROM, ...message });
  return "sent";
}
