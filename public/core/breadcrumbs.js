import { Store } from './state.js';

const BREADCRUMB_EVENT = 'sia-breadcrumbs-changed';

const VIEW_META = Object.freeze({
    'view-dashboard': {
        label: 'Inicio',
        pillLabel: 'Dashboard',
        color: 'var(--primary, #1B396A)',
        hidePill: true
    },
    'view-aula': {
        label: 'Aula Virtual',
        pillLabel: 'Aula Virtual',
        color: 'var(--aula, #4e1bda)'
    },
    'view-aula-course': {
        label: 'Curso',
        pillLabel: 'Curso',
        color: 'var(--aula, #4e1bda)',
        parentViewId: 'view-aula'
    },
    'view-comunidad': {
        label: 'Comunidad',
        pillLabel: 'Comunidad',
        color: '#059669'
    },
    'view-biblio': {
        label: 'Biblioteca',
        pillLabel: 'Biblioteca',
        color: 'var(--biblio, #FFD24D)'
    },
    'view-medi': {
        label: 'Servicios Medicos',
        pillLabel: 'Servicios Medicos',
        color: 'var(--med, #00D0FF)'
    },
    'view-foro': {
        label: 'Eventos',
        pillLabel: 'Eventos',
        color: '#14532d'
    },
    'view-profile': {
        label: 'Mi Perfil',
        pillLabel: 'Mi Perfil',
        color: 'var(--primary, #1B396A)'
    },
    'view-superadmin-dashboard': {
        label: 'SuperAdmin',
        pillLabel: 'SuperAdmin',
        color: 'var(--primary, #1B396A)'
    },
    'view-lactario': {
        label: 'Lactario',
        pillLabel: 'Lactario',
        color: '#E83E8C'
    },
    'view-quejas': {
        label: 'Quejas',
        pillLabel: 'Quejas',
        color: '#10b981'
    },
    'view-reportes': {
        label: 'Reportes',
        pillLabel: 'Reportes',
        color: 'var(--reportes, #6610f2)'
    },
    'view-encuestas': {
        label: 'Encuestas',
        pillLabel: 'Encuestas',
        color: '#f59e0b'
    },
    'view-encuesta-publica': {
        label: 'Encuesta Publica',
        pillLabel: 'Encuesta Publica',
        color: '#f59e0b',
        hidePill: true,
        rootViewId: null
    },
    'view-register': {
        label: 'Registro',
        pillLabel: 'Registro',
        color: 'var(--primary, #1B396A)',
        hidePill: true,
        rootViewId: null
    },
    'view-test-vocacional': {
        label: 'Test Vocacional',
        pillLabel: 'Vocacional',
        color: '#0ea5e9',
        hidePill: true,
        rootViewId: null
    },
    'view-vocacional-test-active': {
        label: 'Test Activo',
        pillLabel: 'Vocacional',
        color: '#0ea5e9',
        hidePill: true,
        rootViewId: null,
        parentViewId: 'view-test-vocacional'
    },
    'view-vocacional-admin': {
        label: 'Vocacional Admin',
        pillLabel: 'Vocacional Admin',
        color: '#0ea5e9'
    },
    'view-cafeteria': {
        label: 'Cafeteria',
        pillLabel: 'Cafeteria',
        color: 'var(--cafeteria, #f97316)'
    },
    'view-avisos': {
        label: 'Avisos',
        pillLabel: 'Avisos',
        color: 'var(--primary, #1B396A)'
    },
    'view-notificaciones': {
        label: 'Notificaciones',
        pillLabel: 'Notificaciones',
        color: 'var(--primary, #1B396A)'
    },
    'view-qa-secret-login': {
        label: 'Portal QA',
        pillLabel: 'Portal QA',
        color: '#0ea5e9',
        hidePill: true,
        rootViewId: null
    }
});

const ROOT_CRUMB = Object.freeze({
    label: 'Inicio',
    viewId: 'view-dashboard'
});

let _state = null;

function getRootCrumb(options = {}) {
    if (Object.prototype.hasOwnProperty.call(options, 'rootViewId')) {
        if (!options.rootViewId) return null;
        return {
            label: options.rootLabel || ROOT_CRUMB.label,
            viewId: options.rootViewId
        };
    }

    const profile = Store.userProfile || (typeof window !== 'undefined' ? window.SIA?.currentUserProfile : null) || null;
    const homeViewId = typeof window !== 'undefined' && window.SIA?.getHomeView
        ? window.SIA.getHomeView(profile)
        : ROOT_CRUMB.viewId;

    return {
        label: options.rootLabel || ROOT_CRUMB.label,
        viewId: homeViewId || ROOT_CRUMB.viewId
    };
}

function cloneTrail(trail) {
    return (Array.isArray(trail) ? trail : []).map((item) => ({
        label: item?.label || '',
        viewId: item?.viewId || '',
        current: Boolean(item?.current)
    }));
}

function cloneState(state) {
    if (!state) return null;
    return {
        ...state,
        trail: cloneTrail(state.trail)
    };
}

function getMeta(viewId) {
    return VIEW_META[viewId] || null;
}

function getViewLabel(viewId, fallback = 'SIA') {
    return getMeta(viewId)?.label || fallback;
}

function getPillLabel(viewId, fallback = '') {
    const meta = getMeta(viewId);
    return meta?.pillLabel || meta?.label || fallback;
}

function getViewColor(viewId, fallback = 'var(--primary, #1B396A)') {
    return getMeta(viewId)?.color || fallback;
}

function buildTrail(viewId, options = {}) {
    const meta = getMeta(viewId);
    if (!meta) {
        return [{
            label: options.label || viewId || 'SIA',
            viewId: viewId || '',
            current: true
        }];
    }

    const trail = [];
    const rootCrumb = Object.prototype.hasOwnProperty.call(meta, 'rootViewId')
        ? getRootCrumb({ ...options, rootViewId: meta.rootViewId })
        : getRootCrumb(options);

    if (rootCrumb?.viewId) {
        trail.push({
            label: rootCrumb.label,
            viewId: rootCrumb.viewId,
            current: false
        });
    }

    if (meta.parentViewId) {
        trail.push({
            label: options.parentLabel || getViewLabel(meta.parentViewId, meta.parentViewId),
            viewId: meta.parentViewId,
            current: false
        });
    }

    const currentLabel = options.label || meta.label || viewId || 'SIA';
    const currentCrumb = {
        label: currentLabel,
        viewId: viewId || '',
        current: true
    };

    if (!trail.length) {
        return [currentCrumb];
    }

    const last = trail[trail.length - 1];
    const sameAsLast = last?.viewId === currentCrumb.viewId && last?.label === currentCrumb.label;
    if (sameAsLast) {
        trail[trail.length - 1] = { ...currentCrumb };
        return trail;
    }

    return [...trail, currentCrumb];
}

function buildState(viewId, options = {}) {
    const trail = cloneTrail(options.trail?.length ? options.trail : buildTrail(viewId, options));
    const lastCrumb = trail[trail.length - 1] || null;
    const meta = getMeta(viewId);

    if (lastCrumb) {
        trail.forEach((crumb, index) => {
            crumb.current = index === trail.length - 1;
        });
    }

    return {
        viewId: viewId || '',
        label: lastCrumb?.label || options.label || getViewLabel(viewId),
        pillLabel: options.pillLabel || getPillLabel(viewId, lastCrumb?.label || options.label || ''),
        color: options.color || getViewColor(viewId),
        trail,
        hidePill: typeof options.hidePill === 'boolean' ? options.hidePill : Boolean(meta?.hidePill),
        source: options.source || (options.trail?.length ? 'custom' : 'view'),
        updatedAt: Date.now()
    };
}

function emit(state) {
    _state = cloneState(state);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(BREADCRUMB_EVENT, { detail: cloneState(_state) }));
    }
    return getState();
}

function setView(viewId, options = {}) {
    return emit(buildState(viewId, options));
}

function setTrail(viewId, trail, options = {}) {
    return emit(buildState(viewId, { ...options, trail, source: 'custom' }));
}

function setSection(viewId, section, options = {}) {
    const sectionConfig = typeof section === 'string'
        ? { label: section }
        : (section && typeof section === 'object' ? section : {});
    const sectionLabel = String(sectionConfig.label || options.sectionLabel || '').trim();

    if (!sectionLabel) {
        return setView(viewId, options);
    }

    const trail = cloneTrail(buildTrail(viewId, options));
    const moduleCrumb = trail[trail.length - 1] || null;

    if (moduleCrumb) {
        moduleCrumb.current = false;
        if (options.moduleClickable === false && moduleCrumb.viewId === viewId) {
            moduleCrumb.viewId = '';
        }
    }

    trail.push({
        label: sectionLabel,
        viewId: sectionConfig.viewId || options.sectionViewId || '',
        current: true
    });

    return emit(buildState(viewId, {
        ...options,
        label: sectionLabel,
        pillLabel: options.pillLabel || sectionConfig.pillLabel || sectionLabel,
        trail,
        source: 'section'
    }));
}

function clear() {
    _state = null;
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(BREADCRUMB_EVENT, { detail: null }));
    }
}

function getState() {
    return cloneState(_state);
}

function subscribe(callback) {
    if (typeof callback !== 'function' || typeof window === 'undefined') {
        return () => { };
    }

    const handler = (event) => callback(cloneState(event.detail));
    window.addEventListener(BREADCRUMB_EVENT, handler);
    return () => window.removeEventListener(BREADCRUMB_EVENT, handler);
}

export const Breadcrumbs = {
    eventName: BREADCRUMB_EVENT,
    getMeta,
    getState,
    getViewColor,
    getViewLabel,
    getPillLabel,
    setView,
    setTrail,
    setSection,
    clear,
    subscribe
};

if (typeof window !== 'undefined') {
    window.SIABreadcrumbs = Breadcrumbs;
}
