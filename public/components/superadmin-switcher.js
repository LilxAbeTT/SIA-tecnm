class SiaSuperadminSwitcher extends HTMLElement {
  constructor() {
    super();
    this.isOpen = false;
    this.searchTerm = '';
    this.searchResults = [];
    this.searching = false;
    this.lastContextKey = '';
    this._boundSync = this.sync.bind(this);
    this._boundOutside = this.handleOutsideClick.bind(this);
  }

  connectedCallback() {
    this.sync();
    window.addEventListener('sia-profile-ready', this._boundSync);
    window.addEventListener('sia-qa-context-changed', this._boundSync);
    window.addEventListener('sia-view-changed', this._boundSync);
    window.addEventListener('storage', this._boundSync);
    document.addEventListener('click', this._boundOutside);
  }

  disconnectedCallback() {
    window.removeEventListener('sia-profile-ready', this._boundSync);
    window.removeEventListener('sia-qa-context-changed', this._boundSync);
    window.removeEventListener('sia-view-changed', this._boundSync);
    window.removeEventListener('storage', this._boundSync);
    document.removeEventListener('click', this._boundOutside);
  }

  getProfile() {
    return window.SIA?.getActiveProfile?.() || window.SIA?.currentUserProfile || null;
  }

  getActiveContextKey(profile = this.getProfile()) {
    return profile?.qaContext?.key || 'student';
  }

  getDefaultActorHint(contextKey = this.getActiveContextKey()) {
    return window.SIA?.getQaContextDefaultActor?.(contextKey) || null;
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  getViewMeta() {
    return {
      'view-dashboard': { label: 'Inicio', icon: 'bi-house-door-fill' },
      'view-superadmin-dashboard': { label: 'Sistema', icon: 'bi-shield-lock-fill' },
      'view-aula': { label: 'Aula', icon: 'bi-mortarboard-fill' },
      'view-comunidad': { label: 'Comunidad', icon: 'bi-people-fill' },
      'view-medi': { label: 'Medico', icon: 'bi-heart-pulse-fill' },
      'view-biblio': { label: 'Biblioteca', icon: 'bi-book-half' },
      'view-foro': { label: 'Eventos', icon: 'bi-calendar-event-fill' },
      'view-lactario': { label: 'Lactario', icon: 'bi-heart-fill' },
      'view-quejas': { label: 'Quejas', icon: 'bi-chat-heart-fill' },
      'view-encuestas': { label: 'Encuestas', icon: 'bi-clipboard2-check-fill' },
      'view-reportes': { label: 'Reportes', icon: 'bi-graph-up-arrow' },
      'view-vocacional-admin': { label: 'Vocacional', icon: 'bi-compass-fill' },
      'view-cafeteria': { label: 'Cafeteria', icon: 'bi-cup-hot-fill' },
      'view-avisos': { label: 'Avisos', icon: 'bi-megaphone-fill' },
      'view-profile': { label: 'Perfil', icon: 'bi-person-badge-fill' },
      'view-notificaciones': { label: 'Notif', icon: 'bi-bell-fill' }
    };
  }

  getQuickViews(profile) {
    const viewMeta = this.getViewMeta();
    const allowedViews = window.SIA?.getEffectiveAllowedViews?.(profile) || [];
    const orderedViews = [
      'view-superadmin-dashboard',
      'view-dashboard',
      ...allowedViews,
      'view-profile',
      'view-notificaciones'
    ];

    return [...new Set(orderedViews)]
      .filter((viewId) => viewMeta[viewId] && (viewId === 'view-profile' || viewId === 'view-notificaciones' || window.SIA?.canAccessView?.(profile, viewId)));
  }

  handleOutsideClick(event) {
    if (!this.isOpen || this.contains(event.target)) return;
    this.isOpen = false;
    this.sync();
  }

  resetSearchState(contextKey = '') {
    if (this.lastContextKey === contextKey) return;
    this.lastContextKey = contextKey;
    this.searchTerm = '';
    this.searchResults = [];
    this.searching = false;
  }

  async runSearch() {
    const contextKey = this.getActiveContextKey();
    const term = (this.searchTerm || '').trim();
    this.searching = true;
    this.sync();

    try {
      this.searchResults = await window.SIA?.searchQaActors?.(term, contextKey) || [];
    } catch (error) {
      console.warn('[QA Switcher] Error buscando actores QA:', error);
      this.searchResults = [];
    } finally {
      this.searching = false;
      this.sync();
    }
  }

  async applyActor(actor, options = {}) {
    const profile = this.getProfile();
    const contextKey = this.getActiveContextKey(profile);
    const targetView = profile?.qaContext?.targetView || '';
    await window.SIA?.setQaContextActor?.(contextKey, actor, {
      reload: true,
      viewId: targetView,
      forceTargetView: options.forceTargetView === true
    });
    this.isOpen = false;
    this.sync();
  }

  async useDefaultActor() {
    const profile = this.getProfile();
    const contextKey = this.getActiveContextKey(profile);
    const targetView = profile?.qaContext?.targetView || '';
    await window.SIA?.setQaContextActor?.(contextKey, null, {
      reload: true,
      resolveDefault: true,
      viewId: targetView,
      forceTargetView: true
    });
    this.isOpen = false;
    this.sync();
  }

  async clearActor() {
    const profile = this.getProfile();
    const contextKey = this.getActiveContextKey(profile);
    const targetView = profile?.qaContext?.targetView || '';
    await window.SIA?.clearQaContextActor?.(contextKey, {
      reload: true,
      viewId: targetView
    });
    this.sync();
  }

  render() {
    const profile = this.getProfile();
    const canUse = window.SIA?.canUseQaContextSwitcher?.(profile);

    if (!canUse) {
      this.style.display = 'none';
      this.innerHTML = '';
      return;
    }

    this.style.display = 'block';

    const activeContextKey = this.getActiveContextKey(profile);
    this.resetSearchState(activeContextKey);

    const presets = window.SIA?.getQaContextPresets?.() || [];
    const activeLabel = profile?.qaContext?.label || 'Alumno';
    const quickViews = this.getQuickViews(profile);
    const viewMeta = this.getViewMeta();
    const email = profile?.email || profile?.emailInstitucional || '';
    const actor = profile?.qaActor || null;
    const owner = profile?.qaOwner || null;
    const actorHint = this.getDefaultActorHint(activeContextKey);
    const safeEmail = this.escapeHtml(email);
    const safeActiveLabel = this.escapeHtml(activeLabel);
    const safeActorName = this.escapeHtml(actor ? actor.displayName : 'Sin actor operativo');
    const safeActorIdentity = this.escapeHtml(actor ? (actor.email || actor.emailInstitucional || actor.uid) : 'Usando tu propio uid QA dentro del contexto actual.');
    const safeOwner = this.escapeHtml(owner ? `Cuenta real QA: ${owner.email || owner.displayName || owner.uid}` : 'Cuenta real QA activa.');
    const safeActorHint = actorHint ? {
      label: this.escapeHtml(actorHint.label || ''),
      email: this.escapeHtml(actorHint.email || '')
    } : null;
    const safeSearchTerm = this.escapeHtml(this.searchTerm);

    this.innerHTML = `
      <style>
        .qa-switcher {
          position: fixed;
          left: 1rem;
          bottom: calc(84px + env(safe-area-inset-bottom, 0px));
          z-index: 1105;
          max-width: calc(100vw - 2rem);
          font-family: "Noto Sans", system-ui, sans-serif;
        }
        .qa-switcher__fab {
          border: 0;
          border-radius: 999px;
          padding: 0.85rem 1rem;
          min-width: 64px;
          background: linear-gradient(135deg, #0f172a 0%, #0f766e 52%, #f97316 100%);
          color: #fff;
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.32);
          display: inline-flex;
          align-items: center;
          gap: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.01em;
        }
        .qa-switcher__fab small {
          display: block;
          font-size: 0.68rem;
          font-weight: 600;
          opacity: 0.82;
          line-height: 1.05;
        }
        .qa-switcher__panel {
          width: min(420px, calc(100vw - 2rem));
          margin-bottom: 0.75rem;
          max-height: min(78vh, calc(100vh - 148px - env(safe-area-inset-bottom, 0px)));
          border-radius: 1.35rem;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.25);
          background:
            radial-gradient(circle at top right, rgba(249, 115, 22, 0.2), transparent 34%),
            radial-gradient(circle at top left, rgba(20, 184, 166, 0.18), transparent 30%),
            rgba(15, 23, 42, 0.96);
          color: #e2e8f0;
          box-shadow: 0 22px 64px rgba(15, 23, 42, 0.42);
          backdrop-filter: blur(16px);
          display: flex;
          flex-direction: column;
        }
        .qa-switcher__header {
          padding: 1rem 1rem 0.75rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.16);
          flex: 0 0 auto;
        }
        .qa-switcher__eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.3rem 0.7rem;
          border-radius: 999px;
          background: rgba(249, 115, 22, 0.16);
          color: #fdba74;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .qa-switcher__title {
          margin: 0.7rem 0 0.2rem;
          font-size: 1rem;
          font-weight: 800;
        }
        .qa-switcher__subtitle {
          margin: 0;
          color: rgba(226, 232, 240, 0.72);
          font-size: 0.78rem;
          line-height: 1.35;
        }
        .qa-switcher__body {
          padding: 0.9rem 1rem 1rem;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.45) transparent;
          flex: 1 1 auto;
        }
        .qa-switcher__body::-webkit-scrollbar {
          width: 8px;
        }
        .qa-switcher__body::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.35);
          border-radius: 999px;
        }
        .qa-switcher__section + .qa-switcher__section {
          margin-top: 1rem;
        }
        .qa-switcher__section-title {
          margin: 0 0 0.55rem;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(226, 232, 240, 0.56);
        }
        .qa-switcher__grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.6rem;
        }
        .qa-switcher__preset {
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 1rem;
          background: rgba(15, 23, 42, 0.5);
          color: inherit;
          text-align: left;
          padding: 0.8rem;
          transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        }
        .qa-switcher__preset:hover {
          transform: translateY(-1px);
          border-color: rgba(251, 146, 60, 0.45);
        }
        .qa-switcher__preset.is-active {
          background: linear-gradient(135deg, rgba(20, 184, 166, 0.22), rgba(249, 115, 22, 0.22));
          border-color: rgba(253, 186, 116, 0.7);
        }
        .qa-switcher__preset strong {
          display: block;
          font-size: 0.86rem;
          margin-bottom: 0.2rem;
        }
        .qa-switcher__preset span {
          display: block;
          font-size: 0.73rem;
          color: rgba(226, 232, 240, 0.72);
          line-height: 1.28;
        }
        .qa-switcher__actor-card,
        .qa-switcher__result {
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 1rem;
          background: rgba(15, 23, 42, 0.5);
          padding: 0.8rem;
        }
        .qa-switcher__actor-card strong,
        .qa-switcher__result strong {
          display: block;
          font-size: 0.84rem;
        }
        .qa-switcher__actor-card span,
        .qa-switcher__result span {
          display: block;
          font-size: 0.73rem;
          color: rgba(226, 232, 240, 0.72);
          line-height: 1.25;
        }
        .qa-switcher__row {
          display: flex;
          gap: 0.55rem;
          flex-wrap: wrap;
        }
        .qa-switcher__action,
        .qa-switcher__chip {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 999px;
          background: rgba(30, 41, 59, 0.78);
          color: #f8fafc;
          padding: 0.5rem 0.78rem;
          font-size: 0.74rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 0.38rem;
        }
        .qa-switcher__action.is-primary {
          background: rgba(20, 184, 166, 0.18);
          border-color: rgba(45, 212, 191, 0.36);
        }
        .qa-switcher__search {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.55rem;
          margin-top: 0.65rem;
        }
        .qa-switcher__input {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 0.85rem;
          background: rgba(15, 23, 42, 0.66);
          color: #f8fafc;
          padding: 0.7rem 0.85rem;
          font-size: 0.82rem;
        }
        .qa-switcher__input::placeholder {
          color: rgba(226, 232, 240, 0.46);
        }
        .qa-switcher__results {
          display: grid;
          gap: 0.55rem;
          margin-top: 0.7rem;
        }
        .qa-switcher__result-footer {
          margin-top: 0.6rem;
          display: flex;
          justify-content: flex-end;
        }
        .qa-switcher__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .qa-switcher__footer {
          margin-top: 0.85rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.72rem;
          color: rgba(226, 232, 240, 0.56);
        }
        .qa-switcher__close {
          border: 0;
          background: transparent;
          color: rgba(226, 232, 240, 0.72);
          padding: 0.25rem;
        }
        @media (max-width: 767.98px) {
          .qa-switcher {
            left: 0.5rem;
            right: 0.5rem;
            bottom: calc(78px + env(safe-area-inset-bottom, 0px));
            max-width: none;
          }
          .qa-switcher__grid {
            grid-template-columns: 1fr 1fr;
            gap: 0.45rem;
          }
          .qa-switcher__panel {
            width: min(100%, 390px);
            max-height: min(70vh, calc(100vh - 132px - env(safe-area-inset-bottom, 0px)));
            margin-bottom: 0.55rem;
            border-radius: 1.1rem;
          }
          .qa-switcher__header {
            padding: 0.85rem 0.85rem 0.65rem;
          }
          .qa-switcher__title {
            font-size: 0.94rem;
          }
          .qa-switcher__subtitle {
            font-size: 0.74rem;
          }
          .qa-switcher__body {
            padding: 0.75rem 0.85rem 0.85rem;
          }
          .qa-switcher__section + .qa-switcher__section {
            margin-top: 0.8rem;
          }
          .qa-switcher__preset,
          .qa-switcher__actor-card,
          .qa-switcher__result {
            padding: 0.68rem;
            border-radius: 0.9rem;
          }
          .qa-switcher__preset strong {
            font-size: 0.8rem;
            margin-bottom: 0.1rem;
          }
          .qa-switcher__preset span,
          .qa-switcher__actor-card span,
          .qa-switcher__result span {
            font-size: 0.7rem;
            line-height: 1.2;
          }
          .qa-switcher__action,
          .qa-switcher__chip {
            padding: 0.46rem 0.7rem;
            font-size: 0.71rem;
          }
          .qa-switcher__fab span {
            display: none;
          }
          .qa-switcher__search {
            grid-template-columns: 1fr;
          }
        }
      </style>
      <div class="qa-switcher">
        ${this.isOpen ? `
          <section class="qa-switcher__panel">
            <div class="qa-switcher__header">
              <div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <span class="qa-switcher__eyebrow">
                    <i class="bi bi-shield-lock-fill"></i>
                    SuperAdmin QA
                  </span>
                  <h3 class="qa-switcher__title">Modo actual: ${safeActiveLabel}</h3>
                  <p class="qa-switcher__subtitle">${safeEmail}</p>
                </div>
                <button type="button" class="qa-switcher__close" data-action="close" aria-label="Cerrar">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>
            </div>
            <div class="qa-switcher__body">
              <div class="qa-switcher__section">
                <p class="qa-switcher__section-title">Cambiar contexto</p>
                <div class="qa-switcher__grid">
                  ${presets.map((preset) => `
                    <button type="button" class="qa-switcher__preset ${preset.key === activeContextKey ? 'is-active' : ''}" data-context="${preset.key}" data-target-view="${preset.targetView || ''}">
                      <strong>${preset.label}</strong>
                      <span>${preset.description || 'Sin descripcion'}</span>
                    </button>
                  `).join('')}
                </div>
              </div>
              <div class="qa-switcher__section">
                <p class="qa-switcher__section-title">Actuar Como</p>
                <div class="qa-switcher__actor-card">
                  <strong>${safeActorName}</strong>
                  <span>${safeActorIdentity}</span>
                  <span>${safeOwner}</span>
                </div>
                <div class="qa-switcher__row mt-2">
                  ${actorHint ? `
                    <button type="button" class="qa-switcher__action is-primary" data-action="use-default-actor">
                      <i class="bi bi-hospital"></i>
                      Usar oficial
                    </button>
                  ` : ''}
                  ${actor ? `
                    <button type="button" class="qa-switcher__action" data-action="clear-actor">
                      <i class="bi bi-arrow-counterclockwise"></i>
                      Quitar actor
                    </button>
                  ` : ''}
                </div>
                ${safeActorHint ? `<p class="qa-switcher__subtitle mt-2">${safeActorHint.label}: ${safeActorHint.email}</p>` : ''}
                <form class="qa-switcher__search" data-action="search-form">
                  <input
                    class="qa-switcher__input"
                    type="text"
                    name="qa-actor-search"
                    value="${safeSearchTerm}"
                    placeholder="Buscar por correo institucional o matricula"
                    autocomplete="off"
                  />
                  <button type="submit" class="qa-switcher__action">
                    <i class="bi bi-search"></i>
                    ${this.searching ? 'Buscando...' : 'Buscar'}
                  </button>
                </form>
                ${this.searchResults.length ? `
                  <div class="qa-switcher__results">
                    ${this.searchResults.map((result) => `
                      <div class="qa-switcher__result">
                        <strong>${this.escapeHtml(result.displayName)}</strong>
                        <span>${this.escapeHtml(result.email || result.emailInstitucional || result.uid)}</span>
                        <span>${this.escapeHtml(result.matricula || 'Sin matricula')}${result.role ? ` - ${this.escapeHtml(result.role)}` : ''}</span>
                        <div class="qa-switcher__result-footer">
                          <button type="button" class="qa-switcher__action" data-actor-uid="${result.uid}">
                            <i class="bi bi-person-check-fill"></i>
                            Actuar como
                          </button>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
              <div class="qa-switcher__section">
                <p class="qa-switcher__section-title">Navegacion rapida</p>
                <div class="qa-switcher__chips">
                  ${quickViews.map((viewId) => `
                    <button type="button" class="qa-switcher__chip" data-view="${viewId}">
                      <i class="bi ${viewMeta[viewId].icon}"></i>
                      ${viewMeta[viewId].label}
                    </button>
                  `).join('')}
                </div>
              </div>
              <div class="qa-switcher__footer">
                <span>Permiso real: superadmin. Identidad operativa: ${actor ? 'suplantada' : 'QA propia'}.</span>
                <span>${profile?.role || 'student'}</span>
              </div>
            </div>
          </section>
        ` : ''}
        <button type="button" class="qa-switcher__fab" data-action="toggle" aria-label="Cambiar contexto QA">
          <i class="bi bi-bezier2 fs-5"></i>
          <div>
            <small>QA</small>
            <span>${actor ? `${safeActiveLabel} - ${this.escapeHtml(actor.displayName)}` : safeActiveLabel}</span>
          </div>
        </button>
      </div>
    `;

    this.bindDomListeners();
  }

  bindDomListeners() {
    this.querySelector('[data-action="toggle"]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.isOpen = !this.isOpen;
      this.sync();
    });

    this.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      this.isOpen = false;
      this.sync();
    });

    this.querySelectorAll('[data-context]').forEach((button) => {
      button.addEventListener('click', async () => {
        const contextKey = button.dataset.context;
        const targetView = button.dataset.targetView || '';
        button.disabled = true;
        await window.SIA?.setQaProfileContext?.(contextKey, {
          reload: true,
          viewId: targetView,
          forceTargetView: true
        });
        this.sync();
      });
    });

    this.querySelector('[data-action="use-default-actor"]')?.addEventListener('click', async () => {
      await this.useDefaultActor();
    });

    this.querySelector('[data-action="clear-actor"]')?.addEventListener('click', async () => {
      await this.clearActor();
    });

    this.querySelector('[data-action="search-form"]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = this.querySelector('input[name="qa-actor-search"]');
      this.searchTerm = input?.value || '';
      await this.runSearch();
    });

    this.querySelector('input[name="qa-actor-search"]')?.addEventListener('input', (event) => {
      this.searchTerm = event.target.value;
    });

    this.querySelectorAll('[data-actor-uid]').forEach((button) => {
      button.addEventListener('click', async () => {
        const actorUid = button.dataset.actorUid;
        const actor = this.searchResults.find((item) => item.uid === actorUid);
        if (!actor) return;
        await this.applyActor(actor);
      });
    });

    this.querySelectorAll('[data-view]').forEach((button) => {
      button.addEventListener('click', () => {
        const viewId = button.dataset.view;
        if (!viewId) return;
        this.isOpen = false;
        this.sync();
        window.SIA?.navigate?.(viewId);
      });
    });
  }

  sync() {
    this.render();
  }
}

if (!customElements.get('sia-superadmin-switcher')) {
  customElements.define('sia-superadmin-switcher', SiaSuperadminSwitcher);
}
