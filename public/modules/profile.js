// modules/profile.js
// Centro personal del usuario para cuenta, salud, contexto y actividad real.

if (!window.Profile) {
  window.Profile = (function () {
    let _ctx = null;
    let _isEditing = false;
    let _boundViewEl = null;
    let _delegatedInputHandler = null;
    let _delegatedChangeHandler = null;
    let _activeTabId = 'tab-summary';
    let _currentBanner = 'gradient-1';
    let _pushBusy = false;
    let _hasChanges = false;

    const MODULE_ID = 'view-profile';
    const TAB_STATE_KEY = 'active_tab';
    const PROFILE_TAB_LABELS = Object.freeze({
      'tab-summary': 'Resumen',
      'tab-account': 'Cuenta',
      'tab-health': 'Salud',
      'tab-context': 'Contexto',
      'tab-preferences': 'Preferencias',
      'tab-activity': 'Actividad'
    });

    const BANNERS = {
      'gradient-1': 'linear-gradient(135deg, #1b396a 0%, #0d6efd 100%)',
      'gradient-2': 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
      'gradient-3': 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)',
      'gradient-4': 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)',
      'solid-dark': '#2c3e50',
      'gradient-5': 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
      'gradient-6': 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
      'gradient-7': 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)'
    };

    const BANNER_BGS = {
      'gradient-1': 'rgba(13, 110, 253, 0.08)',
      'gradient-2': 'rgba(37, 117, 252, 0.08)',
      'gradient-3': 'rgba(255, 8, 68, 0.08)',
      'gradient-4': 'rgba(11, 163, 96, 0.08)',
      'solid-dark': 'rgba(44, 62, 80, 0.08)',
      'gradient-5': 'rgba(247, 151, 30, 0.08)',
      'gradient-6': 'rgba(0, 198, 255, 0.10)',
      'gradient-7': 'rgba(238, 9, 121, 0.08)'
    };

    const VIEW_LABELS = {
      'view-dashboard': 'Dashboard',
      'view-profile': 'Perfil',
      'view-medi': 'Medi',
      'view-biblio': 'Biblioteca',
      'view-aula': 'Aula',
      'view-foro': 'Eventos',
      'view-cafeteria': 'Cafeteria',
      'view-encuestas': 'Encuestas',
      'view-quejas': 'Calidad',
      'view-lactario': 'Lactario',
      'view-notificaciones': 'Notificaciones',
      'view-reportes': 'Reportes',
      'view-superadmin-dashboard': 'SuperAdmin',
      'view-vocacional-admin': 'Vocacional'
    };

    function normalizeCtx(ctx) {
      const profile = ctx?.currentUserProfile || ctx?.profile || window.SIA?.currentUserProfile || null;
      return {
        ...(ctx || {}),
        db: ctx?.db || window.SIA?.db || null,
        auth: ctx?.auth || window.SIA?.auth || null,
        storage: ctx?.storage || window.SIA?.storage || null,
        profile,
        currentUserProfile: profile
      };
    }

    function getCurrentProfile() {
      return _ctx?.currentUserProfile || _ctx?.profile || window.SIA?.currentUserProfile || null;
    }

    function getServiceCtx() {
      const profile = getCurrentProfile();
      return normalizeCtx({
        ..._ctx,
        profile,
        currentUserProfile: profile
      });
    }

    function getPrefs(profile) {
      return profile?.prefs || profile?.preferences || {};
    }

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function normalizeText(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    }

    function getAny(source, keys, fallback = '') {
      if (!source) return fallback;
      const list = Array.isArray(keys) ? keys : [keys];
      for (const key of list) {
        if (source[key] !== undefined && source[key] !== null && String(source[key]).trim() !== '') {
          return source[key];
        }
      }
      return fallback;
    }

    function applyNestedValue(target, path, value) {
      if (!target || !path) return;
      const segments = String(path).split('.');
      let cursor = target;
      while (segments.length > 1) {
        const key = segments.shift();
        if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
        cursor = cursor[key];
      }
      cursor[segments[0]] = value;
    }

    function applyProfileUpdates(profile, updates) {
      if (!profile || !updates) return;
      Object.entries(updates).forEach(([path, value]) => applyNestedValue(profile, path, value));
      if (profile.prefs) profile.preferences = profile.prefs;
    }

    function isStudentProfile(profile) {
      return profile?.role === 'student';
    }

    function buildDependentsLabel(qty) {
      return qty > 0 ? `Si (${qty})` : 'No';
    }

    function parseDependentsQty(qtyValue, labelValue) {
      const numericQty = parseInt(qtyValue, 10);
      if (!Number.isNaN(numericQty) && numericQty >= 0) return numericQty;
      const label = String(labelValue || '');
      const match = label.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    }

    function normalizeDisabilityList(value) {
      if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
      }
      return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item && normalizeText(item) !== 'ninguna');
    }

    function formatDisabilityValue(value) {
      const list = normalizeDisabilityList(value);
      return list.length ? list.join(', ') : '';
    }

    function getPrimaryEmergencyContact(profile) {
      const hd = profile?.healthData || {};
      const contacts = Array.isArray(hd.contactos) ? hd.contactos : [];
      const first = contacts[0] || {};
      return {
        nombre: first.nombre || profile?.contactoEmergenciaName || hd.contactoEmergencia || '',
        parentesco: first.parentesco || '',
        telefono: first.telefono || profile?.contactoEmergenciaTel || hd.contactoEmergenciaTel || ''
      };
    }

    function toDate(value) {
      if (!value) return null;
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
      if (typeof value?.toDate === 'function') {
        const fromMethod = value.toDate();
        return Number.isNaN(fromMethod?.getTime?.()) ? null : fromMethod;
      }
      if (typeof value?.seconds === 'number') {
        const fromSeconds = new Date(value.seconds * 1000);
        return Number.isNaN(fromSeconds.getTime()) ? null : fromSeconds;
      }
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function formatDateDisplay(value, withTime = false) {
      const date = toDate(value);
      if (!date) return 'Sin dato';
      return date.toLocaleDateString('es-MX', withTime
        ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
        : { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function formatInputDate(value) {
      const date = toDate(value);
      return date ? date.toISOString().slice(0, 10) : '';
    }

    function formatRelativeTime(value) {
      const date = toDate(value);
      if (!date) return 'Sin registro';
      const diffMs = date.getTime() - Date.now();
      const diffMinutes = Math.round(diffMs / 60000);
      const absMinutes = Math.abs(diffMinutes);
      if (absMinutes < 1) return 'justo ahora';
      if (absMinutes < 60) return diffMinutes < 0 ? `hace ${absMinutes} min` : `en ${absMinutes} min`;
      const diffHours = Math.round(diffMinutes / 60);
      const absHours = Math.abs(diffHours);
      if (absHours < 24) return diffHours < 0 ? `hace ${absHours} h` : `en ${absHours} h`;
      const diffDays = Math.round(diffHours / 24);
      const absDays = Math.abs(diffDays);
      if (absDays < 30) return diffDays < 0 ? `hace ${absDays} dia${absDays === 1 ? '' : 's'}` : `en ${absDays} dia${absDays === 1 ? '' : 's'}`;
      return formatDateDisplay(date);
    }

    function getThemeSelection(prefs) {
      return prefs.theme || localStorage.getItem('sia:theme') || 'system';
    }

    function applyThemePreference(theme) {
      const selectedTheme = theme || 'system';
      const resolvedTheme = selectedTheme === 'system'
        ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : selectedTheme;

      if (typeof window.applyTheme === 'function') window.applyTheme(resolvedTheme, selectedTheme !== 'system');
      else document.documentElement.setAttribute('data-bs-theme', resolvedTheme);

      if (selectedTheme === 'system') localStorage.removeItem('sia:theme');
      else localStorage.setItem('sia:theme', selectedTheme);
    }

    function applyBannerVisual(bannerId) {
      const resolvedBanner = BANNERS[bannerId] ? bannerId : 'gradient-1';
      _currentBanner = resolvedBanner;
      const cover = document.getElementById('prof-cover-container');
      if (cover) cover.style.background = BANNERS[resolvedBanner];
      const mainContainer = document.getElementById('profile-main-container');
      if (mainContainer && BANNER_BGS[resolvedBanner]) mainContainer.style.backgroundColor = BANNER_BGS[resolvedBanner];
      document.querySelectorAll('#prof-banner-selector [data-banner]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.banner === resolvedBanner);
      });
    }

    function humanizeToken(value, fallback = 'Sin dato') {
      const clean = String(value || '').trim();
      if (!clean) return fallback;
      return clean
        .replace(/^view-/, '')
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function getDepartmentLabel(profile) {
      return profile?.departmentConfig?.label
        || profile?.departmentLabel
        || profile?.department
        || profile?.especialidad
        || profile?.specialty
        || '';
    }

    function getDisplayRole(profile) {
      if (!profile) return 'Usuario';
      if (isStudentProfile(profile)) return 'Estudiante';
      return getDepartmentLabel(profile) || humanizeToken(profile.role, 'Usuario');
    }

    function getIdentifierLabel(profile) {
      return isStudentProfile(profile) ? 'No. de control' : 'Identificador';
    }

    function getIdentifierValue(profile) {
      if (!profile) return 'Sin dato';
      if (isStudentProfile(profile)) return profile.matricula || profile.uid || 'Sin dato';
      return profile.numeroEmpleado || profile.matricula || profile.uid || 'Sin dato';
    }

    function getInstitutionalEmail(profile) {
      return profile?.emailInstitucional || profile?.email || '';
    }

    function getAccessViews(profile) {
      if (typeof window.SIA?.getEffectiveAllowedViews === 'function') return window.SIA.getEffectiveAllowedViews(profile) || [];
      return Array.isArray(profile?.allowedViews) ? profile.allowedViews : [];
    }

    function getViewLabel(viewId) {
      return VIEW_LABELS[viewId] || humanizeToken(viewId, 'Vista');
    }

    function getHomeViewId(profile) {
      if (typeof window.SIA?.getHomeView === 'function') return window.SIA.getHomeView(profile);
      const allowed = getAccessViews(profile);
      return allowed.includes('view-dashboard') ? 'view-dashboard' : (allowed[0] || 'view-dashboard');
    }

    function getPermissionLabels(profile) {
      const permissions = profile?.permissions || {};
      return Object.entries(permissions)
        .filter(([, value]) => value && String(value).trim())
        .map(([key, value]) => `${humanizeToken(key)}: ${humanizeToken(value)}`);
    }

    function renderChips(items, emptyLabel) {
      const values = Array.isArray(items) ? items.filter(Boolean) : [];
      if (!values.length) return `<span class="profile-chip profile-chip--muted">${escapeHtml(emptyLabel || 'Sin datos')}</span>`;
      return values.map((value) => `<span class="profile-chip">${escapeHtml(value)}</span>`).join('');
    }

    function buildProfileAlerts(profile) {
      const alerts = [];
      const hd = profile?.healthData || {};
      const contact = getPrimaryEmergencyContact(profile);
      const isStudent = isStudentProfile(profile);

      if (!(profile?.tipoSangre || hd?.tipoSangre)) alerts.push({ tone: 'critical', title: 'Falta tu tipo de sangre', body: 'Es el dato mas importante para Medi y el SOS del dashboard.', tabId: 'tab-health', fieldId: 'prof-blood', actionLabel: 'Completar salud' });
      if (!contact.telefono) alerts.push({ tone: 'critical', title: 'Falta un telefono de emergencia', body: 'Tu panel de emergencia no tiene a quien llamar si ocurre una urgencia.', tabId: 'tab-health', fieldId: 'prof-emergency-tel1', actionLabel: 'Agregar contacto' });
      if (!contact.nombre) alerts.push({ tone: 'warning', title: 'Tu contacto principal no tiene nombre', body: 'Agrega a una persona responsable y reconocible para contacto rapido.', tabId: 'tab-health', fieldId: 'prof-emergency-name1', actionLabel: 'Definir contacto' });
      if (!(hd?.seguroTipo || profile?.seguro)) alerts.push({ tone: 'warning', title: 'No has indicado tu seguro', body: 'Aunque sea particular, conviene dejarlo visible para una mejor atencion.', tabId: 'tab-health', fieldId: 'prof-insurance', actionLabel: 'Actualizar salud' });
      if (!profile?.telefono) alerts.push({ tone: 'warning', title: 'Falta tu telefono personal', body: 'Sirve para contacto rapido y validacion de distintos flujos del sistema.', tabId: 'tab-account', fieldId: 'prof-phone', actionLabel: 'Actualizar cuenta' });
      if (!profile?.emailPersonal) alerts.push({ tone: 'info', title: 'Agrega un correo personal de respaldo', body: 'Te da una segunda via de contacto fuera del correo institucional.', tabId: 'tab-account', fieldId: 'prof-personal-email', actionLabel: 'Agregar correo' });
      if (!profile?.fechaNacimiento) alerts.push({ tone: 'info', title: 'Confirma tu fecha de nacimiento', body: 'Ayuda a reportes, expedientes y atencion contextualizada.', tabId: 'tab-account', fieldId: 'prof-birthdate', actionLabel: 'Completar cuenta' });
      if (isStudent && !profile?.turno) alerts.push({ tone: 'info', title: 'Tu turno academico no esta visible', body: 'Este dato mejora el contexto operativo en reportes y atenciones del campus.', tabId: 'tab-context', fieldId: 'prof-shift', actionLabel: 'Actualizar contexto' });
      if (!isStudent && !(profile?.cubiculo || profile?.extension || profile?.areaAdscripcion)) alerts.push({ tone: 'info', title: 'Completa tu ubicacion operativa', body: 'Cubiculo, extension o area facilitan localizacion y coordinacion interna.', tabId: 'tab-context', fieldId: 'prof-area', actionLabel: 'Completar contexto' });

      const priority = { critical: 0, warning: 1, info: 2 };
      return alerts.sort((a, b) => priority[a.tone] - priority[b.tone]).slice(0, 5);
    }

    function computeProfileStats(profile) {
      const pd = profile?.personalData || {};
      const hd = profile?.healthData || {};
      const contact = getPrimaryEmergencyContact(profile);
      const completionChecks = [
        Boolean(profile?.displayName),
        Boolean(getInstitutionalEmail(profile)),
        Boolean(profile?.telefono),
        Boolean(profile?.emailPersonal),
        Boolean(profile?.fechaNacimiento),
        Boolean(pd?.domicilio || profile?.domicilio),
        Boolean(profile?.photoURL),
        Boolean(isStudentProfile(profile) ? profile?.carrera : (getDepartmentLabel(profile) || profile?.areaAdscripcion)),
        Boolean(isStudentProfile(profile) ? profile?.turno : (profile?.cubiculo || profile?.extension))
      ];

      const emergencyChecks = [
        Boolean(profile?.tipoSangre || hd?.tipoSangre),
        Boolean(contact.nombre),
        Boolean(contact.telefono),
        Boolean(hd?.seguroTipo || profile?.seguro)
      ];

      const accessViews = getAccessViews(profile);
      return {
        completionPercent: Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100),
        emergencyPercent: Math.round((emergencyChecks.filter(Boolean).length / emergencyChecks.length) * 100),
        accessViews,
        accessCount: accessViews.length,
        permissionLabels: getPermissionLabels(profile),
        homeViewId: getHomeViewId(profile),
        alerts: buildProfileAlerts(profile)
      };
    }

    function buildActivityItems(profile) {
      const items = [];
      const pushItem = (dateValue, title, body, icon, tone = 'neutral') => {
        const date = toDate(dateValue);
        if (date) items.push({ date, title, body, icon, tone });
      };

      pushItem(profile?.updatedAt, 'Perfil actualizado', 'Se registraron cambios recientes en tu informacion personal.', 'bi-pencil-square', 'info');
      pushItem(profile?.lastLogin, 'Ultimo acceso', 'Este es el ultimo inicio de sesion visible en tu perfil.', 'bi-box-arrow-in-right', 'success');
      pushItem(profile?.createdAt, 'Cuenta creada', 'Tu expediente base quedo listo para usar servicios SIA.', 'bi-stars', 'accent');

      const notifications = Array.isArray(window.Notify?._allNotifs) ? window.Notify._allNotifs : [];
      notifications.slice(0, 5).forEach((notif) => {
        const icon = notif?.tipo === 'warning' ? 'bi-exclamation-circle' : (notif?.tipo === 'success' ? 'bi-check-circle' : 'bi-bell');
        pushItem(notif?.createdAt || notif?.fecha || notif?.timestamp || notif?.at, notif?.titulo || notif?.title || 'Notificacion', notif?.mensaje || notif?.body || notif?.texto || 'Movimiento registrado en SIA.', icon, 'neutral');
      });

      return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
    }

    function emitProfileReady(profile, source) {
      window.dispatchEvent(new CustomEvent('sia-profile-ready', {
        detail: { profile, source: source || 'profile' }
      }));
    }

    async function savePreferencePatch(partialPrefs) {
      const profile = getCurrentProfile();
      const uid = _ctx?.auth?.currentUser?.uid || profile?.uid || window.SIA?.auth?.currentUser?.uid;
      if (!uid) throw new Error('No se encontro una sesion activa.');

      if (typeof window.SIA?.updateUserPreferences === 'function') {
        await window.SIA.updateUserPreferences(uid, partialPrefs);
      } else if (window.ProfileService) {
        const prefUpdates = Object.fromEntries(
          Object.entries(partialPrefs || {})
            .filter(([key]) => String(key || '').trim())
            .map(([key, value]) => [`prefs.${String(key).trim()}`, value])
        );
        await window.ProfileService.updateProfile(getServiceCtx(), prefUpdates);
      }

      if (profile) {
        if (!profile.prefs) profile.prefs = getPrefs(profile);
        Object.assign(profile.prefs, partialPrefs || {});
        profile.preferences = profile.prefs;
      }
    }

    function setText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function setHTML(id, html) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    }

    function setVal(id, value) {
      const el = document.getElementById(id);
      if (el) el.value = value == null ? '' : value;
    }

    function getVal(id) {
      const el = document.getElementById(id);
      return el ? el.value : '';
    }

    function getBannerMenuMarkup() {
      return `
        <div class="dropdown">
          <button class="btn btn-light text-primary btn-sm rounded-circle shadow" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Cambiar fondo">
            <i class="bi bi-palette-fill"></i>
          </button>
          <div class="dropdown-menu dropdown-menu-end p-3 shadow-lg border-0 rounded-4 profile-banner-menu">
            <div class="fw-bold small text-dark mb-2"><i class="bi bi-magic me-2"></i>Personalizar fondo</div>
            <div class="profile-banner-grid" id="prof-banner-selector">
              <button class="profile-banner-swatch active" type="button" style="background: linear-gradient(135deg, #1b396a 0%, #0d6efd 100%);" data-banner="gradient-1" title="Azul TecNM" onclick="Profile.selectBanner('gradient-1', true)"></button>
              <button class="profile-banner-swatch" type="button" style="background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);" data-banner="gradient-2" title="Azul Morado" onclick="Profile.selectBanner('gradient-2', true)"></button>
              <button class="profile-banner-swatch" type="button" style="background: linear-gradient(135deg, #ff0844 0%, #ffb199 100%);" data-banner="gradient-3" title="Fuego" onclick="Profile.selectBanner('gradient-3', true)"></button>
              <button class="profile-banner-swatch" type="button" style="background: linear-gradient(135deg, #0ba360 0%, #3cba92 100%);" data-banner="gradient-4" title="Bosque" onclick="Profile.selectBanner('gradient-4', true)"></button>
              <button class="profile-banner-swatch" type="button" style="background: #2c3e50;" data-banner="solid-dark" title="Solido oscuro" onclick="Profile.selectBanner('solid-dark', true)"></button>
              <button class="profile-banner-swatch" type="button" style="background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%);" data-banner="gradient-5" title="Sol" onclick="Profile.selectBanner('gradient-5', true)"></button>
              <button class="profile-banner-swatch" type="button" style="background: linear-gradient(135deg, #00c6ff 0%, #0072ff 100%);" data-banner="gradient-6" title="Cielo" onclick="Profile.selectBanner('gradient-6', true)"></button>
              <button class="profile-banner-swatch" type="button" style="background: linear-gradient(135deg, #ff6a00 0%, #ee0979 100%);" data-banner="gradient-7" title="Atardecer" onclick="Profile.selectBanner('gradient-7', true)"></button>
            </div>
          </div>
        </div>
      `;
    }

    function getSidebarMarkup() {
      return `
        <aside class="card border-0 shadow-sm rounded-4 profile-sidebar-card h-100">
          <div class="card-body p-4">
            <div class="position-relative d-inline-block mb-3">
              <div class="rounded-circle border border-4 border-white shadow bg-white d-flex align-items-center justify-content-center overflow-hidden position-relative profile-avatar-shell">
                <span id="prof-avatar-initials" class="fs-1 fw-bold text-primary">U</span>
                <img id="prof-avatar-img" src="" class="w-100 h-100 object-fit-cover d-none" alt="Avatar de perfil">
              </div>
              <div class="position-absolute bottom-0 end-0 d-flex gap-1" style="transform: translate(18%, 18%);">
                <button class="btn btn-dark btn-sm rounded-circle border border-2 border-white shadow-sm" id="btn-prof-pic-upload" onclick="document.getElementById('prof-pic-input').click()" style="width: 38px; height: 38px;" title="Cambiar foto">
                  <i class="bi bi-pencil-fill xs-icon"></i>
                </button>
                <button class="btn btn-danger btn-sm rounded-circle border border-2 border-white shadow-sm d-none" id="prof-pic-delete-btn" onclick="Profile.deletePhoto()" style="width: 38px; height: 38px;" title="Eliminar foto">
                  <i class="bi bi-trash-fill xs-icon"></i>
                </button>
              </div>
              <input type="file" id="prof-pic-input" accept="image/*" class="d-none">
            </div>

            <div class="text-center mb-4">
              <h4 class="fw-bold mb-1 text-dark" id="prof-name">Cargando...</h4>
              <div class="profile-role-pill mx-auto mb-2" id="prof-role">USUARIO</div>
              <div class="text-muted small font-monospace mb-1" id="prof-email-display">usuario@tecnm.mx</div>
              <div class="text-muted small font-monospace fw-bold" id="prof-matricula-display">Sin identificador</div>
            </div>

            <div class="profile-mini-panel mb-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="small text-muted">Perfil listo</span>
                <span class="fw-bold small" id="profile-sidebar-progress-text">0%</span>
              </div>
              <div class="progress profile-progress-bar mb-3">
                <div class="progress-bar bg-primary" id="profile-sidebar-progress-bar" style="width: 0%;"></div>
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <span class="small text-muted">Emergencia</span>
                <span class="fw-bold small text-danger" id="profile-sidebar-emergency-text">0%</span>
              </div>
            </div>

            <div class="profile-mini-panel mb-3">
              <div class="extra-small text-uppercase fw-bold text-muted mb-2">Estado</div>
              <div class="d-flex flex-column gap-2">
                <div class="d-flex justify-content-between gap-2 small">
                  <span class="text-muted">Accesos</span>
                  <span class="fw-bold text-dark" id="profile-sidebar-access-count">0 vistas</span>
                </div>
                <div class="d-flex justify-content-between gap-2 small">
                  <span class="text-muted">Ultimo acceso</span>
                  <span class="fw-bold text-dark text-end" id="profile-sidebar-last-login">Sin registro</span>
                </div>
                <div class="d-flex justify-content-between gap-2 small">
                  <span class="text-muted">Actualizado</span>
                  <span class="fw-bold text-dark text-end" id="profile-sidebar-updated-at">Sin registro</span>
                </div>
              </div>
            </div>

            <div class="d-grid gap-2 mb-3">
              <button id="btn-prof-view-qr" class="btn btn-outline-primary rounded-pill shadow-sm fw-bold d-none" type="button" onclick="Profile.openDigitalID()">
                <i class="bi bi-qr-code me-2"></i>Ver credencial
              </button>
              <button class="btn btn-light rounded-pill fw-bold" type="button" onclick="Profile.openNotificationsCenter()">
                <i class="bi bi-bell me-2"></i>Notificaciones
              </button>
              <button class="btn btn-light rounded-pill fw-bold" type="button" onclick="Profile.goHome()">
                <i class="bi bi-house-door me-2"></i>Ir a inicio
              </button>
            </div>

            <button class="btn btn-link text-danger text-decoration-none w-100 rounded-pill small fw-bold" type="button" onclick="window.logout()">
              <i class="bi bi-box-arrow-right me-1"></i>Cerrar sesion
            </button>
          </div>
        </aside>
      `;
    }

    function getSummaryTabMarkup() {
      return `
        <div class="tab-pane fade show active" id="tab-summary" role="tabpanel">
          <div class="profile-summary-grid mb-4">
            <div class="profile-surface p-3"><div class="small text-muted mb-1">Perfil completo</div><div class="fw-bold display-6 mb-1 text-dark" id="profile-summary-completion">0%</div><div class="small text-muted" id="profile-summary-completion-copy">Sin evaluar</div></div>
            <div class="profile-surface p-3"><div class="small text-muted mb-1">Emergencia lista</div><div class="fw-bold display-6 mb-1 text-danger" id="profile-summary-emergency">0%</div><div class="small text-muted" id="profile-summary-emergency-copy">Sin evaluar</div></div>
            <div class="profile-surface p-3"><div class="small text-muted mb-1">Vistas activas</div><div class="fw-bold display-6 mb-1 text-dark" id="profile-summary-access">0</div><div class="small text-muted" id="profile-summary-access-copy">Sin accesos visibles</div></div>
            <div class="profile-surface p-3"><div class="small text-muted mb-1">Vista principal</div><div class="fw-bold h4 mb-1 text-dark" id="profile-summary-home-view">Inicio</div><div class="small text-muted" id="profile-summary-home-copy">Ruta sugerida al entrar</div></div>
          </div>

          <div class="row g-4">
            <div class="col-lg-7">
              <div class="profile-surface p-4 mb-4">
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
                  <div><h6 class="fw-bold text-dark mb-1">Pendientes prioritarios</h6><div class="small text-muted">Lo mas util para mejorar tu experiencia dentro de SIA.</div></div>
                  <button class="btn btn-outline-primary btn-sm rounded-pill fw-bold" type="button" onclick="Profile.startEditingAt('tab-account', 'prof-phone')"><i class="bi bi-pencil-square me-1"></i>Editar ahora</button>
                </div>
                <div id="profile-summary-alerts"></div>
              </div>

              <div class="profile-surface p-4">
                <h6 class="fw-bold text-dark mb-1">Acciones rapidas</h6>
                <div class="small text-muted mb-3">Atajos a lo que normalmente buscas desde tu perfil.</div>
                <div class="profile-quick-grid">
                  <button class="btn btn-light profile-quick-btn text-start d-none" type="button" id="profile-summary-qr-btn" onclick="Profile.openDigitalID()"><span class="fw-bold d-block">Credencial digital</span><span class="small text-muted">Abre tu QR institucional</span></button>
                  <button class="btn btn-light profile-quick-btn text-start" type="button" onclick="Profile.startEditingAt('tab-health', 'prof-blood')"><span class="fw-bold d-block">Completar salud</span><span class="small text-muted">Ajusta datos medicos y de emergencia</span></button>
                  <button class="btn btn-light profile-quick-btn text-start" type="button" onclick="Profile.startEditingAt('tab-context', 'prof-work-status')"><span class="fw-bold d-block">Actualizar contexto</span><span class="small text-muted">Academico, laboral e inclusion</span></button>
                  <button class="btn btn-light profile-quick-btn text-start" type="button" onclick="Profile.goToTab('tab-activity')"><span class="fw-bold d-block">Revisar actividad</span><span class="small text-muted">Tu historial reciente en el ecosistema</span></button>
                  <button class="btn btn-light profile-quick-btn text-start" type="button" onclick="Profile.openNotificationsCenter()"><span class="fw-bold d-block">Centro de notificaciones</span><span class="small text-muted">Activa push o revisa avisos</span></button>
                  <button class="btn btn-light profile-quick-btn text-start" type="button" onclick="Profile.goHome()"><span class="fw-bold d-block">Ir a inicio</span><span class="small text-muted">Regresa a tu vista principal</span></button>
                </div>
              </div>
            </div>

            <div class="col-lg-5">
              <div class="profile-surface p-4 mb-4">
                <h6 class="fw-bold text-dark mb-1">Identidad institucional</h6>
                <div class="small text-muted mb-3">Tu contexto operativo y academico visible para el sistema.</div>
                <div class="d-flex flex-column gap-3">
                  <div class="profile-keyline"><span class="text-muted small">Identificador</span><span class="fw-bold text-dark" id="profile-summary-identifier">Sin dato</span></div>
                  <div class="profile-keyline"><span class="text-muted small">Rol</span><span class="fw-bold text-dark" id="profile-summary-role">Usuario</span></div>
                  <div class="profile-keyline"><span class="text-muted small">Departamento / area</span><span class="fw-bold text-dark" id="profile-summary-department">Sin contexto</span></div>
                  <div class="profile-keyline"><span class="text-muted small">Correo institucional</span><span class="fw-bold text-dark text-break" id="profile-summary-email">Sin dato</span></div>
                </div>
              </div>

              <div class="profile-surface p-4">
                <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
                  <div><h6 class="fw-bold text-dark mb-1">Panel de emergencia</h6><div class="small text-muted">Lo que hoy puede consultar Medi o el SOS del dashboard.</div></div>
                  <span class="profile-status-badge" id="profile-summary-emergency-pill">En revision</span>
                </div>
                <div class="d-flex flex-column gap-3">
                  <div class="profile-keyline"><span class="text-muted small">Tipo de sangre</span><span class="fw-bold text-dark" id="profile-summary-blood">No capturado</span></div>
                  <div class="profile-keyline"><span class="text-muted small">Contacto principal</span><span class="fw-bold text-dark" id="profile-summary-contact-name">No definido</span></div>
                  <div class="profile-keyline"><span class="text-muted small">Telefono</span><span class="fw-bold text-dark text-break" id="profile-summary-contact-phone">Sin telefono</span></div>
                  <div class="profile-keyline"><span class="text-muted small">Seguro</span><span class="fw-bold text-dark" id="profile-summary-insurance">No indicado</span></div>
                  <div class="profile-keyline"><span class="text-muted small">Alergias</span><span class="fw-bold text-dark" id="profile-summary-allergy">No registradas</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function getAccountTabMarkup() {
      return `
        <div class="tab-pane fade" id="tab-account" role="tabpanel">
          <div class="row g-4">
            <div class="col-lg-7">
              <div class="profile-surface p-4 h-100">
                <h6 class="fw-bold text-dark mb-1">Cuenta y contacto</h6>
                <div class="small text-muted mb-3">Datos base de identidad y contacto personal.</div>
                <form class="row g-3" id="form-account">
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Correo institucional</label><input type="email" class="form-control border-0" id="prof-inst-email" disabled></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Correo personal</label><input type="email" class="form-control border-0 prof-editable" id="prof-personal-email" disabled placeholder="tu-correo@ejemplo.com"></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Telefono personal</label><input type="tel" class="form-control border-0 prof-editable" id="prof-phone" disabled></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Fecha de nacimiento</label><input type="date" class="form-control border-0 prof-editable" id="prof-birthdate" disabled></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Genero</label><input type="text" class="form-control border-0" id="prof-gender" disabled></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Estado civil</label><select class="form-select border-0 prof-editable" id="prof-civil" disabled><option value="">Seleccione...</option><option value="Soltero/a">Soltero/a</option><option value="Casado/a">Casado/a</option><option value="Union Libre">Union Libre</option><option value="Separado/a">Separado/a</option><option value="Viudo/a">Viudo/a</option></select></div>
                  <div class="col-12"><label class="form-label small text-muted fw-bold">Domicilio</label><textarea class="form-control border-0 prof-editable" id="prof-address" rows="3" disabled placeholder="Direccion actual"></textarea></div>
                </form>
              </div>
            </div>

            <div class="col-lg-5">
              <div class="profile-surface p-4 mb-4">
                <h6 class="fw-bold text-dark mb-1">Contexto institucional</h6>
                <div class="small text-muted mb-3">Lo que determina tu vista de inicio y el alcance de tu cuenta.</div>
                <div class="d-flex flex-column gap-3">
                  <div class="profile-keyline"><span class="text-muted small">Rol visible</span><span class="fw-bold text-dark" id="profile-account-role">Sin rol</span></div>
                  <div class="profile-keyline"><span class="text-muted small">Area / departamento</span><span class="fw-bold text-dark" id="profile-account-department">Sin contexto</span></div>
                  <div class="profile-keyline"><span class="text-muted small">Vista principal</span><span class="fw-bold text-dark" id="profile-account-home">Inicio</span></div>
                  <div class="profile-keyline"><span class="text-muted small" id="profile-account-identifier-label">Identificador</span><span class="fw-bold text-dark" id="profile-account-identifier">Sin dato</span></div>
                </div>
              </div>

              <div class="profile-surface p-4 mb-4">
                <h6 class="fw-bold text-dark mb-1">Vistas autorizadas</h6>
                <div class="small text-muted mb-3">Accesos efectivos que SIA reconoce para este perfil.</div>
                <div class="profile-chip-row" id="profile-account-views"></div>
              </div>

              <div class="profile-surface p-4">
                <h6 class="fw-bold text-dark mb-1">Permisos activos</h6>
                <div class="small text-muted mb-3">Permisos adicionales por modulo o workspace.</div>
                <div class="profile-chip-row" id="profile-account-permissions"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function getHealthTabMarkup() {
      return `
        <div class="tab-pane fade" id="tab-health" role="tabpanel">
          <div class="row g-4">
            <div class="col-lg-7">
              <div class="profile-surface p-4 h-100">
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
                  <div><h6 class="fw-bold text-dark mb-1">Salud y seguimiento</h6><div class="small text-muted">Informacion medica de referencia y seguimiento personal.</div></div>
                  <span class="profile-status-badge profile-status-badge--danger" id="profile-health-readiness-pill">En revision</span>
                </div>
                <form class="row g-3" id="form-health">
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Tipo de seguro</label><select class="form-select border-0 prof-editable" id="prof-insurance" disabled><option value="">Ninguno / Particular</option><option value="IMSS">IMSS</option><option value="ISSSTE">ISSSTE</option><option value="PEMEX">PEMEX</option><option value="SEDENA">SEDENA / SEMAR</option><option value="INSABI">INSABI / Otro estatal</option></select></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">NSS / afiliacion</label><input type="text" class="form-control border-0 prof-editable" id="prof-nss" disabled placeholder="Numero de seguro"></div>
                  <div class="col-md-4"><label class="form-label small text-muted fw-bold">Tipo de sangre</label><select class="form-select border-0 prof-editable" id="prof-blood" disabled><option value="">Desconocido</option><option value="O+">O+</option><option value="O-">O-</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option><option value="AB-">AB-</option></select></div>
                  <div class="col-md-8"><label class="form-label small text-muted fw-bold">Alergias importantes</label><input type="text" class="form-control border-0 prof-editable" id="prof-allergies" disabled placeholder="Medicamentos, alimentos, etc."></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Padecimientos cronicos</label><input type="text" class="form-control border-0 prof-editable" id="prof-conditions" disabled placeholder="Diabetes, asma, hipertension, etc."></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Medicamentos frecuentes</label><input type="text" class="form-control border-0 prof-editable" id="prof-meds" disabled placeholder="Medicacion recurrente"></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Seguimiento o condicion adicional</label><input type="text" class="form-control border-0 prof-editable" id="prof-health-note" disabled placeholder="Observacion medica relevante"></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Apoyo psicoemocional / seguimiento</label><input type="text" class="form-control border-0 prof-editable" id="prof-mental-support" disabled placeholder="Ej. seguimiento quincenal o sin apoyo"></div>
                  <div class="col-12"><label class="form-label small text-muted fw-bold">Sustancias o consumos a considerar</label><input type="text" class="form-control border-0 prof-editable" id="prof-substances" disabled placeholder="Solo si es relevante para tu atencion"></div>
                </form>

                <div class="profile-maternity-block d-none mt-4" id="profile-maternity-block">
                  <div class="small text-uppercase fw-bold text-muted mb-2">Salud materna</div>
                  <div class="row g-3">
                    <div class="col-md-4"><label class="form-label small text-muted fw-bold">Embarazo</label><select class="form-select border-0 prof-editable" id="prof-pregnancy" disabled><option value="No">No</option><option value="Si">Si</option><option value="En revision">En revision</option></select></div>
                    <div class="col-md-4"><label class="form-label small text-muted fw-bold">Lactancia</label><select class="form-select border-0 prof-editable" id="prof-lactation" disabled><option value="No">No</option><option value="Si">Si</option></select></div>
                    <div class="col-md-4"><label class="form-label small text-muted fw-bold">Tiempo en lactancia</label><input type="text" class="form-control border-0 prof-editable" id="prof-lactation-time" disabled placeholder="Ej. 3 meses"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-lg-5">
              <div class="profile-surface p-4 mb-4">
                <h6 class="fw-bold text-dark mb-1">Contactos de emergencia</h6>
                <div class="small text-muted mb-3">Define a quien deben contactar y como localizarle rapido.</div>
                <form class="row g-3" id="form-emergency">
                  <div class="col-md-12"><label class="form-label small text-muted fw-bold">Nombre principal</label><input type="text" class="form-control border-0 prof-editable" id="prof-emergency-name1" disabled></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Parentesco</label><input type="text" class="form-control border-0 prof-editable" id="prof-emergency-rel1" disabled></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Telefono</label><input type="tel" class="form-control border-0 prof-editable" id="prof-emergency-tel1" disabled></div>
                  <div class="col-md-12 mt-2"><label class="form-label small text-muted fw-bold">Nombre secundario</label><input type="text" class="form-control border-0 prof-editable" id="prof-emergency-name2" disabled></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Parentesco</label><input type="text" class="form-control border-0 prof-editable" id="prof-emergency-rel2" disabled></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Telefono</label><input type="tel" class="form-control border-0 prof-editable" id="prof-emergency-tel2" disabled></div>
                </form>
              </div>

              <div class="profile-surface p-4">
                <h6 class="fw-bold text-dark mb-1">Resumen de emergencia</h6>
                <div class="small text-muted mb-3">Lectura rapida de lo que el sistema tiene hoy.</div>
                <div class="d-flex flex-column gap-3">
                  <div class="profile-keyline"><span class="text-muted small">Estado</span><span class="fw-bold text-dark" id="profile-health-status-text">En revision</span></div>
                  <div class="profile-keyline"><span class="text-muted small">Contacto principal</span><span class="fw-bold text-dark" id="profile-health-contact-text">No definido</span></div>
                  <div class="profile-keyline"><span class="text-muted small">Telefono principal</span><span class="fw-bold text-dark text-break" id="profile-health-phone-text">Sin telefono</span></div>
                  <div class="profile-keyline"><span class="text-muted small">Seguro</span><span class="fw-bold text-dark" id="profile-health-insurance-text">No indicado</span></div>
                  <div class="profile-keyline"><span class="text-muted small">Alergias</span><span class="fw-bold text-dark" id="profile-health-allergy-text">No registradas</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function getContextTabMarkup() {
      return `
        <div class="tab-pane fade" id="tab-context" role="tabpanel">
          <div class="row g-4">
            <div class="col-12">
              <div class="profile-surface p-4">
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
                  <div><h6 class="fw-bold text-dark mb-1">Contexto academico y laboral</h6><div class="small text-muted">La parte del perfil que explica tu situacion actual dentro del campus.</div></div>
                  <span class="profile-status-badge" id="profile-context-role-pill">Perfil</span>
                </div>

                <div class="row g-3" id="profile-student-context">
                  <div class="col-md-4"><label class="form-label small text-muted fw-bold">Carrera</label><input type="text" class="form-control border-0" id="prof-program" disabled></div>
                  <div class="col-md-4"><label class="form-label small text-muted fw-bold">Semestre</label><input type="text" class="form-control border-0" id="prof-semester" disabled></div>
                  <div class="col-md-4"><label class="form-label small text-muted fw-bold">Turno</label><select class="form-select border-0 prof-editable" id="prof-shift" disabled><option value="">Seleccione...</option><option value="Matutino">Matutino</option><option value="Vespertino">Vespertino</option><option value="Mixto">Mixto</option></select></div>
                  <div class="col-md-4"><label class="form-label small text-muted fw-bold">Trabajo actual</label><select class="form-select border-0 prof-editable" id="prof-work-status" disabled><option value="No">No</option><option value="Medio Tiempo">Medio Tiempo</option><option value="Tiempo Completo">Tiempo Completo</option></select></div>
                  <div class="col-md-4"><label class="form-label small text-muted fw-bold">Dependientes economicos</label><input type="number" min="0" class="form-control border-0 prof-editable" id="prof-dependents" disabled></div>
                  <div class="col-md-4"><label class="form-label small text-muted fw-bold">Beca</label><input type="text" class="form-control border-0 prof-editable" id="prof-scholarship" disabled placeholder="Estatal, federal o institucional"></div>
                </div>

                <div class="row g-3 d-none" id="profile-staff-context">
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Area de adscripcion</label><input type="text" class="form-control border-0 prof-editable" id="prof-area" disabled placeholder="Coordinacion, oficina o laboratorio"></div>
                  <div class="col-md-3"><label class="form-label small text-muted fw-bold">Cubiculo / ubicacion</label><input type="text" class="form-control border-0 prof-editable" id="prof-cubiculo" disabled placeholder="Ej. Edificio B"></div>
                  <div class="col-md-3"><label class="form-label small text-muted fw-bold">Extension</label><input type="text" class="form-control border-0 prof-editable" id="prof-extension" disabled placeholder="Ej. 1045"></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Especialidad / enfoque</label><input type="text" class="form-control border-0" id="prof-staff-specialty" disabled></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Tipo de usuario</label><input type="text" class="form-control border-0" id="prof-user-type" disabled></div>
                </div>
              </div>
            </div>

            <div class="col-12">
              <div class="profile-surface p-4">
                <h6 class="fw-bold text-dark mb-1">Inclusion y apoyos</h6>
                <div class="small text-muted mb-3">Datos utiles para ajustes, accesibilidad y atencion con contexto.</div>
                <div class="row g-3">
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Discapacidad declarada</label><input type="text" class="form-control border-0 prof-editable" id="prof-disability" disabled placeholder="Motriz, visual, auditiva, etc."></div>
                  <div class="col-md-6"><label class="form-label small text-muted fw-bold">Pueblo originario / grupo etnico</label><input type="text" class="form-control border-0 prof-editable" id="prof-pueblo" disabled></div>
                  <div class="col-md-4"><label class="form-label small text-muted fw-bold">Lengua indigena</label><input type="text" class="form-control border-0 prof-editable" id="prof-language" disabled></div>
                  <div class="col-md-4"><label class="form-label small text-muted fw-bold">Lengua de senas</label><select class="form-select border-0 prof-editable" id="prof-sign-language" disabled><option value="No">No</option><option value="Si (Basico)">Si (Basico)</option><option value="Si (Fluido)">Si (Fluido)</option></select></div>
                  <div class="col-md-4"><label class="form-label small text-muted fw-bold">Apoyo tecnico</label><input type="text" class="form-control border-0 prof-editable" id="prof-support-tech" disabled placeholder="Lector de pantalla, silla, etc."></div>
                  <div class="col-12"><label class="form-label small text-muted fw-bold">Ajustes o apoyos requeridos</label><textarea class="form-control border-0 prof-editable" id="prof-adjustments" rows="3" disabled placeholder="Describe ajustes, acompanamiento o adecuaciones utiles"></textarea></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function getPreferencesTabMarkup() {
      return `
        <div class="tab-pane fade" id="tab-preferences" role="tabpanel">
          <div class="row g-4">
            <div class="col-lg-6">
              <div class="profile-surface p-4 h-100">
                <h6 class="fw-bold text-dark mb-1">Interfaz personal</h6>
                <div class="small text-muted mb-3">Solo ajustes que hoy si tienen efecto directo en la app.</div>
                <div class="row g-3">
                  <div class="col-12"><label class="form-label small text-muted fw-bold">Tema visual</label><select class="form-select border-0 prof-editable" id="pref-theme" disabled><option value="system">Segun el sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></div>
                  <div class="col-12"><div class="profile-inline-note"><div class="fw-bold small text-dark mb-1">Fondo del perfil</div><div class="small text-muted">Puedes cambiarlo desde la portada superior y se guarda de inmediato.</div></div></div>
                  <div class="col-12"><button class="btn btn-outline-secondary rounded-pill fw-bold" type="button" onclick="Profile.goHome()"><i class="bi bi-house-door me-2"></i>Volver a tu inicio</button></div>
                </div>
              </div>
            </div>

            <div class="col-lg-6">
              <div class="profile-surface p-4 h-100">
                <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                  <div><h6 class="fw-bold text-dark mb-1">Push en este dispositivo</h6><div class="small text-muted">Integrado con PushService y el centro de notificaciones.</div></div>
                  <span class="profile-status-badge" id="profile-push-status">Cargando</span>
                </div>
                <div class="small text-muted mb-3" id="profile-push-copy">Revisando compatibilidad del dispositivo...</div>
                <div class="d-flex flex-wrap gap-2">
                  <button class="btn btn-primary rounded-pill fw-bold" type="button" id="profile-push-action" onclick="Profile.togglePushNotifications()">Activar push</button>
                  <button class="btn btn-outline-secondary rounded-pill fw-bold" type="button" onclick="Profile.openNotificationsCenter()">Centro de notificaciones</button>
                </div>
              </div>
            </div>

            <div class="col-12">
              <div class="profile-surface p-4">
                <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                  <div><h6 class="fw-bold text-dark mb-1" id="profile-settings-link-title">Configuracion del dashboard</h6><div class="small text-muted" id="profile-settings-link-copy">Metas, favoritos y recordatorios ya no se editan aqui. Se gestionan directamente dentro del dashboard del estudiante.</div></div>
                  <button class="btn btn-outline-primary rounded-pill fw-bold" type="button" id="profile-settings-link-btn" onclick="Profile.openDashboardSettings()"><i class="bi bi-speedometer2 me-2"></i>Abrir dashboard</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function getActivityTabMarkup() {
      return `
        <div class="tab-pane fade" id="tab-activity" role="tabpanel">
          <div class="profile-surface p-4">
            <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
              <div><h6 class="fw-bold text-dark mb-1">Actividad reciente</h6><div class="small text-muted" id="profile-activity-meta">Tu historial mas reciente dentro de SIA y de tu cuenta.</div></div>
              <button class="btn btn-outline-secondary rounded-pill fw-bold" type="button" onclick="Profile.renderActivityNow()"><i class="bi bi-arrow-clockwise me-2"></i>Actualizar</button>
            </div>
            <div class="profile-activity-list" id="profile-activity-list"></div>
          </div>
        </div>
      `;
    }

    function getDeletePhotoModalMarkup() {
      return `
        <div class="modal fade" id="modalDeletePhoto" tabindex="-1" aria-labelledby="modalDeletePhotoLabel" aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered modal-sm">
            <div class="modal-content border-0 shadow rounded-4">
              <div class="modal-header border-0 pb-0">
                <h5 class="modal-title fw-bold" id="modalDeletePhotoLabel">Eliminar foto</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
              </div>
              <div class="modal-body text-center pt-2">
                <div class="mb-3"><i class="bi bi-trash text-danger" style="font-size: 3rem;"></i></div>
                <p class="mb-0 text-muted small">Si la eliminas, el perfil volvera a mostrar tus iniciales.</p>
              </div>
              <div class="modal-footer border-0 pt-0 d-flex justify-content-center">
                <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-danger rounded-pill px-4 fw-bold shadow-sm" id="btn-confirm-delete-photo" onclick="Profile.confirmDeletePhoto()">Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function renderStructure(container) {
      container.innerHTML = `
        <div class="container-fluid px-0 animate-fade-in profile-shell" id="profile-main-container" style="min-height: 100vh; transition: background 0.5s ease;">
          <div class="profile-cover-image position-relative d-flex align-items-start justify-content-end p-3 shadow-sm rounded-4 mx-3 mt-3 border border-secondary border-opacity-25" id="prof-cover-container" style="height: 190px; background: linear-gradient(135deg, #1b396a 0%, #0d6efd 100%); transition: background 0.3s ease; z-index: 10;">
            ${getBannerMenuMarkup()}
          </div>

          <div class="container position-relative profile-shell__container" style="margin-top: -76px; z-index: 5;">
            <div class="row g-4">
              <div class="col-xl-3">${getSidebarMarkup()}</div>
              <div class="col-xl-9">
                <div class="card border-0 shadow-sm rounded-4 bg-white profile-content-card">
                  <div class="card-body p-3 p-lg-4">
                    <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
                      <div>
                        <div class="extra-small text-uppercase fw-bold mb-1" style="letter-spacing: 0.08em; color: var(--accent);">Centro personal</div>
                        <h5 class="fw-bold mb-1 text-dark">Cuenta, salud, contexto y actividad</h5>
                        <div class="small text-muted">Solo se muestran preferencias y datos que hoy si impactan tu experiencia real en SIA.</div>
                      </div>
                      <div class="d-flex align-items-center gap-2 flex-wrap">
                        <span class="badge rounded-pill text-bg-primary d-none" id="profile-edit-mode-pill">Modo edicion</span>
                        <button class="btn btn-light rounded-pill fw-bold toggle-edit-btn" type="button" onclick="Profile.toggleEditMode()"><i class="bi bi-pencil-square me-2"></i>Editar perfil</button>
                      </div>
                    </div>

                    <div class="profile-tab-scroller mb-4">
                      <ul class="nav nav-pills flex-nowrap profile-pill-nav" id="profile-tabs" role="tablist">
                        <li class="profile-pill-item" role="presentation"><button class="nav-link active prof-tab-btn" id="tab-summary-btn" data-bs-toggle="pill" data-bs-target="#tab-summary" type="button" role="tab" aria-controls="tab-summary" aria-selected="true"><i class="bi bi-grid-1x2-fill"></i><span class="profile-pill-label">Resumen</span></button></li>
                        <li class="profile-pill-item" role="presentation"><button class="nav-link prof-tab-btn" id="tab-account-btn" data-bs-toggle="pill" data-bs-target="#tab-account" type="button" role="tab" aria-controls="tab-account" aria-selected="false"><i class="bi bi-person-lines-fill"></i><span class="profile-pill-label">Cuenta</span></button></li>
                        <li class="profile-pill-item" role="presentation"><button class="nav-link prof-tab-btn" id="tab-health-btn" data-bs-toggle="pill" data-bs-target="#tab-health" type="button" role="tab" aria-controls="tab-health" aria-selected="false"><i class="bi bi-heart-pulse-fill"></i><span class="profile-pill-label">Salud</span></button></li>
                        <li class="profile-pill-item" role="presentation"><button class="nav-link prof-tab-btn" id="tab-context-btn" data-bs-toggle="pill" data-bs-target="#tab-context" type="button" role="tab" aria-controls="tab-context" aria-selected="false"><i class="bi bi-diagram-3-fill"></i><span class="profile-pill-label">Contexto</span></button></li>
                        <li class="profile-pill-item" role="presentation"><button class="nav-link prof-tab-btn" id="tab-preferences-btn" data-bs-toggle="pill" data-bs-target="#tab-preferences" type="button" role="tab" aria-controls="tab-preferences" aria-selected="false"><i class="bi bi-sliders"></i><span class="profile-pill-label">Preferencias</span></button></li>
                        <li class="profile-pill-item" role="presentation"><button class="nav-link prof-tab-btn" id="tab-activity-btn" data-bs-toggle="pill" data-bs-target="#tab-activity" type="button" role="tab" aria-controls="tab-activity" aria-selected="false"><i class="bi bi-clock-history"></i><span class="profile-pill-label">Actividad</span></button></li>
                      </ul>
                    </div>

                    <div class="tab-content">
                      ${getSummaryTabMarkup()}
                      ${getAccountTabMarkup()}
                      ${getHealthTabMarkup()}
                      ${getContextTabMarkup()}
                      ${getPreferencesTabMarkup()}
                      ${getActivityTabMarkup()}
                    </div>
                  </div>

                  <div class="card-footer bg-white border-0 border-top d-none" id="prof-save-actions">
                    <div class="d-flex justify-content-end gap-2 flex-wrap">
                      <button class="btn btn-light rounded-pill px-4" type="button" onclick="Profile.cancelEdit()">Cancelar</button>
                      <button class="btn btn-primary rounded-pill px-4 shadow-sm" id="btn-save-profile" type="button" disabled onclick="Profile.saveChanges()">Guardar cambios</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        ${getDeletePhotoModalMarkup()}
      `;
    }

    function render() {
      const profile = getCurrentProfile();
      if (!profile) {
        setText('prof-name', 'Cargando...');
        return;
      }

      const stats = computeProfileStats(profile);
      renderSidebar(profile, stats);
      renderSummaryTab(profile, stats);
      renderAccountTab(profile, stats);
      renderHealthTab(profile, stats);
      renderContextTab(profile);
      renderPreferencesTab(profile);
      renderActivityTimeline(profile);
      _currentBanner = getPrefs(profile).bannerStyle || 'gradient-1';
      applyBannerVisual(_currentBanner);
      void refreshRuntimePanels(profile);
    }

    async function refreshRuntimePanels(profile) {
      await renderPushStatus(profile);
      renderActivityTimeline(profile);
    }

    function renderSidebar(profile, stats) {
      const isStudent = isStudentProfile(profile);
      const img = document.getElementById('prof-avatar-img');
      const init = document.getElementById('prof-avatar-initials');
      const delBtn = document.getElementById('prof-pic-delete-btn');
      const progressBar = document.getElementById('profile-sidebar-progress-bar');

      setText('prof-name', profile.displayName || 'Usuario');
      setText('prof-role', getDisplayRole(profile));
      setText('prof-email-display', getInstitutionalEmail(profile) || 'Sin correo institucional');
      setText('prof-matricula-display', `${getIdentifierLabel(profile)}: ${getIdentifierValue(profile)}`);
      document.getElementById('btn-prof-view-qr')?.classList.toggle('d-none', !isStudent);
      document.getElementById('profile-summary-qr-btn')?.classList.toggle('d-none', !isStudent);

      if (profile.photoURL) {
        if (img) {
          img.src = profile.photoURL;
          img.classList.remove('d-none');
        }
        init?.classList.add('d-none');
        delBtn?.classList.remove('d-none');
      } else {
        if (init) {
          init.textContent = (profile.displayName || 'U').substring(0, 2).toUpperCase();
          init.classList.remove('d-none');
        }
        img?.classList.add('d-none');
        delBtn?.classList.add('d-none');
      }

      if (progressBar) progressBar.style.width = `${stats.completionPercent}%`;
      setText('profile-sidebar-progress-text', `${stats.completionPercent}%`);
      setText('profile-sidebar-emergency-text', `${stats.emergencyPercent}%`);
      setText('profile-sidebar-access-count', `${stats.accessCount} vista${stats.accessCount === 1 ? '' : 's'}`);
      setText('profile-sidebar-last-login', formatRelativeTime(profile.lastLogin));
      setText('profile-sidebar-updated-at', formatRelativeTime(profile.updatedAt));
    }

    function renderSummaryTab(profile, stats) {
      const hd = profile.healthData || {};
      const contact = getPrimaryEmergencyContact(profile);
      const emergencyReady = stats.emergencyPercent >= 75;

      setText('profile-summary-completion', `${stats.completionPercent}%`);
      setText('profile-summary-completion-copy', stats.completionPercent >= 80 ? 'Perfil bien cubierto' : 'Aun hay datos importantes por completar');
      setText('profile-summary-emergency', `${stats.emergencyPercent}%`);
      setText('profile-summary-emergency-copy', emergencyReady ? 'Panel SOS listo para responder' : 'Medi y SOS aun tienen huecos');
      setText('profile-summary-access', String(stats.accessCount));
      setText('profile-summary-access-copy', stats.accessCount > 0 ? 'modulos o vistas disponibles' : 'sin vistas detectadas');
      setText('profile-summary-home-view', getViewLabel(stats.homeViewId));
      setText('profile-summary-home-copy', 'ruta sugerida al iniciar sesion');
      setText('profile-summary-identifier', getIdentifierValue(profile));
      setText('profile-summary-role', getDisplayRole(profile));
      setText('profile-summary-department', getDepartmentLabel(profile) || 'Sin departamento visible');
      setText('profile-summary-email', getInstitutionalEmail(profile) || 'Sin dato');
      setText('profile-summary-blood', profile.tipoSangre || hd.tipoSangre || 'No capturado');
      setText('profile-summary-contact-name', contact.nombre || 'No definido');
      setText('profile-summary-contact-phone', contact.telefono || 'Sin telefono');
      setText('profile-summary-insurance', hd.seguroTipo || profile.seguro || 'No indicado');
      setText('profile-summary-allergy', profile.alergias || hd.alergia || 'No registradas');

      const pill = document.getElementById('profile-summary-emergency-pill');
      if (pill) {
        pill.textContent = emergencyReady ? 'Listo para SOS' : 'En revision';
        pill.classList.toggle('profile-status-badge--danger', !emergencyReady);
        pill.classList.toggle('profile-status-badge--success', emergencyReady);
      }

      const alertList = document.getElementById('profile-summary-alerts');
      if (!alertList) return;
      if (!stats.alerts.length) {
        alertList.innerHTML = `<div class="profile-alert profile-alert--success"><div class="fw-bold small mb-1">Perfil bastante completo</div><div class="small text-muted">No hay alertas urgentes. Mantiene actualizados tus datos y listo.</div></div>`;
        return;
      }

      alertList.innerHTML = stats.alerts.map((alert) => `
        <div class="profile-alert profile-alert--${escapeHtml(alert.tone)}">
          <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3">
            <div style="min-width: 0;">
              <div class="fw-bold small text-dark">${escapeHtml(alert.title)}</div>
              <div class="small text-muted mt-1">${escapeHtml(alert.body)}</div>
            </div>
            <button class="btn btn-sm btn-outline-primary rounded-pill fw-bold flex-shrink-0" type="button" onclick="Profile.startEditingAt('${escapeHtml(alert.tabId)}', '${escapeHtml(alert.fieldId)}')">${escapeHtml(alert.actionLabel)}</button>
          </div>
        </div>
      `).join('');
    }

    function renderAccountTab(profile, stats) {
      const pd = profile.personalData || {};
      setVal('prof-inst-email', getInstitutionalEmail(profile));
      setVal('prof-personal-email', profile.emailPersonal || '');
      setVal('prof-phone', profile.telefono || '');
      setVal('prof-birthdate', formatInputDate(profile.fechaNacimiento));
      setVal('prof-gender', pd.genero || profile.genero || '');
      setVal('prof-civil', pd.estadoCivil || profile.estadoCivil || '');
      setVal('prof-address', pd.domicilio || profile.domicilio || '');
      setText('profile-account-role', getDisplayRole(profile));
      setText('profile-account-department', getDepartmentLabel(profile) || 'Sin contexto');
      setText('profile-account-home', getViewLabel(stats.homeViewId));
      setText('profile-account-identifier-label', getIdentifierLabel(profile));
      setText('profile-account-identifier', getIdentifierValue(profile));
      setHTML('profile-account-views', renderChips(stats.accessViews.map(getViewLabel), 'Sin vistas configuradas'));
      setHTML('profile-account-permissions', renderChips(stats.permissionLabels, 'Sin permisos adicionales'));
    }

    function renderHealthTab(profile, stats) {
      const hd = profile.healthData || {};
      const contact = getPrimaryEmergencyContact(profile);
      const contacts = hd.contactos || profile.contactos || [];
      const secondContact = contacts[1] || {};
      const emergencyReady = stats.emergencyPercent >= 75;
      const gender = normalizeText(profile.personalData?.genero || profile.genero);
      const showMaternity = ['femenino', 'mujer', 'female'].includes(gender)
        || normalizeText(hd.embarazo) === 'si'
        || normalizeText(hd.lactancia) === 'si';

      setVal('prof-insurance', hd.seguroTipo || '');
      setVal('prof-nss', hd.nss || '');
      setVal('prof-blood', profile.tipoSangre || hd.tipoSangre || '');
      setVal('prof-allergies', profile.alergias || getAny(hd, ['alergia']));
      setVal('prof-conditions', getAny(hd, ['enfermedadCronica', 'padecimientoFisico']) || (Array.isArray(profile.condicionesCronicas) ? profile.condicionesCronicas.join(', ') : ''));
      setVal('prof-meds', profile.medicamentosActuales || getAny(hd, ['tratamientoMedico', 'tratamientoM\u00E9dico', 'medicamentoActual']));
      setVal('prof-health-note', getAny(hd, ['condicionSalud', 'padecimientoMental']));
      setVal('prof-mental-support', getAny(hd, ['apoyoPsico']));
      setVal('prof-substances', getAny(hd, ['sustancias']));
      setVal('prof-emergency-name1', contact.nombre || '');
      setVal('prof-emergency-rel1', contact.parentesco || '');
      setVal('prof-emergency-tel1', contact.telefono || '');
      setVal('prof-emergency-name2', secondContact.nombre || '');
      setVal('prof-emergency-rel2', secondContact.parentesco || '');
      setVal('prof-emergency-tel2', secondContact.telefono || '');
      setVal('prof-pregnancy', hd.embarazo || 'No');
      setVal('prof-lactation', hd.lactancia || 'No');
      setVal('prof-lactation-time', hd.lactanciaTiempo || '');
      document.getElementById('profile-maternity-block')?.classList.toggle('d-none', !showMaternity);

      const readinessPill = document.getElementById('profile-health-readiness-pill');
      if (readinessPill) {
        readinessPill.textContent = emergencyReady ? 'Emergencia lista' : 'Completar datos criticos';
        readinessPill.classList.toggle('profile-status-badge--success', emergencyReady);
        readinessPill.classList.toggle('profile-status-badge--danger', !emergencyReady);
      }

      setText('profile-health-status-text', emergencyReady ? 'Listo para emergencias' : 'Aun faltan datos');
      setText('profile-health-contact-text', contact.nombre || 'No definido');
      setText('profile-health-phone-text', contact.telefono || 'Sin telefono');
      setText('profile-health-insurance-text', hd.seguroTipo || profile.seguro || 'No indicado');
      setText('profile-health-allergy-text', profile.alergias || hd.alergia || 'No registradas');
    }

    function renderContextTab(profile) {
      const isStudent = isStudentProfile(profile);
      const pd = profile.personalData || {};
      const hd = profile.healthData || {};
      const cd = profile.culturalData || {};
      document.getElementById('profile-student-context')?.classList.toggle('d-none', !isStudent);
      document.getElementById('profile-staff-context')?.classList.toggle('d-none', isStudent);
      setText('profile-context-role-pill', isStudent ? 'Estudiante' : 'Perfil operativo');

      if (isStudent) {
        setVal('prof-program', profile.carrera || 'Sin asignar');
        setVal('prof-semester', profile.semestre ? `Semestre ${profile.semestre}` : 'Sin dato');
        setVal('prof-shift', profile.turno || '');
        setVal('prof-work-status', pd.trabaja || profile.trabaja || 'No');
        setVal('prof-dependents', parseDependentsQty(pd.dependientesQty, pd.dependientes || profile.dependientes));
        setVal('prof-scholarship', pd.beca || profile.beca || '');
      } else {
        setVal('prof-area', profile.areaAdscripcion || pd.areaAdscripcion || getDepartmentLabel(profile) || '');
        setVal('prof-cubiculo', profile.cubiculo || '');
        setVal('prof-extension', profile.extension || '');
        setVal('prof-staff-specialty', profile.especialidad || profile.specialty || getDepartmentLabel(profile) || 'Sin especialidad');
        setVal('prof-user-type', profile.tipoUsuario || humanizeToken(profile.role, 'Sin categoria'));
      }

      setVal('prof-disability', formatDisabilityValue(hd.discapacidad || profile.discapacidad));
      setVal('prof-pueblo', cd.grupoEtnico || cd.puebloOriginario || '');
      setVal('prof-language', cd.lenguaIndigena || '');
      setVal('prof-sign-language', cd.lenguaSenas || 'No');
      setVal('prof-support-tech', cd.apoyoTecnico || '');
      setVal('prof-adjustments', cd.ajustes || '');
    }

    function renderPreferencesTab(profile) {
      setVal('pref-theme', getThemeSelection(getPrefs(profile)));
      const isStudent = isStudentProfile(profile);
      setText('profile-settings-link-title', isStudent ? 'Configuracion del dashboard' : 'Centro de trabajo');
      setText('profile-settings-link-copy', isStudent
        ? 'Metas, favoritos y recordatorios ya no se editan aqui. Se gestionan directamente dentro del dashboard del estudiante.'
        : 'Tus accesos operativos y la vista principal se gestionan desde tu flujo de trabajo, no desde este perfil.');
      const btn = document.getElementById('profile-settings-link-btn');
      if (btn) {
        btn.innerHTML = isStudent
          ? '<i class="bi bi-speedometer2 me-2"></i>Abrir dashboard'
          : '<i class="bi bi-house-door me-2"></i>Ir a tu inicio';
      }
    }

    async function renderPushStatus(profile) {
      const statusEl = document.getElementById('profile-push-status');
      const copyEl = document.getElementById('profile-push-copy');
      const actionBtn = document.getElementById('profile-push-action');
      if (!statusEl || !copyEl || !actionBtn) return;

      if (_pushBusy) {
        statusEl.textContent = 'Procesando';
        copyEl.textContent = 'Aplicando el cambio en este dispositivo...';
        actionBtn.disabled = true;
        actionBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando';
        return;
      }

      if (!window.PushService || !window.PushService.isSupported()) {
        statusEl.textContent = 'No disponible';
        copyEl.textContent = 'Este navegador o dispositivo no soporta notificaciones push con SIA.';
        actionBtn.disabled = true;
        actionBtn.className = 'btn btn-outline-secondary rounded-pill fw-bold';
        actionBtn.textContent = 'Push no disponible';
        return;
      }

      const permission = typeof window.PushService.getPermissionStateAsync === 'function' ? await window.PushService.getPermissionStateAsync() : window.PushService.getPermissionState();
      const prefEnabled = getPrefs(profile).notifyPush !== false;
      const enabled = permission === 'granted' && prefEnabled;
      const blocked = permission === 'denied';

      statusEl.textContent = enabled ? 'Activas' : (blocked ? 'Bloqueadas' : (permission === 'granted' ? 'Pausadas' : 'No activadas'));
      statusEl.classList.toggle('profile-status-badge--success', enabled);
      statusEl.classList.toggle('profile-status-badge--danger', blocked);

      if (enabled) {
        copyEl.textContent = 'SIA puede enviarte avisos reales a este dispositivo.';
        actionBtn.disabled = false;
        actionBtn.className = 'btn btn-outline-danger rounded-pill fw-bold';
        actionBtn.textContent = 'Desactivar en este dispositivo';
      } else if (blocked) {
        copyEl.textContent = 'Debes habilitarlas desde el navegador o el sistema operativo y luego intentar de nuevo.';
        actionBtn.disabled = false;
        actionBtn.className = 'btn btn-outline-warning rounded-pill fw-bold';
        actionBtn.textContent = 'Intentar activar';
      } else if (permission === 'granted') {
        copyEl.textContent = 'El permiso existe, pero este dispositivo esta pausado para SIA.';
        actionBtn.disabled = false;
        actionBtn.className = 'btn btn-primary rounded-pill fw-bold';
        actionBtn.textContent = 'Activar de nuevo';
      } else {
        copyEl.textContent = 'Puedes activarlas aqui o desde el centro de notificaciones.';
        actionBtn.disabled = false;
        actionBtn.className = 'btn btn-primary rounded-pill fw-bold';
        actionBtn.textContent = 'Activar push';
      }
    }

    function renderActivityTimeline(profile) {
      const listEl = document.getElementById('profile-activity-list');
      const metaEl = document.getElementById('profile-activity-meta');
      if (!listEl) return;

      const items = buildActivityItems(profile);
      if (metaEl) metaEl.textContent = items.length ? `${items.length} movimiento${items.length === 1 ? '' : 's'} visibles entre cuenta y notificaciones.` : 'Sin actividad visible todavia.';

      if (!items.length) {
        listEl.innerHTML = `<div class="profile-empty-state"><div class="fw-bold small text-dark mb-1">Aun no hay actividad visible</div><div class="small text-muted">Cuando uses mas modulos o recibas notificaciones, aqui apareceran tus movimientos recientes.</div></div>`;
        return;
      }

      listEl.innerHTML = items.map((item) => `
        <div class="profile-activity-item">
          <div class="profile-activity-icon profile-activity-icon--${escapeHtml(item.tone)}"><i class="bi ${escapeHtml(item.icon)}"></i></div>
          <div class="flex-grow-1" style="min-width: 0;">
            <div class="d-flex flex-column flex-md-row justify-content-between gap-2">
              <div class="fw-bold small text-dark">${escapeHtml(item.title)}</div>
              <div class="extra-small text-muted flex-shrink-0">${escapeHtml(formatRelativeTime(item.date))}</div>
            </div>
            <div class="small text-muted mt-1">${escapeHtml(item.body)}</div>
            <div class="extra-small text-muted mt-2">${escapeHtml(formatDateDisplay(item.date, true))}</div>
          </div>
        </div>
      `).join('');
    }

    async function init(ctx) {
      _ctx = normalizeCtx(ctx);
      const container = document.getElementById('view-profile');
      if (!container) return;
      if (!container.querySelector('#profile-main-container')) renderStructure(container);
      render();
      setupListeners(container);
      restoreState();
      syncBreadcrumb();
      updateFormState();
    }

    function saveState() {
      return { [TAB_STATE_KEY]: _activeTabId };
    }

    function restoreState() {
      if (!window.ModuleStateManager) return;
      const state = window.ModuleStateManager.getState(MODULE_ID);
      const tabId = state?.[TAB_STATE_KEY];
      if (tabId) goToTab(tabId);
    }

    function setupListeners(container) {
      if (_boundViewEl && _delegatedInputHandler) _boundViewEl.removeEventListener('input', _delegatedInputHandler);
      if (_boundViewEl && _delegatedChangeHandler) _boundViewEl.removeEventListener('change', _delegatedChangeHandler);

      const fileInput = document.getElementById('prof-pic-input');
      if (fileInput) fileInput.onchange = handleUploadPhoto;

      document.querySelectorAll('.prof-tab-btn').forEach((btn) => {
        if (btn.dataset.profileTabBound === 'true') return;
        btn.dataset.profileTabBound = 'true';
        btn.addEventListener('shown.bs.tab', (event) => {
          const targetId = event.target.getAttribute('data-bs-target');
          if (targetId) _activeTabId = targetId.replace('#', '');
          syncBreadcrumb(_activeTabId);
          revealTabButton(event.target);
        });
      });

      _delegatedInputHandler = (event) => {
        if (event.target.classList.contains('prof-editable')) setDirty();
      };
      _delegatedChangeHandler = (event) => {
        if (event.target.classList.contains('prof-editable') || event.target.classList.contains('prof-editable-cb')) setDirty();
      };

      container?.addEventListener('input', _delegatedInputHandler);
      container?.addEventListener('change', _delegatedChangeHandler);
      _boundViewEl = container;
      revealTabButton(document.querySelector('.prof-tab-btn.active'));
    }

    function setDirty() {
      _hasChanges = true;
      const btnSave = document.getElementById('btn-save-profile');
      if (btnSave) btnSave.disabled = false;
    }

    function syncBreadcrumb(tabId = _activeTabId) {
      const label = PROFILE_TAB_LABELS[tabId] || PROFILE_TAB_LABELS['tab-summary'];
      window.SIA?.setBreadcrumbSection?.(MODULE_ID, label, { moduleClickable: false });
    }

    function goToTab(tabId) {
      const btn = document.querySelector(`button[data-bs-target="#${tabId}"]`);
      if (!btn || !window.bootstrap?.Tab) return;
      window.bootstrap.Tab.getOrCreateInstance(btn).show();
      _activeTabId = tabId;
      revealTabButton(btn);
    }

    function revealTabButton(btn) {
      if (!btn?.scrollIntoView) return;
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    function startEditingAt(tabId, fieldId) {
      goToTab(tabId || 'tab-account');
      if (!_isEditing) {
        _isEditing = true;
        _hasChanges = false;
        updateFormState();
      }
      if (!fieldId) return;
      setTimeout(() => {
        const field = document.getElementById(fieldId);
        field?.focus?.();
        field?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      }, 120);
    }

    function toggleEditMode() {
      _isEditing = !_isEditing;
      _hasChanges = false;
      updateFormState();
      if (_isEditing && ['tab-summary', 'tab-activity'].includes(_activeTabId)) goToTab('tab-account');
    }

    function updateFormState() {
      document.querySelectorAll('.prof-editable').forEach((el) => {
        el.disabled = !_isEditing;
        el.classList.toggle('border-0', !_isEditing);
        el.classList.toggle('border', _isEditing);
        el.classList.toggle('shadow-sm', _isEditing);
      });
      document.querySelectorAll('.prof-editable-cb').forEach((el) => { el.disabled = !_isEditing; });
      document.getElementById('prof-save-actions')?.classList.toggle('d-none', !_isEditing);
      document.getElementById('profile-edit-mode-pill')?.classList.toggle('d-none', !_isEditing);
      const btnSave = document.getElementById('btn-save-profile');
      if (btnSave && _isEditing) btnSave.disabled = true;
      document.querySelectorAll('.toggle-edit-btn').forEach((btn) => btn.classList.toggle('d-none', _isEditing));
    }

    function cancelEdit() {
      _isEditing = false;
      _hasChanges = false;
      render();
      updateFormState();
    }

    async function saveChanges() {
      const profile = getCurrentProfile();
      if (!window.ProfileService || !profile) return;

      if (!_hasChanges) {
        _isEditing = false;
        updateFormState();
        return;
      }

      const btn = document.getElementById('btn-save-profile');
      const originalText = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
      }

      const isStudent = isStudentProfile(profile);
      const pd = profile.personalData || {};
      const updates = {
        telefono: getVal('prof-phone').trim(),
        emailPersonal: getVal('prof-personal-email').trim(),
        fechaNacimiento: getVal('prof-birthdate').trim(),
        domicilio: getVal('prof-address').trim(),
        'personalData.domicilio': getVal('prof-address').trim(),
        estadoCivil: getVal('prof-civil').trim(),
        'personalData.estadoCivil': getVal('prof-civil').trim(),
        tipoSangre: getVal('prof-blood').trim(),
        'healthData.tipoSangre': getVal('prof-blood').trim(),
        'healthData.seguroTipo': getVal('prof-insurance').trim(),
        'healthData.nss': getVal('prof-nss').trim(),
        alergias: getVal('prof-allergies').trim(),
        'healthData.alergia': getVal('prof-allergies').trim(),
        'healthData.enfermedadCronica': getVal('prof-conditions').trim(),
        'healthData.padecimientoFisico': getVal('prof-conditions').trim(),
        medicamentosActuales: getVal('prof-meds').trim(),
        'healthData.tratamientoMedico': getVal('prof-meds').trim(),
        'healthData.medicamentoActual': getVal('prof-meds').trim(),
        'healthData.condicionSalud': getVal('prof-health-note').trim(),
        'healthData.apoyoPsico': getVal('prof-mental-support').trim(),
        'healthData.sustancias': getVal('prof-substances').trim(),
        'culturalData.grupoEtnico': getVal('prof-pueblo').trim(),
        'culturalData.lenguaIndigena': getVal('prof-language').trim(),
        'culturalData.lenguaSenas': getVal('prof-sign-language').trim() || 'No',
        'culturalData.apoyoTecnico': getVal('prof-support-tech').trim(),
        'culturalData.ajustes': getVal('prof-adjustments').trim(),
        'prefs.theme': getVal('pref-theme') || 'system',
        'prefs.bannerStyle': _currentBanner
      };

      if (isStudent) {
        const dependentsQty = Math.max(0, parseInt(getVal('prof-dependents'), 10) || 0);
        const dependentsLabel = buildDependentsLabel(dependentsQty);
        updates.turno = getVal('prof-shift').trim();
        updates.trabaja = getVal('prof-work-status').trim() || 'No';
        updates.dependientes = dependentsLabel;
        updates.dependientesQty = dependentsQty;
        updates.beca = getVal('prof-scholarship').trim();
        updates['personalData.trabaja'] = updates.trabaja;
        updates['personalData.dependientes'] = dependentsLabel;
        updates['personalData.dependientesQty'] = dependentsQty;
        updates['personalData.beca'] = updates.beca;
      } else {
        updates.areaAdscripcion = getVal('prof-area').trim();
        updates['personalData.areaAdscripcion'] = updates.areaAdscripcion;
        updates.cubiculo = getVal('prof-cubiculo').trim();
        updates.extension = getVal('prof-extension').trim();
      }

      const disabilityList = normalizeDisabilityList(getVal('prof-disability').trim());
      updates.discapacidad = disabilityList.length ? disabilityList.join(', ') : 'Ninguna';
      updates['healthData.discapacidad'] = disabilityList;

      if (!document.getElementById('profile-maternity-block')?.classList.contains('d-none')) {
        updates['healthData.embarazo'] = getVal('prof-pregnancy').trim() || 'No';
        updates['healthData.lactancia'] = getVal('prof-lactation').trim() || 'No';
        updates['healthData.lactanciaTiempo'] = getVal('prof-lactation-time').trim();
      }

      const contacts = [];
      if (getVal('prof-emergency-name1').trim() || getVal('prof-emergency-tel1').trim()) {
        contacts.push({ nombre: getVal('prof-emergency-name1').trim(), parentesco: getVal('prof-emergency-rel1').trim(), telefono: getVal('prof-emergency-tel1').trim() });
      }
      if (getVal('prof-emergency-name2').trim() || getVal('prof-emergency-tel2').trim()) {
        contacts.push({ nombre: getVal('prof-emergency-name2').trim(), parentesco: getVal('prof-emergency-rel2').trim(), telefono: getVal('prof-emergency-tel2').trim() });
      }
      updates.contactoEmergenciaName = getVal('prof-emergency-name1').trim();
      updates.contactoEmergenciaTel = getVal('prof-emergency-tel1').trim();
      updates['healthData.contactoEmergencia'] = updates.contactoEmergenciaName;
      updates['healthData.contactoEmergenciaTel'] = updates.contactoEmergenciaTel;
      updates['healthData.contactos'] = contacts;

      try {
        await window.ProfileService.updateProfile(getServiceCtx(), updates);
        applyProfileUpdates(profile, updates);
        profile.personalData = profile.personalData || pd;
        applyThemePreference(getVal('pref-theme') || 'system');
        _isEditing = false;
        _hasChanges = false;
        render();
        updateFormState();
        emitProfileReady(profile, 'profile-save');
        window.showToast?.('Perfil actualizado correctamente', 'success');
      } catch (error) {
        console.error(error);
        window.showToast?.(`Error al guardar: ${error.message}`, 'danger');
      } finally {
        if (btn) {
          btn.innerHTML = originalText;
          btn.disabled = _isEditing ? !_hasChanges : true;
        }
      }
    }

    function selectBanner(bannerId, userInitiated = false) {
      const previousBanner = _currentBanner;
      applyBannerVisual(bannerId);
      if (!userInitiated) return;
      if (_isEditing) {
        setDirty();
        return;
      }
      saveBannerDirectly(_currentBanner, previousBanner);
    }

    async function saveBannerDirectly(bannerId, previousBannerId) {
      try {
        await savePreferencePatch({ bannerStyle: bannerId });
        window.showToast?.('Fondo actualizado', 'success');
      } catch (error) {
        console.error('[Profile] Error saving banner:', error);
        if (previousBannerId) applyBannerVisual(previousBannerId);
        window.showToast?.('No se pudo guardar el fondo', 'danger');
      }
    }

    async function togglePushNotifications() {
      const profile = getCurrentProfile();
      const uid = _ctx?.auth?.currentUser?.uid || profile?.uid || window.SIA?.auth?.currentUser?.uid;
      if (!uid) return window.showToast?.('No se encontro una sesion activa', 'danger');
      if (!window.PushService || !window.PushService.isSupported()) return window.showToast?.('Este dispositivo no soporta push', 'warning');
      if (_pushBusy) return;

      _pushBusy = true;
      await renderPushStatus(profile);

      try {
        const permission = typeof window.PushService.getPermissionStateAsync === 'function' ? await window.PushService.getPermissionStateAsync() : window.PushService.getPermissionState();
        const prefEnabled = getPrefs(profile).notifyPush !== false;
        const enabled = permission === 'granted' && prefEnabled;
        let success = false;
        let nextEnabled = enabled;

        if (enabled) {
          success = await window.PushService.unsubscribe(uid);
          nextEnabled = false;
        } else {
          success = await window.PushService.requestAndSubscribe(uid);
          nextEnabled = success;
        }

        if (!success && !enabled) {
          const latestPermission = typeof window.PushService.getPermissionStateAsync === 'function' ? await window.PushService.getPermissionStateAsync() : window.PushService.getPermissionState();
          return window.showToast?.(latestPermission === 'denied' ? 'Las notificaciones estan bloqueadas. Debes habilitarlas desde el navegador o el sistema.' : 'No se pudieron activar las notificaciones en este dispositivo.', 'warning');
        }

        if (!success && enabled) {
          return window.showToast?.('No se pudieron desactivar las notificaciones push.', 'warning');
        }

        await savePreferencePatch({ notifyPush: nextEnabled });
        emitProfileReady(profile, 'profile-push');
        window.showToast?.(nextEnabled ? 'Push activado en este dispositivo' : 'Push pausado en este dispositivo', nextEnabled ? 'success' : 'info');
      } catch (error) {
        console.error('[Profile] Error toggling push:', error);
        window.showToast?.(error?.message || 'No se pudo actualizar el estado push', 'danger');
      } finally {
        _pushBusy = false;
        await renderPushStatus(profile);
      }
    }

    async function handleUploadPhoto(event) {
      const file = event?.target?.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        window.showToast?.('Imagen muy grande (max 5MB)', 'warning');
        if (event?.target) event.target.value = '';
        return;
      }

      const uploadBtn = document.getElementById('btn-prof-pic-upload');
      const deleteBtn = document.getElementById('prof-pic-delete-btn');
      const originalUploadHTML = uploadBtn ? uploadBtn.innerHTML : '';
      const originalDeleteHTML = deleteBtn ? deleteBtn.innerHTML : '';

      try {
        if (uploadBtn) {
          uploadBtn.disabled = true;
          uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm text-white"></span>';
        }
        if (deleteBtn) deleteBtn.disabled = true;
        await window.ProfileService?.uploadProfilePhoto(getServiceCtx(), file);
        render();
        window.dispatchEvent(new CustomEvent('sia-auth-state-changed'));
        emitProfileReady(getCurrentProfile(), 'profile-photo');
        window.showToast?.('Foto actualizada', 'success');
      } catch (error) {
        console.error(error);
        window.showToast?.(error.message || 'Error al procesar foto', 'danger');
      } finally {
        if (event?.target) event.target.value = '';
        const currentUploadBtn = document.getElementById('btn-prof-pic-upload');
        const currentDeleteBtn = document.getElementById('prof-pic-delete-btn');
        if (currentUploadBtn) {
          currentUploadBtn.innerHTML = originalUploadHTML;
          currentUploadBtn.disabled = false;
        }
        if (currentDeleteBtn) {
          currentDeleteBtn.innerHTML = originalDeleteHTML;
          currentDeleteBtn.disabled = false;
        }
      }
    }

    function deletePhoto() {
      const modalEl = document.getElementById('modalDeletePhoto');
      if (modalEl) window.bootstrap?.Modal.getOrCreateInstance(modalEl).show();
    }

    async function confirmDeletePhoto() {
      const btnConfirm = document.getElementById('btn-confirm-delete-photo');
      const delBtn = document.getElementById('prof-pic-delete-btn');
      const originalConfirmHTML = btnConfirm ? btnConfirm.innerHTML : '';
      const originalDeleteHTML = delBtn ? delBtn.innerHTML : '';

      try {
        if (btnConfirm) {
          btnConfirm.disabled = true;
          btnConfirm.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        }
        if (delBtn) {
          delBtn.disabled = true;
          delBtn.innerHTML = '<span class="spinner-border spinner-border-sm text-danger"></span>';
        }

        await window.ProfileService?.deleteProfilePhoto(getServiceCtx());
        window.bootstrap?.Modal.getInstance(document.getElementById('modalDeletePhoto'))?.hide();
        render();
        window.dispatchEvent(new CustomEvent('sia-auth-state-changed'));
        emitProfileReady(getCurrentProfile(), 'profile-photo-delete');
        window.showToast?.('Foto eliminada', 'info');
      } catch (error) {
        console.error(error);
        window.showToast?.(error.message || 'Error al eliminar foto', 'danger');
      } finally {
        const currentConfirmBtn = document.getElementById('btn-confirm-delete-photo');
        const currentDeleteBtn = document.getElementById('prof-pic-delete-btn');
        if (currentConfirmBtn) {
          currentConfirmBtn.innerHTML = originalConfirmHTML;
          currentConfirmBtn.disabled = false;
        }
        if (currentDeleteBtn) {
          currentDeleteBtn.innerHTML = originalDeleteHTML;
          currentDeleteBtn.disabled = false;
        }
      }
    }

    function openDigitalID() {
      const nav = document.querySelector('sia-navbar');
      if (nav && typeof nav.openRefactoredDigitalID === 'function') return nav.openRefactoredDigitalID();
      const modalEl = document.getElementById('modalDigitalID');
      if (modalEl) window.bootstrap?.Modal.getOrCreateInstance(modalEl).show();
    }

    function goHome() {
      window.SIA?.navigate?.(getHomeViewId(getCurrentProfile()));
    }

    function openNotificationsCenter() {
      window.SIA?.navigate?.('view-notificaciones');
    }

    function openDashboardSettings() {
      const profile = getCurrentProfile();
      window.SIA?.navigate?.(isStudentProfile(profile) ? 'view-dashboard' : getHomeViewId(profile));
    }

    function openRecordModal() {
      startEditingAt('tab-context', isStudentProfile(getCurrentProfile()) ? 'prof-work-status' : 'prof-area');
    }

    function toggleEditRecordMode() {
      openRecordModal();
    }

    function cancelEditRecord() {
      cancelEdit();
      goToTab('tab-context');
    }

    function saveRecordChanges() {
      return saveChanges();
    }

    function openGoalsPanel() {
      openDashboardSettings();
    }

    function addSemesterGoal() {
      openDashboardSettings();
    }

    function removeSemesterGoal() {
      openDashboardSettings();
    }

    function renderActivityNow() {
      const profile = getCurrentProfile();
      if (!profile) return;
      renderActivityTimeline(profile);
      window.showToast?.('Actividad actualizada', 'info');
    }

    return {
      init,
      saveState,
      toggleEditMode,
      cancelEdit,
      saveChanges,
      goToTab,
      startEditingAt,
      selectBanner,
      togglePushNotifications,
      openDigitalID,
      goHome,
      openNotificationsCenter,
      openDashboardSettings,
      openRecordModal,
      toggleEditRecordMode,
      cancelEditRecord,
      saveRecordChanges,
      deletePhoto,
      confirmDeletePhoto,
      openGoalsPanel,
      addSemesterGoal,
      removeSemesterGoal,
      renderActivityNow
    };
  })();
}
