import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/i18n/LanguageProvider.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: 1, jsx: 4, target: 9 } }).outputText;
function mount({ locale, stored, blocked = false, server = false }) {
  let cursor = 0;
  const cells = [], effects = [], writes = [];
  const storage = new Map(stored ? [['deepocean-language', stored]] : []);
  const document = { documentElement: { lang: 'en' } };
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useMemo: fn => fn(),
    useState(initial) {
      const i = cursor++;
      if (!(i in cells)) cells[i] = initial;
      return [cells[i], value => { cells[i] = typeof value === 'function' ? value(cells[i]) : value; }];
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!cells[i] || deps.some((value, index) => !Object.is(value, cells[i][index]))) {
        cells[i] = deps;
        effects.push(fn);
      }
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, document,
    ...(server ? {} : { window: {
      navigator: { language: locale },
      get localStorage() {
        if (blocked) throw Error('Storage unavailable');
        return {
          getItem: key => storage.get(key) ?? null,
          setItem(key, value) { writes.push(value); storage.set(key, value); },
        };
      },
    } }),
    require: name => name === 'react' ? react : { jsx: (type, props) => ({ type, props }) },
  });
  return {
    storage, writes, document,
    render(flush = true) {
      cursor = 0;
      const tree = module.exports.LanguageProvider({ children: 'Page' });
      if (flush) effects.splice(0).forEach(fn => fn());
      return tree.props.value;
    },
  };
}

assert.equal(mount({ server: true }).render(false).language, 'en');
for (const locale of ['zh-CN', 'zh-TW', 'en-US', 'fr-FR']) {
  for (const stored of [undefined, 'invalid', 'en', 'zh-CN']) {
    const page = mount({ locale, stored });
    assert.equal(page.render().language, 'en', 'Initial render matches English SSR');
    const expected = stored === 'zh-CN' ? 'zh-CN' : 'en';
    assert.equal(page.render().language, expected);
    assert.equal(page.document.documentElement.lang, expected);
    assert.equal(page.writes[0], expected, 'Do not overwrite preference during hydration');
    page.render().setLanguage('zh-CN');
    page.render();
    const reload = mount({ locale, stored: page.storage.get('deepocean-language') });
    reload.render();
    assert.equal(reload.render().language, 'zh-CN', 'Manual choice survives reload');
    reload.render().toggleLanguage();
    assert.equal(reload.render().language, 'en');
  }
  const blocked = mount({ locale, blocked: true });
  blocked.render();
  assert.equal(blocked.render().language, 'en');
  blocked.render().toggleLanguage();
  assert.equal(blocked.render().language, 'zh-CN');
}
console.log('PASS: English SSR and first visit for all browser languages; stored choices, reload, toggle and unavailable storage');
