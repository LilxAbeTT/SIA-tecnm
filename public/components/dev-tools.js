import { Store } from '../core/state.js';

const VIEW_META = {
  'view-dashboard': { label: 'Inicio', icon: 'bi-house-door-fill' },
  'view-superadmin-dashboard': { label: 'Sistema', icon: 'bi-shield-lock-fill' },
  'view-aula': { label: 'Aula', icon: 'bi-mortarboard-fill' },
  'view-comunidad': { label: 'Comunidad', icon: 'bi-people-fill' },
  'view-medi': { label: 'Servicio medico', icon: 'bi-heart-pulse-fill' },
  'view-biblio': { label: 'Biblioteca', icon: 'bi-book-half' },
  'view-foro': { label: 'Eventos', icon: 'bi-calendar-event-fill' },
  'view-lactario': { label: 'Lactario', icon: 'bi-heart-fill' },
  'view-quejas': { label: 'Quejas', icon: 'bi-chat-heart-fill' },
  'view-encuestas': { label: 'Encuestas', icon: 'bi-clipboard2-check-fill' },
  'view-reportes': { label: 'Reportes', icon: 'bi-graph-up-arrow' },
  'view-cafeteria': { label: 'Cafeteria', icon: 'bi-cup-hot-fill' },
  'view-avisos': { label: 'Avisos', icon: 'bi-megaphone-fill' },
  'view-vocacional-admin': { label: 'Vocacional', icon: 'bi-compass-fill' }
};

const STUDENT_VIEWS = [
  'view-dashboard',
  'view-aula',
  'view-comunidad',
  'view-medi',
  'view-biblio',
  'view-foro',
  'view-quejas',
  'view-encuestas',
  'view-cafeteria'
];

const ALL_ADMIN_VIEWS = [
  'view-dashboard',
  'view-superadmin-dashboard',
  'view-aula',
  'view-comunidad',
  'view-medi',
  'view-biblio',
  'view-foro',
  'view-lactario',
  'view-quejas',
  'view-encuestas',
  'view-reportes',
  'view-vocacional-admin',
  'view-cafeteria',
  'view-avisos'
];

const ROLE_PRESETS = [
  {
    key: 'estudiante',
    label: 'Estudiante',
    description: 'Experiencia general de alumno.',
    icon: 'bi-person-fill',
    accent: '#22c55e',
    shell: 'student',
    homeView: 'view-dashboard',
    profile: {
      role: 'student',
      tipoUsuario: 'estudiante',
      permissions: {},
      allowedViews: [],
      department: '',
      specialty: '',
      especialidad: '',
      departmentConfig: null
    }
  },
  {
    key: 'docente',
    label: 'Docente',
    description: 'Experiencia alumno, con Aula en modo admin.',
    icon: 'bi-easel2-fill',
    accent: '#3b82f6',
    shell: 'student',
    homeView: 'view-dashboard',
    profile: {
      role: 'docente',
      tipoUsuario: 'docente',
      permissions: { aula: 'admin' },
      allowedViews: [...STUDENT_VIEWS],
      department: 'aula',
      specialty: '',
      especialidad: '',
      departmentConfig: { label: 'Docente' }
    }
  },
  {
    key: 'jefe_division',
    label: 'Jefe de division',
    description: 'Solo Eventos en modo admin.',
    icon: 'bi-diagram-3-fill',
    accent: '#14b8a6',
    shell: 'admin',
    homeView: 'view-foro',
    profile: {
      role: 'department_admin',
      tipoUsuario: 'administrativo',
      permissions: { foro: 'admin' },
      allowedViews: ['view-foro'],
      department: 'jefe_division',
      specialty: '',
      especialidad: '',
      departmentConfig: { label: 'Jefe de division' }
    }
  },
  {
    key: 'cafeteria',
    label: 'Cafeteria',
    description: 'Operacion administrativa de cafeteria.',
    icon: 'bi-cup-hot-fill',
    accent: '#f97316',
    shell: 'admin',
    homeView: 'view-cafeteria',
    profile: {
      role: 'department_admin',
      tipoUsuario: 'administrativo',
      permissions: { cafeteria: 'admin' },
      allowedViews: ['view-cafeteria'],
      department: 'cafeteria',
      specialty: '',
      especialidad: '',
      departmentConfig: { label: 'Cafeteria' }
    }
  },
  {
    key: 'biblioteca',
    label: 'Biblioteca',
    description: 'Administracion completa de biblioteca.',
    icon: 'bi-book-half',
    accent: '#f59e0b',
    shell: 'admin',
    homeView: 'view-biblio',
    profile: {
      role: 'department_admin',
      tipoUsuario: 'administrativo',
      permissions: { biblio: 'admin' },
      allowedViews: ['view-biblio'],
      department: 'biblioteca',
      specialty: '',
      especialidad: '',
      departmentConfig: { label: 'Biblioteca' }
    }
  },
  {
    key: 'servicio_medico',
    label: 'Servicio medico',
    description: 'Panel medico administrativo.',
    icon: 'bi-hospital-fill',
    accent: '#ef4444',
    shell: 'admin',
    homeView: 'view-medi',
    profile: {
      role: 'department_admin',
      tipoUsuario: 'administrativo',
      permissions: { medi: 'admin' },
      allowedViews: ['view-medi'],
      department: 'servicios_medicos',
      specialty: 'medico',
      especialidad: 'medico',
      departmentConfig: { label: 'Servicio medico' }
    }
  },
  {
    key: 'atencion_psicopedagogica',
    label: 'Atencion psicopedagogica',
    description: 'Panel medico con perfil psicologo.',
    icon: 'bi-heart-pulse-fill',
    accent: '#8b5cf6',
    shell: 'admin',
    homeView: 'view-medi',
    profile: {
      role: 'department_admin',
      tipoUsuario: 'administrativo',
      permissions: { medi: 'psicologo' },
      allowedViews: ['view-medi'],
      department: 'atencion_psicopedagogica',
      specialty: 'psicologo',
      especialidad: 'psicologo',
      departmentConfig: { label: 'Atencion psicopedagogica' }
    }
  },
  {
    key: 'calidad',
    label: 'Calidad',
    description: 'Lactario, Quejas y Encuestas en admin.',
    icon: 'bi-patch-check-fill',
    accent: '#ec4899',
    shell: 'admin',
    homeView: 'view-dashboard',
    profile: {
      role: 'department_admin',
      tipoUsuario: 'administrativo',
      permissions: { lactario: 'admin', quejas: 'admin', encuestas: 'admin' },
      allowedViews: ['view-dashboard', 'view-lactario', 'view-quejas', 'view-encuestas'],
      department: 'calidad',
      specialty: '',
      especialidad: '',
      departmentConfig: { label: 'Calidad' }
    }
  },
  {
    key: 'difusion',
    label: 'Difusion',
    description: 'Eventos superadmin y Avisos admin.',
    icon: 'bi-megaphone-fill',
    accent: '#10b981',
    shell: 'admin',
    homeView: 'view-dashboard',
    profile: {
      role: 'department_admin',
      tipoUsuario: 'administrativo',
      permissions: { foro: 'superadmin', avisos: 'admin' },
      allowedViews: ['view-dashboard', 'view-foro', 'view-avisos'],
      department: 'difusion',
      specialty: '',
      especialidad: '',
      departmentConfig: { label: 'Difusion' }
    }
  },
  {
    key: 'desarrollo_academico',
    label: 'Desarrollo academico',
    description: 'Reportes en modo admin.',
    icon: 'bi-graph-up-arrow',
    accent: '#6366f1',
    shell: 'admin',
    homeView: 'view-reportes',
    profile: {
      role: 'department_admin',
      tipoUsuario: 'administrativo',
      permissions: { reportes: 'admin' },
      allowedViews: ['view-reportes'],
      department: 'desarrollo_academico',
      specialty: '',
      especialidad: '',
      departmentConfig: { label: 'Desarrollo academico' }
    }
  },
  {
    key: 'superadmin',
    label: 'Superadmin',
    description: 'Acceso total al sistema.',
    icon: 'bi-shield-lock-fill',
    accent: '#f43f5e',
    shell: 'admin',
    homeView: 'view-superadmin-dashboard',
    profile: {
      role: 'superadmin',
      tipoUsuario: 'administrativo',
      permissions: {
        aula: 'admin',
        comunidad: 'admin',
        medi: 'admin',
        biblio: 'admin',
        foro: 'superadmin',
        cafeteria: 'admin',
        lactario: 'admin',
        quejas: 'admin',
        encuestas: 'admin',
        reportes: 'admin',
        vocacional: 'admin',
        avisos: 'admin'
      },
      allowedViews: [...ALL_ADMIN_VIEWS],
      department: 'superadmin',
      specialty: '',
      especialidad: '',
      departmentConfig: { label: 'Superadmin' }
    }
  }
];

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

export class DevTools extends HTMLElement {
  constructor() {
    super();
    this.isOpen = false;
    this.busyKey = '';
    this._boundSync = this.sync.bind(this);
    this._boundOutside = this.handleOutsideClick.bind(this);
    this._boundRootClick = this.handleRootClick.bind(this);
  }

  connectedCallback() {
    this.addEventListener('click', this._boundRootClick);
    document.addEventListener('click', this._boundOutside);
    Store.on('user-changed', this._boundSync);
    Store.on('cleared', this._boundSync);
    window.addEventListener('sia-profile-ready', this._boundSync);
    window.addEventListener('sia-view-changed', this._boundSync);
    window.addEventListener('storage', this._boundSync);
    this.sync();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._boundRootClick);
    document.removeEventListener('click', this._boundOutside);
    Store.off('user-changed', this._boundSync);
    Store.off('cleared', this._boundSync);
    window.removeEventListener('sia-profile-ready', this._boundSync);
    window.removeEventListener('sia-view-changed', this._boundSync);
    window.removeEventListener('storage', this._boundSync);
  }

  isDevMode() {
    return localStorage.getItem('sia_dev_mode') === 'true' || window.SIA_DEV_MODE === true;
  }

  getProfile() {
    return window.SIA?.getActiveProfile?.() || Store.userProfile || null;
  }

  getCurrentView() {
    return Store.currentView || 'view-dashboard';
  }

  getPreset(key) {
    return ROLE_PRESETS.find((preset) => preset.key === key) || null;
  }

  getActivePresetKey(profile = this.getProfile()) {
    return profile?.devSimulation?.key || '';
  }

  getAllowedViews(profile = this.getProfile()) {
    const views = window.SIA?.getEffectiveAllowedViews?.(profile) || [];
    return [...new Set(views)];
  }

  getQuickViews(profile = this.getProfile()) {
    const views = this.getAllowedViews(profile);
    const ordered = [
      'view-superadmin-dashboard',
      'view-dashboard',
      ...views
    ];

    return [...new Set(ordered)].filter((viewId) => VIEW_META[viewId] && window.SIA?.canAccessView?.(profile, viewId));
  }

  getStatusLabel(profile = this.getProfile()) {
    if (!profile) return 'Sin sesion';
    if (profile.devSimulation?.label) return `Simulando ${profile.devSimulation.label}`;
    return `Perfil real: ${profile.role || 'student'}`;
  }

  getViewLabel(viewId) {
    return VIEW_META[viewId]?.label || viewId;
  }

  getViewIcon(viewId) {
    return VIEW_META[viewId]?.icon || 'bi-grid-1x2-fill';
  }

  handleOutsideClick(event) {
    if (!this.isOpen || this.contains(event.target)) return;
    this.isOpen = false;
    this.render();
  }

  handleRootClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      const action = actionButton.dataset.action;
      if (action === 'toggle') {
        event.stopPropagation();
        this.isOpen = !this.isOpen;
        this.render();
        return;
      }

      if (action === 'close') {
        this.isOpen = false;
        this.render();
        return;
      }

      if (action === 'restore-real') {
        void this.restoreRealProfile();
        return;
      }

      if (action === 'go-home') {
        const profile = this.getProfile();
        const homeView = window.SIA?.getHomeView?.(profile) || 'view-dashboard';
        this.isOpen = false;
        this.render();
        window.SIA?.navigate?.(homeView);
        return;
      }
    }

    const presetButton = event.target.closest('[data-preset]');
    if (presetButton) {
      void this.applyPreset(presetButton.dataset.preset);
      return;
    }

    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      const viewId = viewButton.dataset.view;
      if (!viewId) return;
      this.isOpen = false;
      this.render();
      window.SIA?.navigate?.(viewId);
    }
  }

  buildSimulationPayload(preset) {
    return {
      ...cloneValue(preset.profile),
      devSimulation: {
        key: preset.key,
        label: preset.label,
        shell: preset.shell || 'admin',
        homeView: preset.homeView || '',
        description: preset.description || '',
        appliedAt: Date.now()
      }
    };
  }

  async applyPreset(presetKey) {
    if (this.busyKey) return;

    const preset = this.getPreset(presetKey);
    if (!preset) return;

    if (!Store.user) {
      window.showToast?.('Debes iniciar sesion primero para simular un rol.', 'warning');
      return;
    }

    this.busyKey = `preset:${preset.key}`;
    this.render();

    try {
      const result = await window.SIA?.applyDevProfileSimulation?.(
        this.buildSimulationPayload(preset),
        {
          viewId: preset.homeView || '',
          keepCurrentView: true
        }
      );

      const synced = result?.backendSynced !== false;
      window.showToast?.(
        synced
          ? `Modo ${preset.label} activo.`
          : `Modo ${preset.label} activo localmente. Firestore no se sincronizo.`,
        synced ? 'success' : 'warning'
      );
      this.isOpen = false;
    } catch (error) {
      console.error('[DevTools] Error applying preset:', error);
      window.showToast?.(error?.message || 'No se pudo aplicar el rol de desarrollo.', 'danger');
    } finally {
      this.busyKey = '';
      this.sync();
    }
  }

  async restoreRealProfile() {
    if (this.busyKey) return;

    this.busyKey = 'restore-real';
    this.render();

    try {
      const result = await window.SIA?.clearDevProfileSimulation?.({
        restoreBackend: true
      });

      const synced = result?.backendSynced !== false;
      window.showToast?.(
        synced
          ? 'Perfil real restaurado.'
          : 'Perfil real restaurado localmente. Firestore no se sincronizo.',
        synced ? 'success' : 'warning'
      );
      this.isOpen = false;
    } catch (error) {
      console.error('[DevTools] Error restoring profile:', error);
      window.showToast?.(error?.message || 'No se pudo restaurar el perfil real.', 'danger');
    } finally {
      this.busyKey = '';
      this.sync();
    }
  }

  render() {
    if (!this.isDevMode()) {
      this.style.display = 'none';
      this.innerHTML = '';
      return;
    }

    const profile = this.getProfile();
    const activePresetKey = this.getActivePresetKey(profile);
    const currentView = this.getCurrentView();
    const quickViews = this.getQuickViews(profile);
    const currentPreset = this.getPreset(activePresetKey);
    const shellLabel = profile?.devSimulation?.shell === 'student'
      ? 'Student shell'
      : (profile ? 'Admin shell' : '--');
    const busy = Boolean(this.busyKey);
    const statusLabel = this.getStatusLabel(profile);

    this.style.display = 'block';
    this.innerHTML = `
      <style>
        .sia-devtools {
          position: fixed;
          right: 1rem;
          bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
          z-index: 1106;
          font-family: "Noto Sans", system-ui, sans-serif;
        }
        .sia-devtools__fab {
          border: 0;
          border-radius: 999px;
          min-width: 68px;
          padding: 0.82rem 1rem;
          display: inline-flex;
          align-items: center;
          gap: 0.7rem;
          background: linear-gradient(135deg, #020617 0%, #0f766e 52%, #f97316 100%);
          color: #fff;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.32);
          font-weight: 800;
          letter-spacing: 0.01em;
        }
        .sia-devtools__fab small {
          display: block;
          font-size: 0.66rem;
          opacity: 0.78;
          line-height: 1.05;
        }
        .sia-devtools__fab span {
          display: block;
          font-size: 0.82rem;
          line-height: 1.05;
          text-align: left;
        }
        .sia-devtools__panel {
          width: min(430px, calc(100vw - 1.5rem));
          margin: 0 0 0.75rem auto;
          border-radius: 1.35rem;
          border: 1px solid rgba(148, 163, 184, 0.22);
          overflow: hidden;
          background:
            radial-gradient(circle at top left, rgba(16, 185, 129, 0.18), transparent 36%),
            radial-gradient(circle at top right, rgba(249, 115, 22, 0.2), transparent 30%),
            rgba(2, 6, 23, 0.96);
          color: #e2e8f0;
          box-shadow: 0 24px 56px rgba(2, 6, 23, 0.42);
          backdrop-filter: blur(18px);
        }
        .sia-devtools__header {
          padding: 1rem 1rem 0.8rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
        }
        .sia-devtools__eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.32rem 0.7rem;
          border-radius: 999px;
          background: rgba(14, 165, 233, 0.16);
          color: #7dd3fc;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .sia-devtools__title {
          margin: 0.72rem 0 0.2rem;
          font-size: 1rem;
          font-weight: 800;
        }
        .sia-devtools__subtitle {
          margin: 0;
          font-size: 0.76rem;
          line-height: 1.35;
          color: rgba(226, 232, 240, 0.74);
        }
        .sia-devtools__close {
          border: 0;
          background: transparent;
          color: rgba(226, 232, 240, 0.82);
          padding: 0.2rem;
        }
        .sia-devtools__body {
          padding: 0.95rem 1rem 1rem;
          max-height: min(74vh, calc(100vh - 152px));
          overflow-y: auto;
        }
        .sia-devtools__section + .sia-devtools__section {
          margin-top: 0.95rem;
        }
        .sia-devtools__section-title {
          margin: 0 0 0.55rem;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(226, 232, 240, 0.54);
        }
        .sia-devtools__meta-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.55rem;
        }
        .sia-devtools__meta-card {
          padding: 0.72rem;
          border-radius: 0.95rem;
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(15, 23, 42, 0.56);
        }
        .sia-devtools__meta-card strong {
          display: block;
          font-size: 0.7rem;
          color: rgba(226, 232, 240, 0.56);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 0.3rem;
        }
        .sia-devtools__meta-card span {
          display: block;
          font-size: 0.8rem;
          font-weight: 700;
          color: #f8fafc;
        }
        .sia-devtools__preset-list {
          display: grid;
          gap: 0.6rem;
        }
        .sia-devtools__preset {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 1rem;
          background: rgba(15, 23, 42, 0.58);
          color: inherit;
          text-align: left;
          padding: 0.82rem 0.9rem;
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 0.8rem;
          align-items: center;
          transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        }
        .sia-devtools__preset:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(125, 211, 252, 0.38);
        }
        .sia-devtools__preset:disabled {
          opacity: 0.64;
          cursor: wait;
        }
        .sia-devtools__preset.is-active {
          border-color: rgba(253, 186, 116, 0.68);
          background: linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(249, 115, 22, 0.18));
        }
        .sia-devtools__preset-icon {
          width: 2.6rem;
          height: 2.6rem;
          border-radius: 0.9rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 1.15rem;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
        }
        .sia-devtools__preset-copy strong {
          display: block;
          font-size: 0.84rem;
          margin-bottom: 0.18rem;
        }
        .sia-devtools__preset-copy span {
          display: block;
          font-size: 0.73rem;
          color: rgba(226, 232, 240, 0.74);
          line-height: 1.3;
        }
        .sia-devtools__preset-badge {
          font-size: 0.68rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(226, 232, 240, 0.52);
        }
        .sia-devtools__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
        }
        .sia-devtools__chip {
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.58);
          color: #f8fafc;
          padding: 0.52rem 0.82rem;
          font-size: 0.74rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 0.42rem;
        }
        .sia-devtools__chip.is-current {
          background: rgba(20, 184, 166, 0.16);
          border-color: rgba(45, 212, 191, 0.34);
        }
        .sia-devtools__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
        }
        .sia-devtools__action {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 999px;
          background: rgba(30, 41, 59, 0.82);
          color: #f8fafc;
          padding: 0.56rem 0.9rem;
          font-size: 0.74rem;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
        }
        .sia-devtools__notice {
          padding: 0.82rem 0.9rem;
          border-radius: 1rem;
          border: 1px dashed rgba(148, 163, 184, 0.25);
          background: rgba(15, 23, 42, 0.44);
          color: rgba(226, 232, 240, 0.74);
          font-size: 0.78rem;
          line-height: 1.42;
        }
        @media (max-width: 767.98px) {
          .sia-devtools {
            right: 0.75rem;
            left: 0.75rem;
          }
          .sia-devtools__panel {
            width: min(100%, 390px);
          }
          .sia-devtools__fab {
            margin-left: auto;
            display: flex;
          }
          .sia-devtools__meta-grid {
            grid-template-columns: 1fr;
          }
          .sia-devtools__preset {
            grid-template-columns: auto 1fr;
          }
          .sia-devtools__preset-badge {
            grid-column: 2 / 3;
          }
        }
      </style>
      <div class="sia-devtools">
        ${this.isOpen ? `
          <section class="sia-devtools__panel">
            <div class="sia-devtools__header">
              <div class="d-flex justify-content-between align-items-start gap-3">
                <div>
                  <span class="sia-devtools__eyebrow">
                    <i class="bi bi-bezier2"></i>
                    SIA Dev
                  </span>
                  <h3 class="sia-devtools__title">${statusLabel}</h3>
                  <p class="sia-devtools__subtitle">
                    ${profile
                      ? `${profile.displayName || 'Usuario'} · ${profile.role || 'student'}`
                      : 'Inicia sesion para simular roles y navegar sin recargar.'}
                  </p>
                </div>
                <button type="button" class="sia-devtools__close" data-action="close" aria-label="Cerrar devtools">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>
            </div>
            <div class="sia-devtools__body">
              <section class="sia-devtools__section">
                <div class="sia-devtools__meta-grid">
                  <div class="sia-devtools__meta-card">
                    <strong>Rol</strong>
                    <span>${profile?.role || '--'}</span>
                  </div>
                  <div class="sia-devtools__meta-card">
                    <strong>Shell</strong>
                    <span>${shellLabel}</span>
                  </div>
                  <div class="sia-devtools__meta-card">
                    <strong>Vista</strong>
                    <span>${this.getViewLabel(currentView)}</span>
                  </div>
                </div>
              </section>

              <section class="sia-devtools__section">
                <p class="sia-devtools__section-title">Perfiles simulados</p>
                ${Store.user ? `
                  <div class="sia-devtools__preset-list">
                    ${ROLE_PRESETS.map((preset) => {
                      const isActive = preset.key === activePresetKey;
                      const isBusy = this.busyKey === `preset:${preset.key}`;
                      return `
                        <button
                          type="button"
                          class="sia-devtools__preset ${isActive ? 'is-active' : ''}"
                          data-preset="${preset.key}"
                          ${busy ? 'disabled' : ''}
                        >
                          <span class="sia-devtools__preset-icon" style="background:${preset.accent};">
                            <i class="bi ${preset.icon}"></i>
                          </span>
                          <span class="sia-devtools__preset-copy">
                            <strong>${preset.label}</strong>
                            <span>${preset.description}</span>
                          </span>
                          <span class="sia-devtools__preset-badge">${isBusy ? 'Aplicando...' : (isActive ? 'Activo' : 'Aplicar')}</span>
                        </button>
                      `;
                    }).join('')}
                  </div>
                ` : `
                  <div class="sia-devtools__notice">
                    Necesitas una sesion activa para aplicar los perfiles de desarrollo.
                  </div>
                `}
              </section>

              <section class="sia-devtools__section">
                <p class="sia-devtools__section-title">Vistas rapidas</p>
                ${profile && quickViews.length ? `
                  <div class="sia-devtools__chips">
                    ${quickViews.map((viewId) => `
                      <button
                        type="button"
                        class="sia-devtools__chip ${viewId === currentView ? 'is-current' : ''}"
                        data-view="${viewId}"
                      >
                        <i class="bi ${this.getViewIcon(viewId)}"></i>
                        ${this.getViewLabel(viewId)}
                      </button>
                    `).join('')}
                  </div>
                ` : `
                  <div class="sia-devtools__notice">
                    El selector de vistas se activa en cuanto haya un perfil cargado.
                  </div>
                `}
              </section>

              <section class="sia-devtools__section">
                <p class="sia-devtools__section-title">Acciones</p>
                <div class="sia-devtools__actions">
                  <button type="button" class="sia-devtools__action" data-action="go-home" ${!profile ? 'disabled' : ''}>
                    <i class="bi bi-house-door-fill"></i>
                    Ir al home
                  </button>
                  ${profile?.devSimulation?.key ? `
                    <button type="button" class="sia-devtools__action" data-action="restore-real" ${busy ? 'disabled' : ''}>
                      <i class="bi bi-arrow-counterclockwise"></i>
                      Restaurar perfil real
                    </button>
                  ` : ''}
                </div>
                ${currentPreset ? `
                  <div class="sia-devtools__notice mt-3">
                    Preset activo: <strong>${currentPreset.label}</strong>. Si cambias a otra vista del mismo preset, el router vuelve a montar el modulo correspondiente sin necesitar refresh.
                  </div>
                ` : `
                  <div class="sia-devtools__notice mt-3">
                    No hay simulacion activa. El FAB puede montar un rol, recalcular shell y recargar la vista correcta al vuelo.
                  </div>
                `}
              </section>
            </div>
          </section>
        ` : ''}

        <button type="button" class="sia-devtools__fab" data-action="toggle" aria-expanded="${this.isOpen ? 'true' : 'false'}">
          <i class="bi bi-terminal-fill fs-5"></i>
          <div>
            <small>DEV</small>
            <span>${profile?.devSimulation?.label || 'Perfiles y vistas'}</span>
          </div>
        </button>
      </div>
    `;
  }

  sync() {
    this.render();
  }
}

if (!customElements.get('sia-dev-tools')) {
  customElements.define('sia-dev-tools', DevTools);
}
