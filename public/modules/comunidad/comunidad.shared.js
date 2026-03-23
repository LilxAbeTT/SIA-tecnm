// public/modules/comunidad/comunidad.shared.js
// Helpers compartidos del módulo Comunidad

if (!window.ComunidadModule) window.ComunidadModule = {};

if (!window.ComunidadModule.Shared) {
    window.ComunidadModule.Shared = (function () {
        const TYPE_CONFIG = {
            general: {
                label: 'General',
                icon: 'bi-chat-square-heart-fill',
                accent: 'general',
                description: 'Comparte ideas, fotos o algo interesante del campus.',
                composer: {
                    kicker: 'Publicación general',
                    helper: 'Ideal para texto libre, viñetas rápidas o imágenes del día a día.',
                    titleLabel: 'Título opcional',
                    titlePlaceholder: '¿Qué quieres compartir?',
                    textLabel: 'Publicación',
                    textPlaceholder: 'Comparte una idea, foto o actualización con la comunidad.',
                    supportsBullets: true,
                    bulletLabel: 'Viñetas rápidas',
                    bulletPlaceholders: ['Idea principal', 'Detalle importante', 'Dato extra']
                }
            },
            perdido_encontrado: {
                label: 'Perdido / Encontrado',
                icon: 'bi-search-heart-fill',
                accent: 'lost',
                description: 'Reporta un objeto perdido o encontrado para ubicar a su dueño.',
                composer: {
                    kicker: 'Perdido o encontrado',
                    helper: 'Describe qué es, dónde se vio por última vez y cómo pueden contactarte.',
                    titleLabel: 'Objeto o referencia',
                    titlePlaceholder: 'Ej. Mochila negra con llavero rojo',
                    textLabel: 'Detalles',
                    textPlaceholder: 'Indica lugar, fecha aproximada y señas para identificarlo.',
                    supportsBullets: false,
                    bulletLabel: '',
                    bulletPlaceholders: []
                }
            },
            venta_promocion: {
                label: 'Venta / Promoción',
                icon: 'bi-bag-heart-fill',
                accent: 'sale',
                description: 'Publica artículos, servicios o promociones entre la comunidad.',
                composer: {
                    kicker: 'Venta o promoción',
                    helper: 'Aclara qué ofreces, condición, precio y forma de entrega.',
                    titleLabel: 'Producto o servicio',
                    titlePlaceholder: 'Ej. Calculadora científica seminueva',
                    textLabel: 'Detalles',
                    textPlaceholder: 'Explica precio, estado, punto de entrega o contacto.',
                    supportsBullets: false,
                    bulletLabel: '',
                    bulletPlaceholders: []
                }
            },
            pregunta: {
                label: 'Pregunta',
                icon: 'bi-patch-question-fill',
                accent: 'question',
                description: 'Pide ayuda o recomendaciones a estudiantes, docentes y personal.',
                composer: {
                    kicker: 'Pregunta a la comunidad',
                    helper: 'Plantea tu duda con contexto suficiente para recibir mejores respuestas.',
                    titleLabel: 'Pregunta o tema',
                    titlePlaceholder: 'Ej. ¿Alguien recomienda un buen sitio para imprimir?',
                    textLabel: 'Contexto',
                    textPlaceholder: 'Cuenta qué necesitas, qué ya intentaste o qué detalle importa.',
                    supportsBullets: false,
                    bulletLabel: '',
                    bulletPlaceholders: []
                }
            },
            aviso_comunidad: {
                label: 'Aviso',
                icon: 'bi-megaphone-fill',
                accent: 'notice',
                description: 'Comparte información útil o relevante para tu carrera o el campus.',
                composer: {
                    kicker: 'Aviso para la comunidad',
                    helper: 'Úsalo para comunicar información breve, clara y fácil de localizar.',
                    titleLabel: 'Encabezado del aviso',
                    titlePlaceholder: 'Ej. Cambio de salón para la reunión de hoy',
                    textLabel: 'Información',
                    textPlaceholder: 'Resume lo importante, horarios, lugar y cualquier indicación clave.',
                    supportsBullets: true,
                    bulletLabel: 'Puntos clave',
                    bulletPlaceholders: ['Qué cambió', 'Cuándo aplica', 'Qué deben hacer']
                }
            }
        };

        const SCOPE_CONFIG = {
            global: { label: 'Global', icon: 'bi-globe-americas' },
            career: { label: 'Mi carrera', icon: 'bi-mortarboard-fill' },
            group: { label: 'Grupo', icon: 'bi-people-fill' },
            members_only: { label: 'Solo miembros', icon: 'bi-shield-lock-fill' }
        };

        const IDENTITY_CONFIG = {
            student: { label: 'Alumno', className: 'is-student', icon: 'bi-mortarboard-fill' },
            docente: { label: 'Docente', className: 'is-docente', icon: 'bi-person-workspace' },
            personal: { label: 'Personal', className: 'is-personal', icon: 'bi-briefcase-fill' },
            official: { label: 'Cuenta oficial', className: 'is-official', icon: 'bi-patch-check-fill' },
            admin: { label: 'Admin Comunidad', className: 'is-admin', icon: 'bi-shield-check' }
        };

        function normalizeText(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();
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

        function showToast(message, type) {
            if (window.showToast) window.showToast(message, type);
            else if (window.SIA?.showToast) window.SIA.showToast(message, type);
            else window.alert(message);
        }

        function toDate(value) {
            if (!value) return null;
            if (value.toDate) return value.toDate();
            const date = value instanceof Date ? value : new Date(value);
            return Number.isNaN(date.getTime()) ? null : date;
        }

        function formatDate(value) {
            const date = toDate(value);
            if (!date) return '-';
            return date.toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function formatRelativeTime(value) {
            const date = toDate(value);
            if (!date) return 'ahora';
            const diffMs = Date.now() - date.getTime();
            const mins = Math.floor(diffMs / 60000);
            if (mins < 1) return 'ahora';
            if (mins < 60) return `hace ${mins} min`;
            const hours = Math.floor(mins / 60);
            if (hours < 24) return `hace ${hours} h`;
            const days = Math.floor(hours / 24);
            if (days < 7) return `hace ${days} d`;
            return formatDate(date);
        }

        function getTypeCfg(type) {
            return TYPE_CONFIG[type] || TYPE_CONFIG.general;
        }

        function getTypeComposerCfg(type) {
            return getTypeCfg(type).composer || TYPE_CONFIG.general.composer;
        }

        function getScopeCfg(scope) {
            return SCOPE_CONFIG[scope] || SCOPE_CONFIG.global;
        }

        function getIdentityCfg(kind) {
            return IDENTITY_CONFIG[kind] || IDENTITY_CONFIG.student;
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

        function getCareerLabel(profileOrPost) {
            return String(
                profileOrPost?.authorCareer ||
                profileOrPost?.career ||
                profileOrPost?.carrera ||
                ''
            ).trim();
        }

        function getAreaLabel(profileOrPost) {
            return String(
                profileOrPost?.authorArea ||
                profileOrPost?.departmentConfig?.label ||
                profileOrPost?.department ||
                profileOrPost?.area ||
                profileOrPost?.specialty ||
                profileOrPost?.especialidad ||
                ''
            ).trim();
        }

        function determineIdentity(profile) {
            const role = normalizeText(profile?.role);
            const category = window.SIA?.getProfileCategory ? window.SIA.getProfileCategory(profile) : (
                role === 'docente' ? 'docente' : (role === 'personal' ? 'personal' : 'student')
            );

            if (window.SIA?.canAdminComunidad?.(profile) || role === 'superadmin') {
                return {
                    kind: 'admin',
                    label: IDENTITY_CONFIG.admin.label,
                    meta: getAreaLabel(profile) || 'Administración'
                };
            }

            if (role === 'department_admin' || role === 'admin') {
                return {
                    kind: 'official',
                    label: IDENTITY_CONFIG.official.label,
                    meta: getAreaLabel(profile) || 'Institucional'
                };
            }

            if (category === 'docente' || role === 'docente') {
                return {
                    kind: 'docente',
                    label: IDENTITY_CONFIG.docente.label,
                    meta: getCareerLabel(profile) || getAreaLabel(profile)
                };
            }

            if (category === 'personal' || role === 'personal') {
                return {
                    kind: 'personal',
                    label: IDENTITY_CONFIG.personal.label,
                    meta: getAreaLabel(profile)
                };
            }

            return {
                kind: 'student',
                label: IDENTITY_CONFIG.student.label,
                meta: getCareerLabel(profile)
            };
        }

        function buildAuthorSnapshot(ctx, profile) {
            const identity = determineIdentity(profile || ctx?.profile || {});
            const uid = getUserUid(ctx, profile);
            return {
                authorId: uid,
                authorName: profile?.displayName || profile?.nombre || 'Usuario',
                authorPhotoURL: profile?.photoURL || '',
                authorRoleKind: identity.kind,
                authorRoleLabel: identity.label,
                authorCareer: getCareerLabel(profile),
                authorArea: getAreaLabel(profile)
            };
        }

        function renderPostBody(post) {
            const title = post?.title ? `<h4 class="comunidad-post-title">${escapeHtml(post.title)}</h4>` : '';
            const text = post?.text ? `<p class="comunidad-post-text">${escapeHtml(post.text).replace(/\r?\n/g, '<br>')}</p>` : '';
            const bullets = Array.isArray(post?.bullets) && post.bullets.length
                ? `<ul class="comunidad-post-bullets">${post.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
                : '';
            return `${title}${text}${bullets}`;
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
                        throw new Error(`[${moduleName}] Método no disponible: ${name}`);
                    }
                    return target(...args);
                };
            });
            return api;
        }

        return {
            TYPE_CONFIG,
            SCOPE_CONFIG,
            IDENTITY_CONFIG,
            normalizeText,
            escapeHtml,
            escapeAttr,
            escapeInlineText,
            showToast,
            toDate,
            formatDate,
            formatRelativeTime,
            getTypeCfg,
            getTypeComposerCfg,
            getScopeCfg,
            getIdentityCfg,
            getUserUid,
            getCareerLabel,
            getAreaLabel,
            determineIdentity,
            buildAuthorSnapshot,
            renderPostBody,
            createDelegatedApi
        };
    })();
}
