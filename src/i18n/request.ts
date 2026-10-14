import { getRequestConfig } from "next-intl/server";
import { APP_TIME_ZONE } from "@/lib/dates";
import { getSession } from "@/lib/current-user";
import { toAppLocale } from "./config";
import { formats } from "./formats";

// Language of the signed-in user (user.locale); Czech before sign-in. Time zone is always Prague.
export default getRequestConfig(async () => {
  const session = await getSession();
  const locale = toAppLocale(session?.user.locale);
  return {
    locale,
    timeZone: APP_TIME_ZONE,
    formats,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
