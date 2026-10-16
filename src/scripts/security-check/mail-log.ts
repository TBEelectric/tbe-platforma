// E-mails as sendMail logs them when SMTP_HOST is not set (src/lib/mail.ts).

const HEADER = "── e-mail (SMTP_HOST not set, not sent) ──";

export type Mail = { to: string; subject: string; text: string };

export function parseMails(output: string): Mail[] {
  return output
    .split(HEADER)
    .slice(1)
    .map((block) => {
      const body = block.split(/\n(?=⨯ |\[worker )/)[0];
      const to = /\nTo: (.*)\n/.exec(body)?.[1]?.trim() ?? "";
      const subject = /\nSubject: (.*)\n/.exec(body)?.[1]?.trim() ?? "";
      const text = body.split("\n\n").slice(1).join("\n\n");
      return { to, subject, text };
    });
}
