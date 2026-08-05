(() => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      nav.dataset.open = String(open);
    });

    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        toggle.setAttribute('aria-expanded', 'false');
        nav.dataset.open = 'false';
      }
    });
  }

  document.querySelectorAll('[data-year]').forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });

  const status = document.querySelector('#form-status');
  const params = new URLSearchParams(window.location.search);
  if (status && params.get('enviado') === '1') {
    status.textContent = 'Mensagem encaminhada. A Loja agradece o contato.';
    window.history.replaceState(null, '', window.location.pathname);
    status.focus();
  }
})();
