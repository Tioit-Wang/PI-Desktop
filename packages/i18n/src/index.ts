export { en, type EnglishCatalog } from "./locales/en/index.js";
export { default as enDefault } from "./locales/en/index.js";
export { zhCN } from "./locales/zh-CN/index.js";
export { default as zhCNDefault } from "./locales/zh-CN/index.js";

export const defaultLocale = "en";

export function resolveLocale(input?: string | null): "en" | "zh-CN" {
  const value = (input || "").toLowerCase();
  if (value.startsWith("zh")) return "zh-CN";
  return "en";
}

export function flattenCatalog(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[path] = value;
    } else if (value && typeof value === "object") {
      Object.assign(out, flattenCatalog(value as Record<string, unknown>, path));
    }
  }
  return out;
}
