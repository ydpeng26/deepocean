export const errorCopy = {
  "zh-CN": {
    missing: "找不到这个页面",
    missingHint: "页面可能已移动，或链接已失效。",
    title: "页面暂时无法打开",
    hint: "可以重试，或返回首页。尚未保存的输入不会自动保存。",
    retry: "重试",
    pending: "正在重试…",
    failed: "重试未完成，请检查网络后再试，或返回首页。",
    home: "返回首页",
  },
  en: {
    missing: "Page not found",
    missingHint: "The page may have moved, or the link is no longer valid.",
    title: "This page didn't load",
    hint: "Try again or return home. Unsaved input is not saved automatically.",
    retry: "Try again",
    pending: "Trying again…",
    failed: "Retry did not complete. Check your connection and try again, or return home.",
    home: "Go home",
  },
};

export function errorPageLanguage(header?: string | null): "zh-CN" | "en" {
  const choices = (header ?? "")
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = params.find((value) => value.trim().startsWith("q="));
      const weight = q ? Number(q.trim().slice(2)) : 1;
      return { tag, weight, index };
    })
    .filter(({ tag, weight }) => /^(zh|en)(-|$)/.test(tag) && weight > 0 && weight <= 1)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return choices[0]?.tag.startsWith("en") ? "en" : "zh-CN";
}
