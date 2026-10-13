import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

/** Server environment, validated on first import. Fails fast with a readable error. */
export const env = serverEnvSchema.parse(process.env);
