// public/modules/lactario/lactario.student.js
// Student controller for Lactario

if (!window.LactarioModule) window.LactarioModule = {};

if (!window.LactarioModule.Student) {
    window.LactarioModule.Student = (function () {
        function create(shared, state) {
            const service = window.LactarioService;
            if (!shared || !service) throw new Error('[Lactario] Dependencias de estudiante no disponibles.');

            return {
                render,
                init,
                cleanup,
                selectDateTab,
                setStudentDate,
                selectTime,
                loadSlotsForDate,
                openScanner,
                submitManualQr,
                openFridgeModal,
                confirmFridgeUse,
                cancelBooking,
                startReschedule,
                cancelReschedule,
                refreshStatus
            };

            function render() {
                const bounds = shared.getDateBounds();
                const eligibility = shared.getEligibilitySummary(state.profile);
                const firstName = shared.getFirstName(state.profile, state.ctx?.user);

                return `
                    <section class="card lactario-hero border-0 shadow-sm mb-4">
                        <div class="card-body p-4 p-lg-5">
                            <div class="d-flex flex-column flex-xl-row gap-4 justify-content-between">
                                <div class="me-xl-4">
                                    <span class="badge rounded-pill bg-white text-maternal fw-semibold border border-maternal-soft mb-3">
                                        <i class="bi bi-heart-pulse-fill me-2"></i>Sala de Lactancia
                                    </span>
                                    <h2 class="fw-bold lactario-hero-title mb-3">Lactario para ${firstName}</h2>
                                    <p class="text-muted mb-3" id="student-hero-copy">
                                        Reserva, valida tu ingreso por QR y sigue el estado de tu sesión desde un solo panel.
                                    </p>
                                    <div class="lactario-soft-note small">
                                        <div class="fw-semibold text-dark mb-1">Ventana de servicio</div>
                                        <div class="text-muted">Tu elegibilidad actual indica ${shared.safeText(eligibility.windowText.toLowerCase())}. Puedes reservar entre ${shared.safeText(bounds.minDate)} y ${shared.safeText(bounds.maxDate)}.</div>
                                    </div>
                                </div>
                                <div class="lactario-quick-grid flex-grow-1">
                                    <div class="lactario-kpi">
                                        <strong id="student-hero-next-time">Sin reserva</strong>
                                        <span>Próxima visita</span>
                                    </div>
                                    <div class="lactario-kpi">
                                        <strong id="student-hero-space">Disponible</strong>
                                        <span>Cubículo asignado</span>
                                    </div>
                                    <div class="lactario-kpi">
                                        <strong id="student-hero-status">Lista</strong>
                                        <span>Estado actual</span>
                                    </div>
                                    <div class="lactario-kpi">
                                        <strong id="student-hero-support">${eligibility.monthsRemaining}</strong>
                                        <span>Meses restantes</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div class="row g-4">
                        <div class="col-xl-8">
                            <section class="card border-0 shadow-sm mb-4">
                                <div class="card-body p-4">
                                    <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3">
                                        <div>
                                            <h5 class="fw-bold text-maternal mb-1">Tu estado operativo</h5>
                                            <p class="text-muted small mb-0">Aquí se concentra tu próxima visita, la sesión en curso y los accesos rápidos.</p>
                                        </div>
                                        <button type="button" class="btn btn-outline-maternal rounded-pill" onclick="Lactario.refreshStatus()">
                                            <i class="bi bi-arrow-clockwise me-2"></i>Actualizar
                                        </button>
                                    </div>
                                    <div id="student-active-booking"></div>
                                </div>
                            </section>

                            <section class="card border-0 shadow-sm mb-4">
                                <div class="card-body p-4">
                                    <div class="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-4">
                                        <div>
                                            <h5 class="fw-bold text-maternal mb-1">Planificar visita</h5>
                                            <p class="text-muted small mb-0">Elige fecha, horario, tipo de uso y si necesitas apoyo médico vinculado.</p>
                                        </div>
                                        <div class="text-muted small" id="student-form-lock-note">Selecciona un horario disponible.</div>
                                    </div>

                                    <div id="student-reschedule-note" class="alert alert-info border-0 d-none"></div>

                                    <form id="form-lactario-book">
                                        <input type="hidden" id="lac-date" value="${shared.safeAttr(bounds.today)}">
                                        <input type="hidden" id="lac-selected-time">

                                        <div class="mb-4">
                                            <label class="form-label small fw-semibold text-muted">Fecha</label>
                                            <div class="d-flex flex-wrap gap-2 align-items-center">
                                                <div class="lactario-pill-toggle">
                                                    <button type="button" class="btn btn-sm btn-outline-maternal rounded-pill active" id="btn-date-today" onclick="Lactario.selectDateTab('today')">Hoy</button>
                                                    <button type="button" class="btn btn-sm btn-outline-maternal rounded-pill" id="btn-date-tomorrow" onclick="Lactario.selectDateTab('tomorrow')">Mañana</button>
                                                </div>
                                                <div class="ms-0 ms-md-2">
                                                    <input type="date" class="form-control rounded-pill" id="lac-custom-date" min="${shared.safeAttr(bounds.minDate)}" max="${shared.safeAttr(bounds.maxDate)}" value="${shared.safeAttr(bounds.today)}">
                                                </div>
                                            </div>
                                        </div>

                                        <div class="row g-3">
                                            <div class="col-md-7">
                                                <label class="form-label small fw-semibold text-muted" for="lac-type">Tipo de visita</label>
                                                <select id="lac-type" class="form-select rounded-4">
                                                    <option value="Lactancia">Lactancia</option>
                                                    <option value="Extracción">Extracción manual</option>
                                                </select>
                                            </div>
                                            <div class="col-md-5">
                                                <label class="form-label small fw-semibold text-muted">Horario elegido</label>
                                                <div class="form-control rounded-4 d-flex align-items-center" id="lac-selected-label">Aún sin selección</div>
                                            </div>
                                        </div>

                                        <div class="form-check mt-4 p-3 rounded-4 border">
                                            <input class="form-check-input" type="checkbox" id="lac-medical-support">
                                            <label class="form-check-label ms-2" for="lac-medical-support">
                                                <span class="fw-semibold d-block">Solicitar apoyo médico vinculado</span>
                                                <span class="text-muted small">La reserva intentará crear una cita médica relacionada con tu sesión. Si no hay cupo inmediato, quedará en estado de espera dentro del flujo médico.</span>
                                            </label>
                                        </div>

                                        <div class="mt-4">
                                            <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
                                                <label class="form-label small fw-semibold text-muted mb-0">Disponibilidad por horario</label>
                                                <button type="button" class="btn btn-sm btn-outline-maternal rounded-pill" onclick="Lactario.loadSlotsForDate(document.getElementById('lac-date').value)">
                                                    <i class="bi bi-arrow-repeat me-2"></i>Recargar
                                                </button>
                                            </div>
                                            <div id="lac-slots-container" class="lactario-slot-grid">
                                                <div class="lactario-empty">Cargando horarios...</div>
                                            </div>
                                        </div>

                                        <div class="d-flex flex-column flex-sm-row gap-2 justify-content-end mt-4">
                                            <button type="button" class="btn btn-light rounded-pill d-none" id="btn-cancel-reschedule" onclick="Lactario.cancelReschedule()">Cancelar reagenda</button>
                                            <button type="submit" class="btn btn-maternal rounded-pill px-4" id="btn-submit-booking">
                                                <span id="student-booking-submit-label">Confirmar reserva</span>
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </section>

                            <section class="card border-0 shadow-sm">
                                <div class="card-body p-4">
                                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                                        <div>
                                            <h5 class="fw-bold text-maternal mb-1">Guía rápida</h5>
                                            <p class="text-muted small mb-0" id="student-context-note">Consejos operativos para que tu sesión sea cómoda y segura.</p>
                                        </div>
                                    </div>
                                    <div class="row g-3">
                                        <div class="col-md-4">
                                            <div class="lactario-booking-card h-100">
                                                <div class="text-maternal fs-3 mb-2"><i class="bi bi-droplet-half"></i></div>
                                                <div class="fw-semibold mb-1">Antes de iniciar</div>
                                                <div class="small text-muted">Hidrátate, lava tus manos y prepara tu extractor o artículos de apoyo antes de entrar.</div>
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <div class="lactario-booking-card h-100">
                                                <div class="text-maternal fs-3 mb-2"><i class="bi bi-clock-history"></i></div>
                                                <div class="fw-semibold mb-1">Durante la sesión</div>
                                                <div class="small text-muted">Tienes una ventana operativa aproximada de ${shared.safeText(String(state.config?.usageTime || 30))} minutos. El check-in abre 15 minutos antes.</div>
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <div class="lactario-booking-card h-100">
                                                <div class="text-maternal fs-3 mb-2"><i class="bi bi-snow2"></i></div>
                                                <div class="fw-semibold mb-1">Si usas frigobar</div>
                                                <div class="small text-muted">Etiqueta nombre y hora de extracción. El retiro se valida escaneando el QR del refrigerador.</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div class="col-xl-4">
                            <section class="card border-0 shadow-sm mb-4">
                                <div class="card-body p-4">
                                    <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                                        <div>
                                            <h6 class="fw-bold text-maternal mb-1">Elegibilidad</h6>
                                            <p class="text-muted small mb-0">Basada en tu fecha de inicio de lactancia.</p>
                                        </div>
                                        <span class="badge rounded-pill bg-white text-dark border">${shared.safeText(eligibility.source === 'date' ? 'Perfil validado' : 'Dato legado')}</span>
                                    </div>
                                    <div class="mb-2">
                                        <div class="d-flex justify-content-between small text-muted mb-2">
                                            <span>Avance estimado</span>
                                            <span>${shared.safeText(`${eligibility.monthsElapsed}/7 meses`)}</span>
                                        </div>
                                        <div class="lactario-progress">
                                            <span style="width:${Math.max(6, eligibility.progressPercent)}%"></span>
                                        </div>
                                        <div class="lactario-progress-labels">
                                            <span>Inicio: ${shared.safeText(eligibility.startLabel)}</span>
                                            <span>${shared.safeText(eligibility.windowText)}</span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section class="card border-0 shadow-sm mb-4">
                                <div class="card-body p-4">
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <div>
                                            <h6 class="fw-bold text-maternal mb-1">Historial</h6>
                                            <p class="text-muted small mb-0">Uso reciente y métricas personales.</p>
                                        </div>
                                        <button type="button" class="btn btn-sm btn-outline-maternal rounded-pill" onclick="Lactario.refreshStatus()">Recargar</button>
                                    </div>
                                    <div id="student-history-summary" class="lactario-quick-grid mb-3">
                                        <div class="lactario-kpi"><strong>0</strong><span>Visitas</span></div>
                                        <div class="lactario-kpi"><strong>0</strong><span>Horas</span></div>
                                    </div>
                                    <div id="student-history-list" class="lactario-timeline-list">
                                        <div class="lactario-empty">Cargando historial...</div>
                                    </div>
                                </div>
                            </section>

                            <section class="card border-0 shadow-sm">
                                <div class="card-body p-4">
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <div>
                                            <h6 class="fw-bold text-maternal mb-1">Frigobar</h6>
                                            <p class="text-muted small mb-0">Contenedores en resguardo y retiro.</p>
                                        </div>
                                    </div>
                                    <div id="student-fridge-panel">
                                        <div class="lactario-empty">Cargando estado del frigobar...</div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                `;
            }

            async function init(ctx) {
                state.ctx = ctx;
                state.profile = ctx?.profile || null;
                state.config = await service.loadConfig(ctx);
                state.student.formMode = 'create';
                state.student.rescheduleBookingId = null;
                bindUi();
                updateContextCopy();
                await service.checkExpiredBookings(ctx, ctx.user?.uid).catch(() => { });
                await Promise.all([
                    loadSlotsForDate(state.student.selectedDate || shared.getDateBounds().today),
                    refreshStatus()
                ]);
            }

            function cleanup() {
                shared.clearTimer(state);
                shared.stopScanner(state).catch(() => { });
                state.activeBooking = null;
                state.scanMode = 'access';
                state.student.formMode = 'create';
                state.student.rescheduleBookingId = null;
                state.student.selectedTime = '';
                state.student.availableSlots = [];
            }

            function bindUi() {
                const form = shared.getEl('form-lactario-book');
                if (form) {
                    form.addEventListener('submit', submitBooking);
                }

                const customDate = shared.getEl('lac-custom-date');
                if (customDate) {
                    customDate.addEventListener('change', (event) => {
                        setStudentDate(event.target.value);
                    });
                }

                const typeInput = shared.getEl('lac-type');
                if (typeInput) {
                    typeInput.addEventListener('change', updateContextCopy);
                }
            }

            function updateContextCopy() {
                const type = shared.getEl('lac-type')?.value || 'Lactancia';
                const note = shared.getEl('student-context-note');
                if (!note) return;

                if (type === 'Extracción') {
                    note.textContent = 'Prepara tu contenedor, verifica el extractor y etiqueta cualquier resguardo antes de salir del cubículo.';
                    return;
                }

                note.textContent = 'Mantén un espacio cómodo, relájate y verifica que todo quede limpio antes de registrar tu salida.';
            }
            function selectDateTab(day) {
                const bounds = shared.getDateBounds();
                if (day === 'tomorrow') {
                    state.student.dateTab = 'tomorrow';
                    return setStudentDate(bounds.tomorrow, 'tomorrow');
                }

                state.student.dateTab = 'today';
                return setStudentDate(bounds.today, 'today');
            }

            async function setStudentDate(dateStr, mode = 'custom') {
                if (!dateStr) return;
                state.student.selectedDate = dateStr;
                state.student.dateTab = mode;

                const dateInput = shared.getEl('lac-date');
                const customDate = shared.getEl('lac-custom-date');
                if (dateInput) dateInput.value = dateStr;
                if (customDate && customDate.value !== dateStr) customDate.value = dateStr;

                updateDateButtons(mode);
                await loadSlotsForDate(dateStr);
            }

            function selectTime(timeStr) {
                state.student.selectedTime = timeStr;
                const input = shared.getEl('lac-selected-time');
                if (input) input.value = timeStr;

                Array.from(document.querySelectorAll('#lac-slots-container button[data-slot-time]')).forEach((button) => {
                    button.classList.toggle('is-active', button.dataset.slotTime === timeStr);
                });

                syncFormState();
            }

            async function loadSlotsForDate(dateStr) {
                if (!dateStr) return;

                const host = shared.getEl('lac-slots-container');
                if (host) host.innerHTML = '<div class="lactario-empty">Cargando horarios disponibles...</div>';

                try {
                    const slots = await service.getAvailability(state.ctx, dateStr);
                    state.student.availableSlots = slots;

                    if (!slots.length) {
                        if (host) host.innerHTML = '<div class="lactario-empty">No quedan horarios disponibles para esa fecha.</div>';
                        return;
                    }

                    if (state.student.selectedTime && !slots.some((slot) => slot.time === state.student.selectedTime)) {
                        state.student.selectedTime = '';
                    }

                    if (host) {
                        host.innerHTML = slots.map((slot) => renderSlot(slot)).join('');
                    }
                    syncFormState();
                } catch (error) {
                    if (host) {
                        host.innerHTML = `<div class="lactario-empty text-danger">No fue posible cargar los horarios. ${shared.safeText(error?.message || '')}</div>`;
                    }
                }
            }

            function openScanner(mode = 'access') {
                state.scanMode = mode;
                const modalEl = shared.getEl('modalLactarioQR');
                if (!modalEl || typeof bootstrap === 'undefined') return;

                const title = modalEl.querySelector('.modal-title');
                const helper = shared.getEl('qr-helper-text');
                const manualInput = shared.getEl('lactario-qr-manual');
                const results = shared.getEl('qr-reader-results');

                if (title) {
                    title.textContent = mode === 'fridge'
                        ? 'Escanear QR del Refrigerador'
                        : mode === 'pickup'
                            ? 'Validar retiro de frigobar'
                            : 'Escanear QR del Cubículo';
                }

                if (helper) {
                    helper.textContent = mode === 'fridge'
                        ? 'Escanea el QR del refrigerador donde vas a resguardar tu contenedor.'
                        : mode === 'pickup'
                            ? 'Escanea el mismo refrigerador donde registraste tu contenedor.'
                            : 'Escanea el QR del cubículo asignado para registrar ingreso o salida.';
                }

                if (manualInput) manualInput.value = '';
                if (results) results.innerHTML = '';

                const modal = new bootstrap.Modal(modalEl);
                modal.show();
                modalEl.addEventListener('shown.bs.modal', startCamera, { once: true });
                modalEl.addEventListener('hidden.bs.modal', () => {
                    shared.stopScanner(state).catch(() => { });
                }, { once: true });
            }

            function submitManualQr() {
                const value = shared.getEl('lactario-qr-manual')?.value?.trim();
                if (!value) {
                    shared.showToast('Ingresa el código del QR para continuar.', 'warning');
                    return;
                }
                handleScanValue(value);
            }

            function openFridgeModal() {
                const modalEl = shared.getEl('modalLactarioFridge');
                if (!modalEl || typeof bootstrap === 'undefined') return;
                new bootstrap.Modal(modalEl).show();
            }

            function confirmFridgeUse() {
                const modalEl = shared.getEl('modalLactarioFridge');
                const modal = modalEl && typeof bootstrap !== 'undefined' ? bootstrap.Modal.getInstance(modalEl) : null;
                modal?.hide();
                openScanner('fridge');
            }

            async function cancelBooking() {
                if (!state.activeBooking) return;
                if (!confirm('¿Deseas cancelar tu reserva actual?')) return;

                try {
                    await service.cancelReservation(state.ctx, state.activeBooking.id, 'Cancelada desde módulo de lactario');
                    state.student.formMode = 'create';
                    state.student.rescheduleBookingId = null;
                    shared.showToast('Reserva cancelada.', 'info');
                    await refreshStatus();
                    await loadSlotsForDate(shared.getEl('lac-date')?.value || state.student.selectedDate);
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible cancelar la reserva.', 'danger');
                }
            }

            async function startReschedule(bookingId) {
                const booking = state.activeBooking;
                if (!booking || booking.id !== bookingId || booking.status !== 'confirmed') {
                    shared.showToast('Solo puedes reagendar una reserva pendiente de entrada.', 'warning');
                    return;
                }

                state.student.formMode = 'reschedule';
                state.student.rescheduleBookingId = bookingId;
                state.student.selectedDate = booking.date ? shared.toLocalISO(booking.date) : booking.date || state.student.selectedDate;
                state.student.selectedTime = booking.time || '';

                const typeInput = shared.getEl('lac-type');
                const supportInput = shared.getEl('lac-medical-support');
                const customDate = shared.getEl('lac-custom-date');

                if (typeInput) typeInput.value = booking.type || 'Lactancia';
                if (supportInput) supportInput.checked = !!booking.medicalSupportRequested;
                if (customDate) customDate.value = state.student.selectedDate;

                updateDateButtons('custom');
                await loadSlotsForDate(state.student.selectedDate);
                syncFormState();
            }

            function cancelReschedule() {
                state.student.formMode = 'create';
                state.student.rescheduleBookingId = null;
                state.student.selectedTime = '';
                const typeInput = shared.getEl('lac-type');
                const supportInput = shared.getEl('lac-medical-support');
                if (typeInput) typeInput.value = 'Lactancia';
                if (supportInput) supportInput.checked = false;
                selectDateTab('today');
                syncFormState();
            }
            async function refreshStatus() {
                await service.checkExpiredBookings(state.ctx, state.ctx.user?.uid).catch(() => { });
                state.activeBooking = await service.getUserActiveReservation(state.ctx, state.ctx.user.uid);

                if (state.student.formMode === 'reschedule' && (!state.activeBooking || state.activeBooking.id !== state.student.rescheduleBookingId || state.activeBooking.status !== 'confirmed')) {
                    state.student.formMode = 'create';
                    state.student.rescheduleBookingId = null;
                }

                renderActiveBooking();
                await Promise.all([
                    loadStudentHistory(),
                    loadFridgePanel()
                ]);
                syncFormState();
                updateHeroSummary();
            }

            function updateHeroSummary() {
                const booking = state.activeBooking;
                shared.setText('student-hero-next-time', booking ? `${shared.formatDate(booking.date, { day: 'numeric', month: 'short' })} · ${shared.formatTime(booking.time)}` : 'Sin reserva');
                shared.setText('student-hero-space', booking?.spaceName || 'Disponible');
                shared.setText('student-hero-status', booking ? shared.getStatusMeta(booking.status).label : 'Lista');

                const supportLabel = booking?.medicalSupportRequested
                    ? (shared.getSupportMeta(booking.medicalSupportStatus)?.label || 'Apoyo solicitado')
                    : `${shared.getEligibilitySummary(state.profile).monthsRemaining} meses`;
                shared.setText('student-hero-support', supportLabel);

                const heroCopy = shared.getEl('student-hero-copy');
                if (!heroCopy) return;

                if (!booking) {
                    heroCopy.textContent = 'Tienes la agenda libre. Reserva un horario disponible y usa este panel para validar acceso, apoyo médico y frigobar.';
                    return;
                }

                if (booking.status === 'checked-in') {
                    heroCopy.textContent = 'Tu sesión está en curso. Cuando termines, registra la salida desde el QR del cubículo y retira tu contenedor si aplica.';
                    return;
                }

                heroCopy.textContent = `Tu próxima visita está programada para ${shared.formatDateTime(booking.date)} en ${booking.spaceName || 'tu cubículo asignado'}.`;
            }

            function renderActiveBooking() {
                const host = shared.getEl('student-active-booking');
                if (!host) return;

                const booking = state.activeBooking;
                if (!booking) {
                    host.innerHTML = `
                        <div class="lactario-empty">
                            <div class="fs-1 mb-2 text-maternal"><i class="bi bi-calendar2-plus"></i></div>
                            <div class="fw-semibold text-dark mb-1">Sin visita activa</div>
                            <div class="small">Cuando tengas una reserva confirmada, aquí verás check-in, cubículo asignado, apoyo médico y acceso a frigobar.</div>
                        </div>
                    `;
                    shared.clearTimer(state);
                    return;
                }

                const canReschedule = booking.status === 'confirmed';
                const canCancel = booking.status === 'confirmed';
                const isCheckedIn = booking.status === 'checked-in';
                const fridgeStatus = booking.fridgeStatus || null;

                host.innerHTML = `
                    <div class="lactario-booking-card">
                        <div class="d-flex flex-column flex-lg-row justify-content-between gap-3">
                            <div>
                                <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
                                    ${shared.renderStatusBadge(booking.status)}
                                    ${shared.renderSupportBadge(booking.medicalSupportStatus)}
                                    ${booking.fridgeStatus === 'stored' ? '<span class="badge rounded-pill bg-info-subtle text-info border border-info-subtle">Frigobar en uso</span>' : ''}
                                </div>
                                <h5 class="fw-bold mb-2">${shared.safeText(booking.type || 'Lactancia')} · ${shared.safeText(shared.formatDate(booking.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</h5>
                                <div class="small text-muted mb-1"><i class="bi bi-clock me-2"></i>${shared.safeText(shared.formatTime(booking.time))}</div>
                                <div class="small text-muted mb-1"><i class="bi bi-door-closed me-2"></i>${shared.safeText(booking.spaceName || booking.spaceId || 'Cubículo asignado')}</div>
                                <div class="small text-muted"><i class="bi bi-envelope-heart me-2"></i>${booking.medicalSupportRequested ? shared.safeText(shared.getSupportMeta(booking.medicalSupportStatus)?.label || 'Apoyo médico solicitado') : 'Sin apoyo médico ligado a esta visita'}</div>
                            </div>
                            <div class="text-lg-end">
                                <div class="small text-muted mb-2">Temporizador</div>
                                <div class="fw-bold fs-4 text-dark" id="student-active-timer-value">--:--</div>
                                <div class="small text-muted" id="student-active-timer-label">Preparando información</div>
                            </div>
                        </div>

                        <div class="lactario-actions-cluster mt-4">
                            <button type="button" class="btn ${isCheckedIn ? 'btn-outline-danger' : 'btn-maternal'} rounded-pill" onclick="Lactario.openScanner('access')">
                                <i class="bi ${isCheckedIn ? 'bi-box-arrow-right' : 'bi-qr-code'} me-2"></i>${isCheckedIn ? 'Registrar salida' : 'Registrar ingreso'}
                            </button>
                            ${isCheckedIn && fridgeStatus !== 'stored' ? `
                                <button type="button" class="btn btn-outline-info rounded-pill" onclick="Lactario.openFridgeModal()">
                                    <i class="bi bi-snow2 me-2"></i>Registrar frigobar
                                </button>
                            ` : ''}
                            ${fridgeStatus === 'stored' ? `
                                <button type="button" class="btn btn-outline-info rounded-pill" onclick="Lactario.openScanner('pickup')">
                                    <i class="bi bi-box-arrow-up me-2"></i>Retirar contenedor
                                </button>
                            ` : ''}
                            ${canReschedule ? `
                                <button type="button" class="btn btn-outline-maternal rounded-pill" onclick="Lactario.startReschedule('${shared.safeJsString(booking.id)}')">
                                    <i class="bi bi-calendar2-week me-2"></i>Reagendar
                                </button>
                            ` : ''}
                            ${canCancel ? `
                                <button type="button" class="btn btn-light rounded-pill" onclick="Lactario.cancelBooking()">
                                    <i class="bi bi-x-circle me-2"></i>Cancelar
                                </button>
                            ` : ''}
                        </div>

                        <div class="lactario-soft-note mt-3 small">
                            ${isCheckedIn
                        ? 'Tu visita está abierta. Cierra la sesión escaneando el QR de salida del cubículo asignado.'
                        : 'La entrada se habilita 15 minutos antes de tu horario y se marca no-show al exceder la tolerancia configurada.'}
                        </div>
                    </div>
                `;

                startActiveTimer();
            }

            function startActiveTimer() {
                shared.clearTimer(state);

                const booking = state.activeBooking;
                const timerValue = shared.getEl('student-active-timer-value');
                const timerLabel = shared.getEl('student-active-timer-label');
                if (!booking || !timerValue || !timerLabel) return;

                const usageTime = Number(state.config?.usageTime || 30);
                const now = new Date();

                const updateTimer = () => {
                    const current = new Date();
                    if (!state.activeBooking) return;

                    if (state.activeBooking.status === 'checked-in') {
                        const checkInDate = shared.toDate(state.activeBooking.checkInTime) || current;
                        const endAt = new Date(checkInDate.getTime() + (usageTime * 60000));
                        const diffMs = endAt.getTime() - current.getTime();
                        timerValue.textContent = formatCountdown(diffMs);
                        timerLabel.textContent = diffMs >= 0 ? 'Tiempo restante estimado' : 'Tiempo excedido';
                        return;
                    }

                    const visitDate = shared.toDate(state.activeBooking.date);
                    if (!visitDate) {
                        timerValue.textContent = '--:--';
                        timerLabel.textContent = 'Fecha no disponible';
                        return;
                    }

                    const diffMs = visitDate.getTime() - current.getTime();
                    timerValue.textContent = formatCountdown(diffMs);
                    timerLabel.textContent = diffMs >= 0 ? 'Para apertura de visita' : 'Retraso actual';
                };

                updateTimer();
                if ((booking.status === 'checked-in') || (booking.status === 'confirmed' && Math.abs((shared.toDate(booking.date)?.getTime() || now.getTime()) - now.getTime()) <= (3 * 3600000))) {
                    state.timerInterval = setInterval(updateTimer, 1000);
                }
            }

            async function loadStudentHistory() {
                const [summary, history] = await Promise.all([
                    service.getUserHistorySummary(state.ctx, state.ctx.user.uid),
                    service.getUserBookingHistory(state.ctx, state.ctx.user.uid, 12)
                ]);

                state.student.summary = summary;
                state.student.bookingHistory = history;

                const completed = history.filter((item) => ['completed', 'checked-in'].includes(item.status)).length;
                const noShow = history.filter((item) => item.status === 'no-show').length;
                const lastVisit = history.find((item) => ['completed', 'checked-in'].includes(item.status));
                const summaryHost = shared.getEl('student-history-summary');
                if (summaryHost) {
                    summaryHost.innerHTML = `
                        <div class="lactario-kpi">
                            <strong>${Number(summary?.visits || 0)}</strong>
                            <span>Visitas acumuladas</span>
                        </div>
                        <div class="lactario-kpi">
                            <strong>${shared.safeText(shared.formatDurationHours(summary?.totalMinutes || 0))}</strong>
                            <span>Horas estimadas</span>
                        </div>
                        <div class="lactario-kpi">
                            <strong>${completed}</strong>
                            <span>Sesiones cerradas</span>
                        </div>
                        <div class="lactario-kpi">
                            <strong>${noShow}</strong>
                            <span>No-show</span>
                        </div>
                    `;
                }

                const listHost = shared.getEl('student-history-list');
                if (!listHost) return;

                if (!history.length) {
                    listHost.innerHTML = `
                        <div class="lactario-empty">
                            <div class="fw-semibold text-dark mb-1">Aún no hay registros</div>
                            <div class="small">Tus visitas cerradas, cancelaciones y uso de frigobar aparecerán aquí.</div>
                        </div>
                    `;
                    return;
                }

                const header = lastVisit
                    ? `<div class="small text-muted mb-3">Última visita útil: <span class="fw-semibold text-dark">${shared.safeText(shared.formatDateTime(lastVisit.date))}</span></div>`
                    : '';

                listHost.innerHTML = `
                    ${header}
                    ${history.map(renderHistoryItem).join('')}
                `;
            }

            function renderHistoryItem(item) {
                const fridgeLabel = item.fridgeStatus === 'stored'
                    ? '<span class="badge rounded-pill bg-info-subtle text-info border border-info-subtle">Resguardo pendiente</span>'
                    : item.fridgeStatus === 'picked_up'
                        ? '<span class="badge rounded-pill bg-success-subtle text-success border border-success-subtle">Frigobar retirado</span>'
                        : '';

                return `
                    <article class="lactario-timeline-item">
                        <div class="d-flex flex-column flex-sm-row justify-content-between gap-3">
                            <div>
                                <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
                                    ${shared.renderStatusBadge(item.status)}
                                    ${shared.renderSupportBadge(item.medicalSupportStatus)}
                                    ${fridgeLabel}
                                </div>
                                <div class="fw-semibold text-dark">${shared.safeText(item.type || 'Lactancia')}</div>
                                <div class="small text-muted">${shared.safeText(shared.formatDateTime(item.date))}</div>
                                <div class="small text-muted">${shared.safeText(item.spaceName || item.spaceId || 'Cubículo')}</div>
                            </div>
                            <div class="text-sm-end small text-muted">
                                ${item.cancelReason ? `<div><i class="bi bi-info-circle me-1"></i>${shared.safeText(item.cancelReason)}</div>` : ''}
                                ${item.medicalSupportProfessionalName ? `<div><i class="bi bi-stethoscope me-1"></i>${shared.safeText(item.medicalSupportProfessionalName)}</div>` : ''}
                            </div>
                        </div>
                    </article>
                `;
            }

            async function loadFridgePanel() {
                const host = shared.getEl('student-fridge-panel');
                if (!host) return;

                const items = await service.getFridgeStatus(state.ctx, state.ctx.user.uid);
                state.student.fridgeItems = items;

                if (!items.length) {
                    host.innerHTML = `
                        <div class="lactario-empty">
                            <div class="fs-2 mb-2 text-info"><i class="bi bi-snow"></i></div>
                            <div class="fw-semibold text-dark mb-1">Sin contenedores en resguardo</div>
                            <div class="small">Cuando registres frigobar durante una visita en curso, el estado aparecerá aquí.</div>
                        </div>
                    `;
                    return;
                }

                host.innerHTML = `
                    <div class="lactario-mini-list">
                        ${items.map((item, index) => `
                            <article class="lactario-booking-card">
                                <div class="d-flex justify-content-between align-items-start gap-3">
                                    <div>
                                        <div class="fw-semibold text-dark mb-1">Contenedor ${index + 1}</div>
                                        <div class="small text-muted mb-1"><i class="bi bi-snow2 me-2"></i>${shared.safeText(item.fridgeId || 'Refrigerador')}</div>
                                        <div class="small text-muted mb-1"><i class="bi bi-clock me-2"></i>Registrado ${shared.safeText(shared.formatDateTime(item.fridgeTime || item.date))}</div>
                                        <div class="small text-muted"><i class="bi bi-door-closed me-2"></i>${shared.safeText(item.spaceName || item.spaceId || 'Cubículo')}</div>
                                    </div>
                                    ${index === 0 ? `
                                        <button type="button" class="btn btn-outline-info rounded-pill btn-sm" onclick="Lactario.openScanner('pickup')">
                                            <i class="bi bi-box-arrow-up me-2"></i>Retirar
                                        </button>
                                    ` : ''}
                                </div>
                                <div class="lactario-soft-note mt-3 small">Recuerda retirar antes de los ciclos de limpieza de las 2:00 p.m. y 8:00 p.m.</div>
                            </article>
                        `).join('')}
                    </div>
                `;
            }

            function syncFormState() {
                const booking = state.activeBooking;
                const isRescheduling = state.student.formMode === 'reschedule';
                const formLocked = !!booking && !isRescheduling;

                const selectedTime = shared.getEl('lac-selected-time');
                const selectedLabel = shared.getEl('lac-selected-label');
                const submitLabel = shared.getEl('student-booking-submit-label');
                const submitButton = shared.getEl('btn-submit-booking');
                const cancelRescheduleBtn = shared.getEl('btn-cancel-reschedule');
                const rescheduleNote = shared.getEl('student-reschedule-note');
                const helperText = shared.getEl('student-form-lock-note');
                const controls = [
                    shared.getEl('lac-type'),
                    shared.getEl('lac-medical-support'),
                    shared.getEl('lac-custom-date'),
                    shared.getEl('btn-date-today'),
                    shared.getEl('btn-date-tomorrow')
                ].filter(Boolean);

                controls.forEach((control) => {
                    control.disabled = !!booking && !isRescheduling;
                });

                if (submitButton) {
                    submitButton.disabled = !!booking && !isRescheduling;
                }

                if (selectedTime) {
                    selectedTime.value = state.student.selectedTime || '';
                }

                if (selectedLabel) {
                    selectedLabel.textContent = state.student.selectedTime
                        ? `${shared.formatTime(state.student.selectedTime)} · ${state.student.selectedDate}`
                        : 'Aún sin selección';
                }

                if (submitLabel) {
                    submitLabel.textContent = isRescheduling ? 'Guardar cambio' : 'Confirmar reserva';
                }

                if (cancelRescheduleBtn) {
                    cancelRescheduleBtn.classList.toggle('d-none', !isRescheduling);
                }

                if (rescheduleNote) {
                    if (isRescheduling && booking) {
                        rescheduleNote.classList.remove('d-none');
                        rescheduleNote.innerHTML = `<i class="bi bi-calendar2-week me-2"></i>Estás reagendando tu visita del ${shared.safeText(shared.formatDateTime(booking.date))}.`;
                    } else {
                        rescheduleNote.classList.add('d-none');
                        rescheduleNote.innerHTML = '';
                    }
                }

                if (helperText) {
                    if (booking?.status === 'checked-in') {
                        helperText.textContent = 'Tienes una sesión en curso. Cierra la visita antes de intentar una nueva reserva.';
                    } else if (formLocked) {
                        helperText.textContent = 'Ya cuentas con una reserva activa. Puedes reagendarla o cancelarla desde el panel superior.';
                    } else {
                        helperText.textContent = 'Selecciona un horario disponible.';
                    }
                }

                Array.from(document.querySelectorAll('#lac-slots-container button[data-slot-time]')).forEach((button) => {
                    if (booking && !isRescheduling) button.disabled = true;
                });
            }

            async function submitBooking(event) {
                event.preventDefault();
                updateContextCopy();

                const date = shared.getEl('lac-date')?.value;
                const timeStr = state.student.selectedTime || shared.getEl('lac-selected-time')?.value;
                const type = shared.getEl('lac-type')?.value || 'Lactancia';
                const medicalSupport = !!shared.getEl('lac-medical-support')?.checked;

                if (!date || !timeStr) {
                    shared.showToast('Selecciona fecha y horario para continuar.', 'warning');
                    return;
                }

                const submitButton = shared.getEl('btn-submit-booking');
                const submitLabel = shared.getEl('student-booking-submit-label');
                const originalLabel = submitLabel?.textContent || 'Guardar';

                if (submitButton) submitButton.disabled = true;
                if (submitLabel) submitLabel.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando';

                try {
                    const payload = {
                        user: state.ctx.user,
                        date,
                        timeStr,
                        type,
                        medicalSupport
                    };

                    let result;
                    if (state.student.formMode === 'reschedule' && state.student.rescheduleBookingId) {
                        result = await service.rescheduleReservation(state.ctx, state.student.rescheduleBookingId, payload);
                        shared.showToast('Reserva reagendada correctamente.', 'success');
                    } else {
                        result = await service.createReservation(state.ctx, payload);
                        shared.showToast('Reserva confirmada.', 'success');
                    }

                    if (result?.medicalSupportWarning) {
                        shared.showToast(result.medicalSupportWarning, 'warning');
                    }

                    state.student.formMode = 'create';
                    state.student.rescheduleBookingId = null;
                    await refreshStatus();
                    await loadSlotsForDate(date);
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible guardar la reserva.', 'danger');
                } finally {
                    if (submitButton && !state.activeBooking) submitButton.disabled = false;
                    if (submitLabel) submitLabel.textContent = originalLabel;
                    syncFormState();
                }
            }

            function updateDateButtons(mode) {
                const todayBtn = shared.getEl('btn-date-today');
                const tomorrowBtn = shared.getEl('btn-date-tomorrow');
                todayBtn?.classList.toggle('active', mode === 'today');
                tomorrowBtn?.classList.toggle('active', mode === 'tomorrow');
            }

            function renderSlot(slot) {
                const isSelected = state.student.selectedTime === slot.time;
                const isReservedBySelf = state.student.formMode === 'reschedule'
                    && state.activeBooking
                    && state.activeBooking.slotId === slot.slotId;
                const formLocked = !!state.activeBooking && state.student.formMode !== 'reschedule';
                const isDisabled = (slot.isFull && !isSelected && !isReservedBySelf) || formLocked;

                return `
                    <button
                        type="button"
                        class="lactario-slot-card ${isSelected ? 'is-active' : ''} ${slot.isFull && !isReservedBySelf ? 'is-full' : ''}"
                        data-slot-time="${shared.safeAttr(slot.time)}"
                        ${isDisabled ? 'disabled' : ''}
                        onclick="Lactario.selectTime('${shared.safeJsString(slot.time)}')">
                        <div class="fw-semibold text-dark mb-1">${shared.safeText(slot.formattedTime || shared.formatTime(slot.time))}</div>
                        <div class="small text-muted mb-1">${slot.available} de ${slot.total} disponibles</div>
                        <div class="small ${slot.isFull && !isReservedBySelf ? 'text-danger' : 'text-success'}">
                            ${slot.isFull && !isReservedBySelf ? 'Horario lleno' : 'Disponible'}
                        </div>
                    </button>
                `;
            }

            function startCamera() {
                if (state.scanner) return;

                if (typeof Html5QrcodeScanner === 'undefined' || typeof Html5QrcodeScanType === 'undefined') {
                    renderScanFeedback('danger', 'El lector QR no está disponible en este navegador. Usa el código manual.');
                    return;
                }

                try {
                    state.scanner = new Html5QrcodeScanner('qr-reader', {
                        fps: 10,
                        qrbox: 250,
                        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
                    }, false);
                    state.scanner.render(handleScanValue, () => { });
                } catch (error) {
                    state.scanner = null;
                    renderScanFeedback('danger', error?.message || 'No fue posible iniciar la cámara.');
                }
            }

            async function handleScanValue(rawValue) {
                const value = normalizeQrValue(rawValue);

                try {
                    await shared.stopScanner(state);

                    let result;
                    if (state.scanMode === 'fridge') {
                        if (!state.activeBooking || state.activeBooking.status !== 'checked-in') {
                            throw new Error('Necesitas una visita en curso para registrar frigobar.');
                        }
                        await service.useFridge(state.ctx, state.activeBooking.id, value);
                        result = { message: 'Contenedor resguardado correctamente.' };
                    } else if (state.scanMode === 'pickup') {
                        const items = state.student.fridgeItems?.length
                            ? state.student.fridgeItems
                            : await service.getFridgeStatus(state.ctx, state.ctx.user.uid);
                        const targetItem = items[0];
                        if (!targetItem) throw new Error('No hay contenedores pendientes de retiro.');
                        await service.pickupFridge(state.ctx, targetItem.id, value);
                        result = { message: 'Contenedor retirado correctamente.' };
                    } else {
                        if (!state.activeBooking) throw new Error('No tienes una reserva activa para validar.');
                        result = await service.validateVisit(state.ctx, state.activeBooking.id, value);
                    }

                    renderScanFeedback('success', result?.message || 'Operación completada.');
                    setTimeout(async () => {
                        const modal = bootstrap.Modal.getInstance(shared.getEl('modalLactarioQR'));
                        modal?.hide();
                        await refreshStatus();
                        await loadSlotsForDate(shared.getEl('lac-date')?.value || state.student.selectedDate);
                    }, 1400);
                } catch (error) {
                    renderScanFeedback('danger', error?.message || 'No fue posible procesar el QR.', true);
                }
            }

            function renderScanFeedback(type, message, canRetry = false) {
                const results = shared.getEl('qr-reader-results');
                if (!results) return;
                const retryButton = canRetry
                    ? `<button type="button" class="btn btn-sm btn-outline-dark mt-3" onclick="Lactario.openScanner('${shared.safeJsString(state.scanMode)}')">Intentar de nuevo</button>`
                    : '';

                results.innerHTML = `
                    <div class="text-center mt-4 ${type === 'success' ? 'text-success' : 'text-danger'}">
                        <i class="bi ${type === 'success' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} display-1"></i>
                        <div class="fw-semibold mt-3">${shared.safeText(message)}</div>
                        ${retryButton}
                    </div>
                `;
            }

            function normalizeQrValue(rawValue) {
                const text = String(rawValue ?? '').trim();
                if (!text) return text;
                try {
                    const parsed = JSON.parse(text);
                    return typeof parsed === 'string' ? parsed.trim() : text;
                } catch (_) {
                    return text.replace(/^"|"$/g, '');
                }
            }

            function formatCountdown(diffMs) {
                const abs = Math.abs(diffMs);
                const totalSeconds = Math.floor(abs / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                const body = hours > 0
                    ? `${shared.pad(hours)}:${shared.pad(minutes)}:${shared.pad(seconds)}`
                    : `${shared.pad(minutes)}:${shared.pad(seconds)}`;
                return diffMs < 0 ? `-${body}` : body;
            }
        }

        return { create };
    })();
}
