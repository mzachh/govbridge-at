// Only synthetic UI controls. WebMCP belongs to the installed extension.
const uiText = (de, en) => (document.documentElement.lang === 'en' ? en : de);
addEventListener('pageshow', (event) => {
  if (event.persisted && document.body.dataset.protected) {
    document.body.style.visibility = 'hidden';
    location.reload();
  }
});
document.querySelectorAll('[data-mutate]').forEach((button) =>
  button.addEventListener('click', () => {
    const first = document.querySelector('.card_content [role="row"]');
    if (button.dataset.mutate === 'remove') first?.remove();
    if (button.dataset.mutate === 'amount') {
      const badge = document.querySelector('.cb_status .badge');
      if (badge) {
        badge.textContent = '↪ 123.45 €';
      }
    }
    if (button.dataset.mutate === 'status') {
      const heading = document.querySelector('.card_title h2');
      if (heading)
        heading.textContent =
          heading.textContent === uiText('offene Einreichungen', 'Open claims')
            ? uiText('abgelehnte Einreichungen', 'Rejected claims')
            : uiText('offene Einreichungen', 'Open claims');
    }
  }),
);
document.querySelectorAll('form[data-search]').forEach((form) => {
  if (!['ajax-replace', 'ajax-text-only'].includes(form.dataset.search)) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.dataset.dispatched) return;
    form.dataset.dispatched = 'true';
    const busy = document.createElement('div');
    busy.setAttribute('aria-busy', 'true');
    busy.className = 'loading';
    busy.textContent = uiText('Demo lädt …', 'Loading demo …');
    form.after(busy);
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new URLSearchParams(new FormData(form)),
        credentials: 'same-origin',
      });
      const doc = new DOMParser().parseFromString(
        await response.text(),
        'text/html',
      );
      if (form.dataset.search === 'ajax-replace') {
        const content = doc.querySelector(
          '#demo-results, #infolist, [role="alert"]',
        );
        if (content) {
          const old = document.querySelector('#demo-results');
          if (old) old.replaceWith(content);
          else form.after(content);
          busy.remove();
        } else {
          busy.textContent = uiText(
            'Suchausgang unklar. Bitte Seite neu öffnen; nicht automatisch erneut senden.',
            'Search outcome uncertain. Reopen the page; do not automatically resubmit.',
          );
        }
      } else {
        const badge = document.querySelector('.cb_status .badge');
        if (badge) {
          badge.textContent = '↪ 123.45 €';
        }
        busy.textContent = uiText(
          'Text-only Demo: Suchausgang absichtlich unbestätigt.',
          'Text-only demo: search outcome intentionally unconfirmed.',
        );
      }
    } catch {
      busy.textContent = uiText(
        'Suchausgang unklar. Verbindung prüfen; nicht automatisch erneut senden.',
        'Search outcome uncertain. Check the connection; do not automatically resubmit.',
      );
    }
  });
});
