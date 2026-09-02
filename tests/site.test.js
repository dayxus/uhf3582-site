const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const publicPages = [
  'index.html',
  'a-loja/index.html',
  'contato/index.html',
  'privacidade/index.html',
  '404.html',
];

test('a V2 oferece páginas públicas reais com navegação sem handlers inline', () => {
  for (const page of publicPages) {
    assert.ok(fs.existsSync(path.join(root, page)), `${page} deve existir`);
  }

  const home = read('index.html');
  assert.match(home, /href="\/a-loja\/"/);
  assert.match(home, /href="\/contato\/"/);
  assert.match(home, /href="\/privacidade\/"/);
  assert.match(home, /href="https:\/\/meta\.gob\.org\.br\/dashboard"/, 'Área dos Irmãos deve apontar para o dashboard do GOB');
  assert.doesNotMatch(home, /\son(?:click|load|submit|change)=/i);
});

test('contato é acessível e informa o tratamento temporário pelo FormSubmit', () => {
  const contact = read('contato/index.html');
  const privacy = read('privacidade/index.html');
  const allHtml = publicPages.map(read).join('\n');

  assert.match(contact, /action="https:\/\/formsubmit\.co\//);
  for (const field of ['nome', 'email', 'assunto', 'mensagem']) {
    assert.match(contact, new RegExp(`<label[^>]+for="${field}"`, 'i'));
    assert.match(contact, new RegExp(`(?:input|textarea)[^>]+id="${field}"`, 'i'));
  }
  assert.match(contact, /autocomplete="name"/);
  assert.match(contact, /autocomplete="email"/);
  assert.match(contact, /name="ciente_privacidade"[^>]+required/);
  assert.match(contact, /href="\/privacidade\/"/);

  assert.match(privacy, /FormSubmit/);
  assert.match(privacy, /nome, e-mail, assunto e mensagem/i);
  assert.match(privacy, /gestao\.uhf3582\.com\.br/);
  assert.doesNotMatch(privacy, /nunca sendo compartilhados/i);
  assert.doesNotMatch(privacy, /criptografia em repouso/i);
  assert.doesNotMatch(privacy, /excluídos em até 90 dias/i);
  assert.doesNotMatch(privacy, /antes da publicação definitiva/i);
  assert.doesNotMatch(allHtml, /Administração 2026/i);
  assert.doesNotMatch(allHtml, /cookie-banner|localStorage/i);
});

test('SEO, assets e headers da V2 são versionados e compatíveis com CSP forte', () => {
  for (const page of publicPages) {
    const html = read(page);
    assert.match(html, /<meta[^>]+name="description"/i, `${page}: description`);
    assert.match(html, /<link[^>]+rel="canonical"/i, `${page}: canonical`);
    assert.match(html, /<meta[^>]+property="og:title"/i, `${page}: Open Graph`);
    assert.match(html, /href="\/assets\/css\/site\.css"/i, `${page}: CSS externo`);
    assert.doesNotMatch(html, /<style\b|\sstyle=|<script(?![^>]+src=)/i, `${page}: sem CSS/JS inline`);
    assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/i, `${page}: sem fontes remotas`);
  }

  for (const file of [
    'assets/css/site.css',
    'assets/js/site.js',
    'assets/img/logo-uhf3582.webp',
    'favicon.svg',
    'manifest.webmanifest',
    'robots.txt',
    'sitemap.xml',
    'render.yaml',
  ]) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} deve existir`);
  }

  assert.ok(fs.statSync(path.join(root, 'assets/img/logo-uhf3582.webp')).size < 350_000, 'logo WebP deve ter menos de 350 KB');
  const render = read('render.yaml');
  for (const header of ['Content-Security-Policy', 'Strict-Transport-Security', 'Referrer-Policy', 'Permissions-Policy']) {
    assert.match(render, new RegExp(header));
  }
  assert.match(render, /script-src 'self'/);
  assert.doesNotMatch(render, /unsafe-inline/);
  assert.match(render, /form-action 'self' https:\/\/formsubmit\.co/);
});

test('menu móvel e retorno do formulário funcionam sem armazenamento local', () => {
  const handlers = new Map();
  const makeElement = () => ({
    attrs: new Map(),
    dataset: {},
    textContent: '',
    focused: false,
    addEventListener(type, handler) { handlers.set(this, handlers.get(this) || {}); handlers.get(this)[type] = handler; },
    getAttribute(name) { return this.attrs.get(name) ?? null; },
    setAttribute(name, value) { this.attrs.set(name, value); },
    focus() { this.focused = true; },
  });
  const toggle = makeElement();
  toggle.setAttribute('aria-expanded', 'false');
  const nav = makeElement();
  const status = makeElement();
  const year = makeElement();
  let replaced = null;
  const document = {
    querySelector(selector) {
      return ({ '.nav-toggle': toggle, '.site-nav': nav, '#form-status': status })[selector] || null;
    },
    querySelectorAll(selector) { return selector === '[data-year]' ? [year] : []; },
  };
  const window = {
    location: { search: '?enviado=1', pathname: '/contato/' },
    history: { replaceState(_a, _b, url) { replaced = url; } },
  };

  const script = read('assets/js/site.js');
  vm.runInNewContext(script, { document, window, URLSearchParams, Date });

  handlers.get(toggle).click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(nav.dataset.open, 'true');
  handlers.get(nav).click({ target: { closest: () => ({}) } });
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(nav.dataset.open, 'false');
  assert.match(year.textContent, /^20\d{2}$/);
  assert.match(status.textContent, /Mensagem encaminhada/);
  assert.equal(status.focused, true);
  assert.equal(replaced, '/contato/');
  assert.doesNotMatch(script, /localStorage|document\.cookie/);
});
