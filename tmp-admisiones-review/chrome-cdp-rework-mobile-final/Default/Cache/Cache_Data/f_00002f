// public/modules/lactario/lactario.shared.js
// Shared helpers and shell for Lactario

if (!window.LactarioModule) window.LactarioModule = {};

if (!window.LactarioModule.Shared) {
    window.LactarioModule.Shared = (function () {
        const STATUS_META = {
            confirmed: { label: 'Confirmada', className: 'bg-warning-subtle text-warning border border-warning-subtle' },
            'checked-in': { label: 'En curso', className: 'bg-success-subtle text-success border border-success-subtle' },
            completed: { label: 'Completada', className: 'bg-primary-subtle text-primary border border-primary-subtle' },
            cancelled: { label: 'Cancelada', className: 'bg-danger-subtle text-danger border border-danger-subtle' },
            'no-show': { label: 'No-show', className: 'bg-secondary-subtle text-secondary border border-secondary-subtle' }
        };

        const SUPPORT_META = {
            confirmada: { label: 'Apoyo médico confirmado', className: 'bg-success-subtle text-success border border-success-subtle' },
            pendiente: { label: 'Apoyo en espera', className: 'bg-warning-subtle text-warning border border-warning-subtle' },
            creating: { label: 'Generando apoyo médico', className: 'bg-info-subtle text-info border border-info-subtle' },
            cancelled: { label: 'Apoyo cancelado', className: 'bg-secondary-subtle text-secondary border border-secondary-subtle' },
            error: { label: 'Apoyo con incidencia', className: 'bg-danger-subtle text-danger border border-danger-subtle' },
            warning: { label: 'Revisar sincronización médica', className: 'bg-warning-subtle text-warning border border-warning-subtle' }
        };

        function escapeHtmlFallback(value) {
            return String(value ?? '').replace(/[&<>"']/g, (char) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[char]));
        }

        function safeText(value) {
            return typeof escapeHtml === 'function'
                ? escapeHtml(String(value ?? ''))
                : escapeHtmlFallback(value);
        }

        function safeAttr(value) {
            return safeText(value);
        }

        function safeJsString(value) {
            return escapeHtmlFallback(
                String(value ?? '')
                    .replace(/\\/g, '\\\\')
                    .replace(/'/g, "\\'")
                    .replace(/\r/g, '\\r')
                    .replace(/\n/g, '\\n')
            );
        }

        function show(el) {
            el?.classList.remove('d-none');
        }

        function hide(el) {
            el?.classList.add('d-none');
        }

        function getEl(id) {
            return document.getElementById(id);
        }

        function setText(id, value) {
            const el = getEl(id);
            if (el) el.textContent = value;
        }

        function setHtml(id, value) {
            const el = getEl(id);
            if (el) el.innerHTML = value;
        }

        function showToastCompat(message, type = 'info') {
            if (typeof window.showToast === 'function') window.showToast(message, type);
            else if (typeof window.SIA?.showToast === 'function') window.SIA.showToast(message, type);
            else console.warn('[Lactario]', type, message);
        }

        const pad = (n) => String(n).padStart(2, '0');

        function toDate(value) {
            if (!value) return null;
            if (value.toDate) return value.toDate();
            const parsed = value instanceof Date ? value : new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        function toISO(date) {
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        }

        function toLocalISO(date) {
            const parsed = toDate(date);
            if (!parsed) return '';
            const copy = new Date(parsed.getTime());
            copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
            return copy.toISOString().split('T')[0];
        }

        function formatDate(value, options = {}) {
            const date = toDate(value);
            if (!date) return '-';
            return date.toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                ...options
            });
        }

        function formatDateTime(value) {
            const date = toDate(value);
            if (!date) return '-';
            return date.toLocaleString('es-MX', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function formatTime(value) {
            const date = toDate(value);
            if (date) {
                return date.toLocaleTimeString('es-MX', {
                    hour: 'numeric',
                    minute: '2-digit'
                });
            }

            if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) {
                const [hours, minutes] = value.split(':').map(Number);
                const suffix = hours >= 12 ? 'PM' : 'AM';
                const h12 = hours % 12 || 12;
                return `${h12}:${pad(minutes)} ${suffix}`;
            }

            return value || '--';
        }

        function formatDurationHours(minutes) {
            const hours = Math.round(((minutes || 0) / 60) * 10) / 10;
            return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
        }

        function getDateBounds(maxDays = 7) {
            const today = new Date();
            const max = new Date();
            max.setDate(today.getDate() + maxDays);
            return {
                minDate: toLocalISO(today),
                maxDate: toLocalISO(max),
                today: toLocalISO(today),
                tomorrow: toLocalISO(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))
            };
        }

        function getFirstName(profile, user) {
            const rawName = profile?.displayName || user?.displayName || 'Usuario';
            return safeText((rawName || '').trim().split(/\s+/)[0] || 'Usuario');
        }

        function parseLegacyMonths(rawValue) {
            if (rawValue === null || rawValue === undefined || rawValue === '') return null;
            const match = String(rawValue).trim().match(/\d+/);
            if (!match) return null;
            const months = Number(match[0]);
            return Number.isFinite(months) ? months : null;
        }

        function getEligibilitySummary(profile) {
            const startValue = profile?.healthData?.lactanciaInicio || profile?.lactanciaInicio;
            const startDate = toDate(startValue);
            const now = new Date();
            let monthsElapsed = 0;
            let source = 'date';

            if (startDate) {
                monthsElapsed = (now.getFullYear() - startDate.getFullYear()) * 12;
                monthsElapsed -= startDate.getMonth();
                monthsElapsed += now.getMonth();
                if (now.getDate() < startDate.getDate()) monthsElapsed -= 1;
                monthsElapsed = Math.max(0, monthsElapsed);
            } else {
                source = 'legacy';
                monthsElapsed = parseLegacyMonths(profile?.healthData?.lactanciaTiempo || profile?.lactanciaTiempo) || 0;
            }

            const monthsRemaining = Math.max(0, 7 - monthsElapsed);
            const progressPercent = Math.max(0, Math.min(100, Math.round((monthsElapsed / 7) * 100)));

            return {
                startDate,
                startLabel: startDate ? formatDate(startDate, { month: 'long' }) : 'Pendiente',
                monthsElapsed,
                monthsRemaining,
                progressPercent,
                source,
                windowText: monthsRemaining > 0
                    ? `${monthsRemaining} ${monthsRemaining === 1 ? 'mes restante' : 'meses restantes'}`
                    : 'Ventana concluida'
            };
        }

        function getStatusMeta(status) {
            return STATUS_META[status] || {
                label: status || 'Sin estado',
                className: 'bg-light text-muted border'
            };
        }

        function renderStatusBadge(status) {
            const meta = getStatusMeta(status);
            return `<span class="badge rounded-pill ${meta.className}">${safeText(meta.label)}</span>`;
        }

        function getSupportMeta(status) {
            if (!status) return null;
            return SUPPORT_META[status] || {
                label: status,
                className: 'bg-light text-muted border'
            };
        }

        function renderSupportBadge(status) {
            const meta = getSupportMeta(status);
            if (!meta) return '';
            return `<span class="badge rounded-pill ${meta.className}">${safeText(meta.label)}</span>`;
        }

        function createState() {
            const bounds = getDateBounds();
            return {
                ctx: null,
                profile: null,
                access: null,
                config: null,
                mode: 'student',
                activeBooking: null,
                scanner: null,
                scanMode: 'access',
                timerInterval: null,
                student: {
                    selectedDate: bounds.today,
                    selectedTime: '',
                    dateTab: 'today',
                    availableSlots: [],
                    bookingHistory: [],
                    summary: null,
                    fridgeItems: [],
                    formMode: 'create',
                    rescheduleBookingId: null
                },
                admin: {
                    activeTab: 'overview',
                    overviewDate: bounds.today,
                    agendaDate: bounds.today,
                    agendaStatus: 'all',
                    agendaType: 'all',
                    overview: null,
                    agendaBookings: [],
                    spaces: [],
                    fridges: [],
                    fridgeItems: [],
                    currentStats: null,
                    currentRange: '7days',
                    charts: {}
                }
            };
        }

        function clearTimer(state) {
            if (state?.timerInterval) {
                clearInterval(state.timerInterval);
                state.timerInterval = null;
            }
        }

        async function stopScanner(state) {
            if (state?.scanner) {
                try {
                    await state.scanner.clear();
                } catch (error) {
                    console.warn('[Lactario] stopScanner:', error);
                }
                state.scanner = null;
            }
        }

        function renderAccessDenied(container, reason) {
            container.innerHTML = `
                <div class="d-flex flex-column align-items-center justify-content-center min-vh-50 py-5 text-center">
                    <div class="bg-danger bg-opacity-10 p-4 rounded-circle mb-3 text-danger">
                        <i class="bi bi-slash-circle display-1"></i>
                    </div>
                    <h2 class="fw-bold mb-2">Acceso Restringido</h2>
                    <p class="text-muted mb-4" style="max-width: 520px;">${safeText(reason)}</p>
                    <div class="small text-muted">Si crees que esto es un error, actualiza tu perfil o contacta a Calidad.</div>
                    <button class="btn btn-primary rounded-pill mt-4" onclick="SIA.navigate('view-dashboard')">Volver al Inicio</button>
                </div>
            `;
        }

        function renderLayout(container, { isAdmin, content }) {
            container.innerHTML = `
                <style>
                    .text-maternal { color: #d63384 !important; }
                    .bg-maternal { background-color: #d63384 !important; }
                    .bg-maternal-soft { background: linear-gradient(145deg, rgba(214, 51, 132, 0.18), rgba(255, 255, 255, 0.95)); }
                    .btn-maternal { background-color: #d63384; color: #fff; border: 0; }
                    .btn-maternal:hover { background-color: #b2266a; color: #fff; }
                    .btn-outline-maternal { color: #d63384; border: 1px solid rgba(214, 51, 132, 0.45); background-color: #fff; }
                    .btn-outline-maternal:hover { color: #b2266a; border-color: #b2266a; background-color: rgba(214, 51, 132, 0.08); }
                    .border-maternal-soft { border-color: rgba(214, 51, 132, 0.18) !important; }
                    .lactario-shell .card { border-radius: 1.25rem; }
                    .lactario-shell .nav-pills .nav-link.active { background-color: #d63384; color: #fff; }
                    .lactario-shell .nav-pills .nav-link { color: #7a3b58; }
                    .lactario-hero {
                        background: radial-gradient(circle at top right, rgba(255,255,255,0.75), transparent 45%),
                            linear-gradient(135deg, rgba(214, 51, 132, 0.18), rgba(255, 247, 250, 0.94));
                        border: 1px solid rgba(214, 51, 132, 0.12);
                    }
                    .lactario-stat-card { min-height: 110px; }
                    .lactario-slot-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 0.75rem;
                    }
                    .lactario-slot-card {
                        border: 1px solid rgba(214, 51, 132, 0.15);
                        background: #fff;
                        border-radius: 1rem;
                        padding: 0.9rem;
                        text-align: left;
                        transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
                    }
                    .lactario-slot-card:hover { transform: translateY(-2px); border-color: rgba(214, 51, 132, 0.38); box-shadow: 0 8px 18px rgba(214, 51, 132, 0.08); }
                    .lactario-slot-card.is-active { border-color: rgba(214, 51, 132, 0.75); box-shadow: 0 10px 20px rgba(214, 51, 132, 0.12); background: rgba(255, 242, 248, 0.95); }
                    .lactario-slot-card.is-full { opacity: 0.6; cursor: not-allowed; }
                    .lactario-mini-list article + article { margin-top: 0.75rem; }
                    .lactario-admin-tab.active { background: rgba(214, 51, 132, 0.12); color: #b2266a !important; }
                    .lactario-admin-booking + .lactario-admin-booking { margin-top: 0.75rem; }
                    .lactario-admin-actions .btn { margin-right: 0.4rem; margin-bottom: 0.4rem; }
                    .lactario-progress { height: 0.6rem; border-radius: 999px; overflow: hidden; background: rgba(214, 51, 132, 0.1); }
                    .lactario-progress > span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #f472b6, #d63384); }
                    .lactario-muted-panel { background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(249, 250, 251, 0.98)); }
                    .lactario-hero-title { font-size: clamp(1.8rem, 2.3vw, 2.6rem); }
                    .lactario-quick-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 1rem;
                    }
                    .lactario-booking-card {
                        border: 1px solid rgba(214, 51, 132, 0.12);
                        border-radius: 1rem;
                        background: #fff;
                        padding: 1rem;
                    }
                    .lactario-booking-card + .lactario-booking-card { margin-top: 0.75rem; }
                    .lactario-kpi {
                        border-radius: 1rem;
                        padding: 1rem;
                        background: #fff;
                        border: 1px solid rgba(148, 163, 184, 0.16);
                    }
                    .lactario-kpi strong {
                        display: block;
                        font-size: 1.5rem;
                        line-height: 1.1;
                        color: #111827;
                    }
                    .lactario-kpi span {
                        font-size: 0.82rem;
                        color: #6b7280;
                    }
                    .lactario-timeline-list article + article { margin-top: 0.75rem; }
                    .lactario-timeline-item {
                        border: 1px solid rgba(214, 51, 132, 0.08);
                        border-radius: 1rem;
                        padding: 0.9rem 1rem;
                        background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(252, 250, 251, 0.98));
                    }
                    .lactario-filter-row {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 0.75rem;
                        align-items: end;
                    }
                    .lactario-empty {
                        border: 1px dashed rgba(148, 163, 184, 0.4);
                        border-radius: 1rem;
                        padding: 1.4rem;
                        background: rgba(255,255,255,0.75);
                        text-align: center;
                        color: #6b7280;
                    }
                    .lactario-actions-cluster {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 0.5rem;
                    }
                    .lactario-soft-note {
                        border-radius: 1rem;
                        border: 1px solid rgba(214, 51, 132, 0.12);
                        background: rgba(255, 247, 250, 0.88);
                        padding: 0.9rem 1rem;
                    }
                    .lactario-pill-toggle {
                        display: inline-flex;
                        gap: 0.35rem;
                        padding: 0.25rem;
                        border-radius: 999px;
                        background: rgba(214, 51, 132, 0.08);
                    }
                    .lactario-pill-toggle .btn.active {
                        background: #d63384;
                        color: #fff;
                    }
                    .lactario-progress-labels {
                        display: flex;
                        justify-content: space-between;
                        font-size: 0.78rem;
                        color: #6b7280;
                        margin-top: 0.45rem;
                    }
                    .lactario-metric-bar {
                        height: 0.55rem;
                        border-radius: 999px;
                        background: rgba(148, 163, 184, 0.18);
                        overflow: hidden;
                    }
                    .lactario-metric-bar > span {
                        display: block;
                        height: 100%;
                        border-radius: inherit;
                        background: linear-gradient(90deg, #fb7185, #d63384);
                    }
                </style>
                <div id="lactario-app" class="lactario-shell animate-fade-in">
                    ${content}
                </div>

                <div class="modal fade" id="modalLactarioQR" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content rounded-4 border-0 shadow">
                            <div class="modal-header border-0 pb-0">
                                <h5 class="fw-bold modal-title">Escanear QR de Sala</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body text-center p-4">
                                <div class="mb-3">
                                    <i class="bi bi-qr-code-scan display-1 text-maternal"></i>
                                </div>
                                <p class="text-muted small" id="qr-helper-text">${isAdmin ? 'Escanea el QR que corresponda al recurso que deseas gestionar.' : 'Apunta tu cámara al código QR del cubículo o refrigerador.'}</p>
                                <div id="qr-reader" style="width: 100%;"></div>
                                <div class="input-group mt-3">
                                    <input type="text" id="lactario-qr-manual" class="form-control" placeholder="Ingresa el cÃ³digo del QR manualmente">
                                    <button type="button" class="btn btn-outline-maternal" id="lactario-qr-manual-btn" onclick="Lactario.submitManualQr()">Validar</button>
                                </div>
                                <div class="small text-muted mt-2">Si la cÃ¡mara falla, escribe el cÃ³digo impreso debajo del QR.</div>
                                <div id="qr-reader-results"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal fade" id="modalLactarioAdmin" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered modal-sm">
                        <div class="modal-content rounded-4 border-0 shadow">
                            <div class="modal-header border-0 pb-0">
                                <h6 class="fw-bold" id="lacModalTitle">Acción</h6>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body pt-3">
                                <form id="lacModalForm" onsubmit="event.preventDefault();"></form>
                            </div>
                            <div class="modal-footer border-0 pt-0">
                                <button type="button" class="btn btn-sm btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
                                <button type="button" class="btn btn-sm btn-maternal rounded-pill" id="lacModalSave">Guardar</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal fade" id="modalLactarioFridge" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content rounded-4 border-0 shadow">
                            <div class="modal-header border-0 pb-0">
                                <h5 class="fw-bold text-maternal">Uso del Refrigerador</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <ul class="text-muted small mb-4">
                                    <li class="mb-2">Etiqueta tu contenedor claramente con tu <strong>nombre</strong> y <strong>hora de extracción</strong>.</li>
                                    <li class="mb-2">El refrigerador se limpia diariamente a las 2:00 P.M. y 8:00 P.M.</li>
                                    <li class="mb-2">Usa únicamente el refrigerador asignado por QR.</li>
                                </ul>
                                <div class="alert alert-warning small border-0 d-flex align-items-center">
                                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                                    <span>La institución no se hace responsable por contenedores sin etiqueta.</span>
                                </div>
                            </div>
                            <div class="modal-footer border-0 pt-0">
                                <button type="button" class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
                                <button type="button" class="btn btn-maternal rounded-pill fw-bold" onclick="Lactario.confirmFridgeUse()">Entendido, Escanear</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        return {
            safeText,
            safeAttr,
            safeJsString,
            show,
            hide,
            getEl,
            setText,
            setHtml,
            showToast: showToastCompat,
            pad,
            toDate,
            toISO,
            toLocalISO,
            formatDate,
            formatDateTime,
            formatTime,
            formatDurationHours,
            getDateBounds,
            getFirstName,
            getEligibilitySummary,
            getStatusMeta,
            renderStatusBadge,
            getSupportMeta,
            renderSupportBadge,
            createState,
            clearTimer,
            stopScanner,
            renderAccessDenied,
            renderLayout
        };
    })();
}
