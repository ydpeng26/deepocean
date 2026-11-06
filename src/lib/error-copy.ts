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

export function errorPageLanguage(_header?: string | null): "zh-CN" | "en" {
  // Match the site's English default; the page restores any saved preference.
  return "en";
}
