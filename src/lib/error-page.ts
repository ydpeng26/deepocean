import { errorCopy, errorPageLanguage } from "./error-copy";

export function renderErrorPage(acceptLanguage?: string | null): string {
  const language = errorPageLanguage(acceptLanguage);
  const c = errorCopy[language];
  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="utf-8" />
    <title>${c.title} · SupDiver</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <main class="card">
      <button id="language" type="button">${language === "en" ? "中文" : "EN"}</button>
      <h1 id="title">${c.title}</h1>
      <p id="hint">${c.hint}</p>
      <div class="actions">
        <button id="retry" type="button" class="primary">${c.retry}</button>
        <noscript><a class="primary" href="">${c.retry}</a></noscript>
        <a id="home" class="secondary" href="/">${c.home}</a>
      </div>
    </main>
    <script>
      (() => {
        const copies = ${JSON.stringify(errorCopy).replace(/</g, "\\u003c")};
        let language = ${JSON.stringify(language)};
        try { const saved = localStorage.getItem('deepocean-language'); if (saved === 'en' || saved === 'zh-CN') language = saved; } catch {}
        const retry = document.getElementById('retry');
        const toggle = document.getElementById('language');
        function render() {
          const c = copies[language]; document.documentElement.lang = language;
          document.title = c.title + ' · SupDiver';
          document.getElementById('title').textContent = c.title;
          document.getElementById('hint').textContent = c.hint;
          document.getElementById('home').textContent = c.home;
          retry.textContent = retry.disabled ? c.pending : c.retry;
          toggle.textContent = language === 'en' ? '中文' : 'EN';
          toggle.setAttribute('aria-label', language === 'en' ? '切换到中文' : 'Switch to English');
        }
        toggle.addEventListener('click', () => {
          language = language === 'en' ? 'zh-CN' : 'en';
          try { localStorage.setItem('deepocean-language', language); } catch {}
          render();
        });
        retry.addEventListener('click', () => {
          if (retry.disabled) return;
          retry.disabled = true; retry.setAttribute('aria-busy', 'true'); render();
          location.reload();
        });
        render();
      })();
    </script>
  </body>
</html>`;
}
