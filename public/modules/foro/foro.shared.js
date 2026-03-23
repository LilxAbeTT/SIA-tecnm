// public/modules/foro/foro.shared.js
// Helpers compartidos de Eventos

if (!window.ForoModule) window.ForoModule = {};

if (!window.ForoModule.Shared) {
    window.ForoModule.Shared = (function () {
        const FAVORITES_STORAGE_KEY = 'foro_favorites';
        const AUDIENCE_LABELS = {
            ALL: 'Todas las carreras',
            ISC: 'Sistemas',
            ITIC: 'Tecnologias',
            ARQ: 'Arquitectura',
            CIV: 'Civil',
            ADM: 'Administracion',
            CON: 'Contador Publico',
            GAS: 'Gastronomia',
            TUR: 'Turismo',
            ELE: 'Electromecanica'
        };

        const TYPE_CONFIG = {
            conferencia: { icon: 'bi-mic-fill', color: 'primary', label: 'Conferencia' },
            exposicion: { icon: 'bi-easel-fill', color: 'info', label: 'Exposicion' },
            otro: { icon: 'bi-calendar-event', color: 'secondary', label: 'Evento' }
        };

        const STATUS_CONFIG = {
            active: { icon: 'bi-check-circle-fill', color: 'success', label: 'Publicado' },
            pending: { icon: 'bi-hourglass-split', color: 'warning', label: 'En revision' },
            rejected: { icon: 'bi-x-circle-fill', color: 'danger', label: 'Rechazado' },
            cancelled: { icon: 'bi-slash-circle-fill', color: 'secondary', label: 'Cancelado' }
        };

        function show(el) {
            el?.classList.remove('d-none');
        }

        function hide(el) {
            el?.classList.add('d-none');
        }

        function toDate(value) {
            if (!value) return null;
            if (value.toDate) return value.toDate();
            const date = value instanceof Date ? value : new Date(value);
            return Number.isNaN(date.getTime()) ? null : date;
        }

        function formatDate(date) {
            const value = toDate(date);
            if (!value) return '-';
            return value.toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function formatShortDate(date) {
            const value = toDate(date);
            if (!value) return { month: '', day: '' };
            return {
                month: value.toLocaleString('es-MX', { month: 'short' }).toUpperCase(),
                day: value.getDate()
            };
        }

        function formatTime(date) {
            const value = toDate(date);
            return value ? value.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '--:--';
        }

        function formatTimeRange(event) {
            const start = toDate(event?.date || event?.eventDate);
            const end = toDate(event?.endDate || event?.eventEndDate);
            if (!start) return '-';
            if (!end) return formatTime(start);
            return `${formatTime(start)} - ${formatTime(end)}`;
        }

        function getTypeCfg(type) {
            return TYPE_CONFIG[type] || TYPE_CONFIG.otro;
        }

        function getStatusCfg(status) {
            return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
        }

        function showToast(msg, type) {
            if (window.showToast) window.showToast(msg, type);
            else if (window.SIA?.showToast) window.SIA.showToast(msg, type);
            else window.alert(msg);
        }

        function getUserUid(ctx, fallbackProfile) {
            return (
                ctx?.user?.uid ||
                ctx?.auth?.currentUser?.uid ||
                fallbackProfile?.uid ||
                ctx?.profile?.uid ||
                null
            );
        }

        function determineRoles(profile) {
            const email = String(profile?.emailInstitucional || profile?.email || '').toLowerCase();
            const foroPermission = String(profile?.permissions?.foro || '').toLowerCase();
            const role = String(profile?.role || '').toLowerCase();
            const isDifusion = email === 'difusion@loscabos.tecnm.mx' || role === 'foro' || foroPermission === 'superadmin';
            const isAdmin = isDifusion || role === 'foro_admin' || foroPermission === 'admin' || foroPermission === 'superadmin';
            return {
                isAdmin,
                isDifusion,
                isDivisionHead: isAdmin && !isDifusion
            };
        }

        function formatAudience(targetAudience, fallback) {
            const values = Array.isArray(targetAudience) && targetAudience.length
                ? targetAudience
                : (fallback || ['ALL']);
            return values.map((value) => AUDIENCE_LABELS[value] || value).join(', ');
        }

        function escapeHtml(text) {
            return String(text || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function escapeAttr(text) {
            return escapeHtml(text);
        }

        function escapeInlineText(text) {
            return String(text || '')
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\r?\n/g, ' ');
        }

        function loadFavorites() {
            try {
                const stored = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]');
                return Array.isArray(stored) ? stored : [];
            } catch (error) {
                return [];
            }
        }

        async function loadFavoriteIds(ctx, profile) {
            const local = loadFavorites();
            const uid = getUserUid(ctx, profile);
            if (!uid || !window.SIA?.getUserPreferences) return local;
            try {
                const prefs = await window.SIA.getUserPreferences(uid);
                const remote = Array.isArray(prefs?.foroFavoriteEventIds) ? prefs.foroFavoriteEventIds : [];
                return Array.from(new Set([...local, ...remote]));
            } catch (error) {
                return local;
            }
        }

        async function saveFavoriteIds(ctx, profile, favorites) {
            const unique = Array.from(new Set((favorites || []).filter(Boolean)));
            localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(unique));
            const uid = getUserUid(ctx, profile);
            if (!uid || !window.SIA?.updateUserPreferences) return unique;
            try {
                await window.SIA.updateUserPreferences(uid, { foroFavoriteEventIds: unique });
            } catch (error) {
                console.warn('[Eventos] No se pudieron sincronizar favoritos:', error);
            }
            return unique;
        }

        function getEventWindow(event) {
            const start = toDate(event?.date || event?.eventDate);
            const end = toDate(event?.endDate || event?.eventEndDate) || (start ? new Date(start.getTime() + 90 * 60 * 1000) : null);
            const opensMinutesBefore = Math.max(0, Number(event?.attendanceOpensMinutesBefore) || 30);
            const closesMinutesAfter = Math.max(15, Number(event?.attendanceClosesMinutesAfter) || 120);
            const openAt = start ? new Date(start.getTime() - opensMinutesBefore * 60 * 1000) : null;
            const closeBase = end || start;
            const closeAt = closeBase ? new Date(closeBase.getTime() + closesMinutesAfter * 60 * 1000) : null;
            return { start, end, openAt, closeAt };
        }

        function getEventPhase(event) {
            const now = new Date();
            const { start, end, openAt, closeAt } = getEventWindow(event);
            if (!start) return { key: 'unknown', label: '-', variant: 'secondary', icon: 'bi-calendar' };
            if (closeAt && now > closeAt) return { key: 'closed', label: 'Finalizado', variant: 'secondary', icon: 'bi-check-circle-fill' };
            if (openAt && now >= openAt && start && now < start) return { key: 'checkin', label: 'Asistencia abierta', variant: 'warning', icon: 'bi-qr-code-scan', pulse: true };
            if (start && end && now >= start && now <= end) return { key: 'live', label: 'En curso', variant: 'success', icon: 'bi-broadcast', pulse: true };
            if (start && now < start) {
                const diff = start.getTime() - now.getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 60) return { key: 'soon', label: `En ${mins} min`, variant: 'warning', icon: 'bi-clock-fill' };
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                if (start.toDateString() === now.toDateString()) return { key: 'today', label: `Hoy ${formatTime(start)}`, variant: 'info', icon: 'bi-calendar-check' };
                if (start.toDateString() === tomorrow.toDateString()) return { key: 'tomorrow', label: `Manana ${formatTime(start)}`, variant: 'info', icon: 'bi-sunrise' };
                return { key: 'upcoming', label: formatDate(start), variant: 'secondary', icon: 'bi-calendar' };
            }
            return { key: 'ended', label: 'Cerrado', variant: 'secondary', icon: 'bi-calendar-x' };
        }

        function createDelegatedApi(moduleName, createController, methodNames) {
            let controller = null;

            function ensureController() {
                if (!controller) controller = createController();
                return controller;
            }

            const api = {};
            methodNames.forEach((name) => {
                api[name] = (...args) => {
                    const target = ensureController()[name];
                    if (typeof target !== 'function') {
                        throw new Error(`[${moduleName}] Metodo no disponible: ${name}`);
                    }
                    return target(...args);
                };
            });
            return api;
        }

        return {
            TYPE_CONFIG,
            STATUS_CONFIG,
            AUDIENCE_LABELS,
            show,
            hide,
            toDate,
            formatDate,
            formatShortDate,
            formatTime,
            formatTimeRange,
            getTypeCfg,
            getStatusCfg,
            showToast,
            getUserUid,
            determineRoles,
            formatAudience,
            escapeHtml,
            escapeAttr,
            escapeInlineText,
            loadFavorites,
            loadFavoriteIds,
            saveFavoriteIds,
            getEventWindow,
            getEventPhase,
            createDelegatedApi
        };
    })();
}
