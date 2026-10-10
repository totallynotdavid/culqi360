import { APP_LOCALE } from "~/shared/locale";

export function capitalize(value: string): string {
  if (value.length === 0) {
    return value;
  }

  const normalized = value.toLocaleLowerCase(APP_LOCALE);
  return (
    normalized.charAt(0).toLocaleUpperCase(APP_LOCALE) + normalized.slice(1)
  );
}
