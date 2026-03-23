import { Breadcrumbs } from '../core/breadcrumbs.js';

class SiaShellBreadcrumbs extends HTMLElement {
  constructor() {
    super();
    this._breadcrumbUnsub = null;
    this._handleClick = this._handleClick.bind(this);
  }

  connectedCallback() {
    this.render();
    this.addEventListener('click', this._handleClick);
    this._breadcrumbUnsub = Breadcrumbs.subscribe((state) => this._sync(state));
    this._sync(Breadcrumbs.getState());
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._handleClick);
    if (this._breadcrumbUnsub) this._breadcrumbUnsub();
  }

  render() {
    this.classList.add('d-none');
    this.innerHTML = `
      <div class="sia-shell-breadcrumbs-wrap">
        <div class="container px-3 px-md-4">
          <nav class="sia-shell-breadcrumbs" aria-label="Breadcrumb">
            <div class="sia-shell-breadcrumbs-track" data-breadcrumb-track></div>
          </nav>
        </div>
      </div>
    `;
  }

  _sync(state) {
    const track = this.querySelector('[data-breadcrumb-track]');
    if (!track) return;

    const trail = Array.isArray(state?.trail) ? state.trail : [];
    const shouldHide = !state || trail.length < 2;
    this.classList.toggle('d-none', shouldHide);

    if (shouldHide) {
      track.innerHTML = '';
      return;
    }

    const accent = state.color || 'var(--primary, #1B396A)';
    track.style.setProperty('--crumb-accent', accent);
    track.innerHTML = trail.map((crumb, index) => {
      const isCurrent = index === trail.length - 1 || crumb.current;
      const label = this._escapeHtml(crumb.label || '');
      const separator = isCurrent ? '' : '<span class="sia-shell-breadcrumbs-separator" aria-hidden="true"><i class="bi bi-chevron-right"></i></span>';

      if (!isCurrent && crumb.viewId) {
        return `
          <button type="button" class="sia-shell-breadcrumbs-link" data-breadcrumb-view="${this._escapeAttr(crumb.viewId)}">
            ${label}
          </button>
          ${separator}
        `;
      }

      if (!isCurrent) {
        return `
          <span class="sia-shell-breadcrumbs-node">${label}</span>
          ${separator}
        `;
      }

      return `
        <span class="sia-shell-breadcrumbs-current" aria-current="page">${label}</span>
        ${separator}
      `;
    }).join('');
  }

  _handleClick(event) {
    const trigger = event.target.closest('[data-breadcrumb-view]');
    if (!trigger) return;

    const viewId = trigger.dataset.breadcrumbView;
    if (!viewId) return;

    event.preventDefault();
    if (typeof window.navigate === 'function') {
      window.navigate(viewId);
      return;
    }

    if (window.SIA?._router?.navigate) {
      void window.SIA._router.navigate(viewId);
    }
  }

  _escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&#39;'
    }[char]));
  }

  _escapeAttr(value) {
    return this._escapeHtml(value).replace(/`/g, '&#96;');
  }
}

if (!customElements.get('sia-shell-breadcrumbs')) {
  customElements.define('sia-shell-breadcrumbs', SiaShellBreadcrumbs);
}
