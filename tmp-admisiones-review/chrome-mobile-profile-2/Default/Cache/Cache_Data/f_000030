/**
 * register.js
 * Módulo para gestionar el flujo de registro y completado de perfil en SIA.
 * Maneja tanto estudiantes/general como personal administrativo/departamental.
 */

const SIA_Register = (() => {

    let _userCandidate = null; // Objeto user de Firebase/Microsoft
    let _extraData = null;     // Datos extra de Microsoft (jobTitle, mobile, etc)
    let _currentStep = 0;
    let _selectedUserType = '';
    let _draftSaveTimer = null;
    let _draftInputHandler = null;
    let _draftChangeHandler = null;
    const TOTAL_STEPS = 4;
    const STEP_META = [
        { label: 'Bienvenida', helper: '2 a 5 min', description: 'Conoce el proceso y elige el perfil que mejor te representa.' },
        { label: 'Identidad', helper: 'Paso común', description: 'Capturamos tu identidad institucional y el contexto base según tu perfil.' },
        { label: 'Salud', helper: 'Emergencia', description: 'Reunimos datos clínicos útiles para atención rápida y segura en campus.' },
        { label: 'Apoyos', helper: 'Preferencias', description: 'Registramos accesibilidad, comunicación e intereses institucionales.' },
        { label: 'Revisión', helper: 'Confirmar', description: 'Revisa todo antes de crear tu expediente digital.' }
    ];
    const USER_TYPE_META = {
        estudiante: {
            label: 'Alumno',
            badge: 'Ruta estudiantil',
            intro: 'Te pediremos contexto académico y algunas respuestas para apoyos, becas y servicios del campus.',
            benefitChips: ['Carrera y semestre', 'Turno y traslado', 'Apoyos académicos'],
            contextTitle: 'Contexto académico',
            contextCopy: 'Estas respuestas ayudan al instituto a entender tu trayectoria, movilidad y apoyos más útiles.'
        },
        docente: {
            label: 'Docente',
            badge: 'Ruta docente',
            intro: 'El registro prioriza tu adscripción académica, espacios de atención y disponibilidad para asesorías.',
            benefitChips: ['Academia y enfoque', 'Cubículo y extensión', 'Disponibilidad de asesoría'],
            contextTitle: 'Contexto docente',
            contextCopy: 'Nos permite ubicarte mejor dentro de Aula, asesorías y atención institucional.'
        },
        administrativo: {
            label: 'Administrativo',
            badge: 'Ruta administrativa',
            intro: 'Recogeremos tu puesto, área y horarios de atención para mejorar coordinación interna y servicio.',
            benefitChips: ['Área y puesto', 'Horario de atención', 'Canales internos'],
            contextTitle: 'Contexto administrativo',
            contextCopy: 'Sirve para coordinación operativa, ubicación interna y trazabilidad de servicios.'
        },
        operativo: {
            label: 'Operativo',
            badge: 'Ruta operativa',
            intro: 'El flujo prioriza zona de trabajo, turno, seguridad y cadena de contacto inmediata.',
            benefitChips: ['Zona y supervisor', 'Turno operativo', 'Riesgo laboral'],
            contextTitle: 'Contexto operativo',
            contextCopy: 'Ayuda a seguridad, atención rápida y organización de equipos en campus.'
        }
    };

    const STAFF_REGISTRATION_PRESETS = {
        biblioteca: () => ({
            role: 'department_admin',
            department: 'biblioteca',
            tipoUsuario: 'administrativo',
            allowedViews: ['view-biblio'],
            permissions: { biblio: 'biblio' }
        }),
        medico: (subRole) => {
            const specialty = (subRole || 'medico').toLowerCase() === 'psicologo' ? 'psicologo' : 'medico';
            return {
                role: 'department_admin',
                department: 'servicios_medicos',
                tipoUsuario: 'administrativo',
                specialty,
                especialidad: specialty,
                allowedViews: ['view-medi'],
                permissions: { medi: specialty }
            };
        },
        aula: () => ({
            role: 'personal',
            department: 'aula',
            tipoUsuario: 'docente',
            permissions: { aula: 'docente' }
        }),
        foro: () => ({
            role: 'department_admin',
            department: 'foro',
            tipoUsuario: 'administrativo',
            allowedViews: ['view-foro'],
            permissions: { foro: 'admin' }
        })
    };

    // Elementos DOM cacheados
    let $wizardContainer;

    const normalizeSelection = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    const isAffirmative = (value) => normalizeSelection(value) === 'si';
    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const getUserTypeMeta = (value) => USER_TYPE_META[normalizeSelection(value)] || null;

    const getDraftKey = () => (_userCandidate?.uid ? `sia_register_draft_${_userCandidate.uid}` : null);
    const getResolvedInstitutionalEmail = () => String(_extraData?.emailInstitucional || _userCandidate?.email || '').trim().toLowerCase();

    const setFieldRequired = (groupEl, required) => {
        if (!groupEl) return;
        groupEl.querySelectorAll('[data-required-if-visible="true"]').forEach((field) => {
            field.required = required;
        });
    };

    const clearGroupFields = (groupEl) => {
        if (!groupEl) return;
        groupEl.querySelectorAll('input, select, textarea').forEach((field) => {
            if (field.type === 'checkbox' || field.type === 'radio') {
                field.checked = false;
            } else if (field.tagName === 'SELECT') {
                field.selectedIndex = 0;
            } else {
                field.value = '';
            }
            field.classList.remove('is-invalid');
        });
    };

    const renderChipList = (containerId, items = []) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = (items || [])
            .filter(Boolean)
            .map((item) => `<span class="badge rounded-pill text-bg-light border">${escapeHtml(item)}</span>`)
            .join('');
    };

    const updateDraftStatus = (message = 'Guardado automático activo', tone = 'success') => {
        const status = document.getElementById('reg-draft-status');
        if (!status) return;
        status.className = `small text-${tone}`;
        status.textContent = message;
    };

    const updateStepChrome = (step) => {
        const stepIndex = Math.max(0, Math.min(step, STEP_META.length - 1));
        const meta = STEP_META[stepIndex];
        const caption = document.getElementById('reg-step-caption');
        const description = document.getElementById('reg-step-copy');
        const eta = document.getElementById('reg-estimated-time');

        if (caption) caption.textContent = `Paso ${stepIndex + 1} de ${STEP_META.length} · ${meta.label}`;
        if (description) description.textContent = meta.description;
        if (eta) eta.textContent = meta.helper;

        document.querySelectorAll('[data-reg-step-pill]').forEach((pill) => {
            const pillStep = Number(pill.dataset.regStepPill || 0);
            pill.classList.remove('text-bg-primary', 'text-bg-success', 'text-bg-light', 'border', 'text-dark');

            if (pillStep < stepIndex) {
                pill.classList.add('text-bg-success');
            } else if (pillStep === stepIndex) {
                pill.classList.add('text-bg-primary');
            } else {
                pill.classList.add('text-bg-light', 'border', 'text-dark');
            }
        });
    };

    const updateWelcomePreview = (value = '') => {
        const normalized = normalizeSelection(value);
        const meta = getUserTypeMeta(normalized);
        const label = document.getElementById('reg-selected-role-label');
        const copy = document.getElementById('reg-selected-role-copy');

        document.querySelectorAll('[data-reg-role-card]').forEach((button) => {
            const isActive = normalizeSelection(button.dataset.regRoleCard) === normalized;
            button.classList.toggle('btn-primary', isActive);
            button.classList.toggle('text-white', isActive);
            button.classList.toggle('btn-outline-secondary', !isActive);
        });

        if (!label || !copy) return;

        if (!meta) {
            label.textContent = 'Recorrido adaptable';
            copy.textContent = 'Selecciona un perfil y te mostraremos preguntas relevantes para tu tipo de usuario.';
            renderChipList('reg-welcome-benefits', ['Proceso guiado', 'Guardado automático', 'Revisión final']);
            return;
        }

        label.textContent = meta.badge;
        copy.textContent = meta.intro;
        renderChipList('reg-welcome-benefits', meta.benefitChips);
    };

    const updateRoleGuidance = (value = '') => {
        const normalized = normalizeSelection(value);
        const meta = getUserTypeMeta(normalized);
        const guidance = document.getElementById('reg-role-guidance');
        const title = document.getElementById('reg-role-guidance-title');
        const copy = document.getElementById('reg-role-guidance-copy');
        const contextBadge = document.getElementById('reg-context-badge');
        const emptyState = document.getElementById('reg-role-context-empty');

        if (!meta) {
            guidance?.classList.add('d-none');
            if (title) title.textContent = '';
            if (copy) copy.textContent = '';
            if (contextBadge) contextBadge.textContent = 'Sin perfil';
            if (emptyState) emptyState.classList.remove('d-none');
            renderChipList('reg-role-guidance-tags', []);
            return;
        }

        guidance?.classList.remove('d-none');
        if (title) title.textContent = meta.contextTitle;
        if (copy) copy.textContent = meta.contextCopy;
        if (contextBadge) contextBadge.textContent = meta.label;
        if (emptyState) emptyState.classList.add('d-none');
        renderChipList('reg-role-guidance-tags', meta.benefitChips);
    };

    const syncRoleSpecificContext = (value = '') => {
        const normalized = normalizeSelection(value);
        const groups = {
            estudiante: document.getElementById('group-role-student'),
            docente: document.getElementById('group-role-docente'),
            administrativo: document.getElementById('group-role-admin'),
            operativo: document.getElementById('group-role-operativo')
        };

        Object.entries(groups).forEach(([key, groupEl]) => {
            if (!groupEl) return;
            const shouldShow = key === normalized;
            groupEl.classList.toggle('d-none', !shouldShow);
            setFieldRequired(groupEl, shouldShow);
            if (!shouldShow) clearGroupFields(groupEl);
        });
    };

    const getSelectedUserType = () => normalizeSelection(getValue('reg-tipo-usuario') || _selectedUserType);

    const scheduleDraftSave = () => {
        if (_draftSaveTimer) window.clearTimeout(_draftSaveTimer);
        _draftSaveTimer = window.setTimeout(() => {
            const key = getDraftKey();
            if (!key) return;

            const fields = {};
            document.querySelectorAll('#view-register-wizard input[id], #view-register-wizard select[id], #view-register-wizard textarea[id]').forEach((field) => {
                if (field.type === 'checkbox') {
                    fields[field.id] = { checked: field.checked };
                } else {
                    fields[field.id] = { value: field.value };
                }
            });

            const payload = {
                version: 2,
                currentStep: _currentStep,
                selectedUserType: getSelectedUserType(),
                savedAt: new Date().toISOString(),
                fields
            };

            try {
                localStorage.setItem(key, JSON.stringify(payload));
                updateDraftStatus('Borrador guardado automáticamente', 'success');
            } catch (error) {
                console.warn('[Register] No se pudo guardar borrador:', error);
                updateDraftStatus('No se pudo guardar el borrador', 'warning');
            }
        }, 250);
    };

    const clearDraft = () => {
        const key = getDraftKey();
        if (!key) return;
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn('[Register] No se pudo limpiar borrador:', error);
        }
    };

    const bindDraftPersistence = () => {
        if (!$wizardContainer) return;

        if (_draftInputHandler) {
            $wizardContainer.removeEventListener('input', _draftInputHandler, true);
        }
        if (_draftChangeHandler) {
            $wizardContainer.removeEventListener('change', _draftChangeHandler, true);
        }

        _draftInputHandler = (event) => {
            if (event.target?.id) scheduleDraftSave();
        };
        _draftChangeHandler = (event) => {
            if (event.target?.id) scheduleDraftSave();
        };

        $wizardContainer.addEventListener('input', _draftInputHandler, true);
        $wizardContainer.addEventListener('change', _draftChangeHandler, true);
    };

    const restoreDraft = () => {
        const key = getDraftKey();
        if (!key) return;

        try {
            const raw = localStorage.getItem(key);
            if (!raw) {
                updateDraftStatus('Guardado automático activo', 'success');
                return;
            }

            const draft = JSON.parse(raw);
            if (!draft || typeof draft !== 'object') return;

            Object.entries(draft.fields || {}).forEach(([id, state]) => {
                const field = document.getElementById(id);
                if (!field) return;
                if (field.type === 'checkbox') {
                    field.checked = Boolean(state?.checked);
                } else if (state && Object.prototype.hasOwnProperty.call(state, 'value')) {
                    field.value = state.value;
                }
            });

            _selectedUserType = normalizeSelection(draft.selectedUserType || getValue('reg-tipo-usuario'));
            if (_selectedUserType) {
                setValue('reg-tipo-usuario', _selectedUserType);
            }

            updateWelcomePreview(_selectedUserType);
            handleUserTypeChange(_selectedUserType);
            checkGender(getValue('reg-genero'));
            checkLactancy(getValue('reg-lactancia'));

            document.querySelectorAll('#view-register-wizard select[id], #view-register-wizard input[id]').forEach((field) => {
                if (field.tagName === 'SELECT' && field.value) {
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });

            const draftStep = Number(draft.currentStep || 0);
            if (draftStep > 0) {
                showStep(Math.min(draftStep, TOTAL_STEPS));
            }

            updateDraftStatus('Borrador restaurado', 'success');
        } catch (error) {
            console.warn('[Register] No se pudo restaurar borrador:', error);
            updateDraftStatus('Guardado automático activo', 'success');
        }
    };

    const previewRole = (value, persist = true) => {
        _selectedUserType = normalizeSelection(value);
        if (_selectedUserType) {
            setValue('reg-tipo-usuario', _selectedUserType);
        }
        updateWelcomePreview(_selectedUserType);
        handleUserTypeChange(_selectedUserType);
        if (persist) scheduleDraftSave();
    };

    const handleUserTypeChange = (value) => {
        const normalizedType = normalizeSelection(value);
        const isStudent = normalizedType === 'estudiante';
        const hasSelection = Boolean(normalizedType);
        _selectedUserType = normalizedType;

        const groupCarrera = document.getElementById('group-reg-carrera');
        const groupArea = document.getElementById('group-reg-area');
        const inputCarrera = document.getElementById('reg-carrera');
        const inputArea = document.getElementById('reg-area-adscripcion');
        const groupTurno = document.getElementById('group-reg-turno');
        const inputTurno = document.getElementById('reg-turno');

        // Sections to toggle based on user role
        const groupTrabaja = document.getElementById('group-reg-trabaja');
        const groupBeca = document.getElementById('group-reg-beca');
        const inputBecaDesc = document.getElementById('reg-beca-desc');

        if (isStudent) {
            groupCarrera.classList.remove('d-none');
            groupCarrera.classList.add('animate-slide-down');
            groupArea.classList.add('d-none');
            if (inputCarrera) inputCarrera.required = true;
            if (inputArea) {
                inputArea.required = false;
                inputArea.value = '';
            }

            if (groupTurno) {
                groupTurno.classList.remove('d-none');
                groupTurno.classList.add('animate-slide-down');
            }
            if (inputTurno) inputTurno.required = true;

            if (groupTrabaja) groupTrabaja.classList.remove('d-none');
            if (groupBeca) groupBeca.classList.remove('d-none');
        } else if (hasSelection) {
            groupCarrera.classList.add('d-none');
            groupArea.classList.remove('d-none');
            groupArea.classList.add('animate-slide-down');
            if (inputCarrera) {
                inputCarrera.required = false;
                inputCarrera.value = '';
            }
            if (inputArea) inputArea.required = true;

            if (groupTurno) groupTurno.classList.add('d-none');
            if (inputTurno) {
                inputTurno.required = false;
                inputTurno.value = '';
            }

            if (groupTrabaja) groupTrabaja.classList.add('d-none');
            if (groupBeca) groupBeca.classList.add('d-none');
            if (document.getElementById('reg-trabaja')) document.getElementById('reg-trabaja').value = 'No';
            if (document.getElementById('reg-beca-bool')) document.getElementById('reg-beca-bool').value = 'No';
            if (inputBecaDesc) {
                inputBecaDesc.disabled = true;
                inputBecaDesc.value = '';
            }
        } else {
            groupCarrera.classList.add('d-none');
            groupArea.classList.add('d-none');
            if (inputCarrera) {
                inputCarrera.required = false;
                inputCarrera.value = '';
            }
            if (inputArea) {
                inputArea.required = false;
                inputArea.value = '';
            }
            if (groupTurno) groupTurno.classList.add('d-none');
            if (inputTurno) {
                inputTurno.required = false;
                inputTurno.value = '';
            }
            if (groupTrabaja) groupTrabaja.classList.add('d-none');
            if (groupBeca) groupBeca.classList.add('d-none');
            if (document.getElementById('reg-trabaja')) document.getElementById('reg-trabaja').value = 'No';
            if (document.getElementById('reg-beca-bool')) document.getElementById('reg-beca-bool').value = 'No';
            if (inputBecaDesc) {
                inputBecaDesc.disabled = true;
                inputBecaDesc.value = '';
            }
        }

        syncRoleSpecificContext(normalizedType);
        updateRoleGuidance(normalizedType);
        updateWelcomePreview(normalizedType);
    };

    const buildStaffRegistrationProfile = (deptKey, subRole = null) => {
        const presetFactory = STAFF_REGISTRATION_PRESETS[deptKey];
        const preset = typeof presetFactory === 'function'
            ? presetFactory(subRole)
            : {
                role: 'department_admin',
                department: deptKey,
                tipoUsuario: 'administrativo',
                allowedViews: ['view-dashboard']
            };

        return {
            role: preset.role || 'department_admin',
            department: preset.department || deptKey,
            tipoUsuario: preset.tipoUsuario || 'administrativo',
            specialty: preset.specialty || '',
            especialidad: preset.especialidad || preset.specialty || '',
            allowedViews: Array.isArray(preset.allowedViews) ? preset.allowedViews : [],
            permissions: preset.permissions || {}
        };
    };

    const init = (user, extraData) => {
        console.log("[Register] Iniciando flujo de registro para:", user ? user.email : 'null');
        console.log("[Register] extraData recibido:", JSON.stringify(extraData));
        _userCandidate = user;
        _extraData = extraData || {};

        // Cachear elementos
        $wizardContainer = document.getElementById('view-register-wizard');
        // Asegurar visibilidad
        const landing = document.getElementById('landing-view');
        const shell = document.getElementById('app-shell');
        const deptView = document.getElementById('reg-view-dept-selector');

        if (landing) landing.classList.add('d-none');
        if (shell) shell.classList.add('d-none');
        if ($wizardContainer) $wizardContainer.classList.remove('d-none');
        if (deptView) deptView.classList.add('d-none');
        document.getElementById('dept-options-medico')?.classList.add('d-none');
        document.getElementById('dept-options-main')?.classList.remove('d-none');
        bindDraftPersistence();

        // Resetear estado
        _currentStep = 1;
        _selectedUserType = '';
        resetForms();

        // 1. Detección Inteligente de Rol
        detectRoleAndRoute();
    };

    const detectRoleAndRoute = () => {
        const email = getResolvedInstitutionalEmail();

        // 1. Check Source of Truth (DEPARTMENT_DIRECTORY)
        let isPotentialStaff = false;

        if (email && window.DEPARTMENT_DIRECTORY && window.DEPARTMENT_DIRECTORY[email]) {
            isPotentialStaff = true;
        }

        // 2. Legacy / Fallback List (just in case)
        if (!isPotentialStaff) {
            const deptEmails = [
                'biblioteca', 'medico', 'atencionmedica', 'atencionpsicopedagogica',
                'direccion', 'subdireccion', 'division', 'desarrolloacademico',
                'escolares', 'residencias', 'extraescolares', 'financieros',
                'calidad', 'difusion', 'cafeteria'
            ];
            isPotentialStaff = deptEmails.some(prefix => email.startsWith(prefix + '@'));
        }

        if (isPotentialStaff) {
            // Mostrar Modal de "Eres staff?"
            showStaffConfirmationModal();
        } else {
            // Flujo Estudiante/General Directo
            startStudentWizard();
        }
    };



    const showStaffConfirmationModal = () => {
        const modalEl = document.getElementById('modal-register-staff-check');
        const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });

        // Configurar botones del modal
        const btnYes = document.getElementById('btn-staff-yes');
        const btnNo = document.getElementById('btn-staff-no');

        if (btnYes) btnYes.onclick = () => {
            modal.hide();
            showDeptSelectionView(); // Ir a selección de departamento
        };

        if (btnNo) btnNo.onclick = () => {
            modal.hide();
            startStudentWizard(); // Ir a formulario general
        };

        modal.show();
    };

    // --- FLUJO ESTUDIANTE / GENERAL (WIZARD) ---

    const startStudentWizard = () => {
        console.log("[Register] Iniciando Wizard Estudiante");
        showStep(0);

        // Pre-llenar datos conocidos
        const email = getResolvedInstitutionalEmail();
        setValue('reg-nombre-completo', _userCandidate.displayName || (_extraData && _extraData.nombre) || '');
        setValue('reg-email-readonly', email);
        setValue('reg-matricula-readonly', _extraData.matricula || extractMatricula(email));

        const birthDateInput = document.getElementById('reg-fecha-nacimiento');
        if (birthDateInput) birthDateInput.max = new Date().toISOString().slice(0, 10);

        const preferredType = normalizeSelection(_extraData.forcedRole || _extraData.role) === 'student'
            ? 'estudiante'
            : '';
        if (preferredType) {
            setValue('reg-tipo-usuario', preferredType);
        }
        previewRole(preferredType, false);
        restoreDraft();
    };

    const extractMatricula = (email) => {
        if (!email) return '';
        const parts = email.split('@');
        // Si es numérico asumimos matrícula, si no, dejamos vacío o user
        return parts[0]; // Simple heuristic
    };

    const formatReviewValue = (value, empty = 'No capturado') => {
        if (Array.isArray(value)) {
            const clean = value.map((item) => String(item || '').trim()).filter(Boolean);
            return clean.length ? clean.join(', ') : empty;
        }
        const text = String(value ?? '').trim();
        return text || empty;
    };

    const reviewSection = (title, rows = []) => {
        const printableRows = rows.filter((row) => row && row.label);
        if (!printableRows.length) return '';
        return `
            <section class="card border-0 shadow-sm rounded-4 mb-3">
                <div class="card-body p-4">
                    <h6 class="fw-bold mb-3">${escapeHtml(title)}</h6>
                    <div class="row g-3">
                        ${printableRows.map((row) => `
                            <div class="col-md-6">
                                <div class="small text-muted text-uppercase">${escapeHtml(row.label)}</div>
                                <div class="fw-semibold text-dark">${escapeHtml(formatReviewValue(row.value, row.emptyValue))}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </section>`;
    };

    const renderReviewStep = () => {
        const container = document.getElementById('reg-review-summary');
        if (!container) return;

        const formData = collectStudentFormData();
        const profileType = normalizeSelection(formData.tipoUsuario);
        const meta = getUserTypeMeta(profileType);
        const extension = formData.docenteExtension || formData.adminExtension || formData.operativoExtension || '';
        const cubiculo = formData.docenteCubiculo || '';
        const roleRows = {
            estudiante: [
                { label: 'Carrera', value: formData.carrera },
                { label: 'Semestre', value: formData.semestre },
                { label: 'Turno', value: formData.turno },
                { label: 'Traslado', value: formData.traslado },
                { label: 'Tiempo de traslado', value: formData.trasladoTiempo },
                { label: 'Internet en casa', value: formData.internetCasa },
                { label: 'Apoyo que más te interesa', value: formData.apoyoAcademico }
            ],
            docente: [
                { label: 'Área o departamento', value: formData.areaAdscripcion },
                { label: 'Academia', value: formData.docenteAcademia },
                { label: 'Enfoque o materias', value: formData.docenteEnfoque },
                { label: 'Disponibilidad para asesoría', value: formData.docenteAsesoria },
                { label: 'Cubículo', value: cubiculo },
                { label: 'Extensión', value: extension }
            ],
            administrativo: [
                { label: 'Área o departamento', value: formData.areaAdscripcion },
                { label: 'Puesto', value: formData.adminPuesto },
                { label: 'Horario de atención', value: formData.adminHorario },
                { label: 'Atiende a estudiantes', value: formData.adminAtencion },
                { label: 'Extensión', value: extension }
            ],
            operativo: [
                { label: 'Área o departamento', value: formData.areaAdscripcion },
                { label: 'Puesto', value: formData.operativoPuesto },
                { label: 'Zona de trabajo', value: formData.operativoZona },
                { label: 'Supervisor inmediato', value: formData.operativoSupervisor },
                { label: 'Turno operativo', value: formData.operativoTurno },
                { label: 'Riesgo laboral principal', value: formData.operativoRiesgo },
                { label: 'Extensión', value: extension }
            ]
        };

        const reviewHtml = [
            `<div class="alert alert-light border rounded-4 mb-4">
                <div class="fw-bold text-dark mb-1">${escapeHtml(meta?.badge || 'Revisión final')}</div>
                <div class="small text-muted">Revisa tu información. Después podrás actualizarla desde tu perfil si necesitas corregir algo.</div>
            </div>`,
            reviewSection('Identidad y contacto', [
                { label: 'Perfil', value: meta?.label || formData.tipoUsuario },
                { label: 'Nombre', value: formData.nombreCompleto },
                { label: 'Matrícula o ID', value: formData.matricula },
                { label: 'Fecha de nacimiento', value: formData.fechaNacimiento },
                { label: 'Teléfono', value: formData.telefono },
                { label: 'Domicilio', value: formData.domicilio }
            ]),
            reviewSection('Contexto institucional', roleRows[profileType] || [
                { label: 'Área o departamento', value: formData.areaAdscripcion }
            ]),
            reviewSection('Salud y emergencia', [
                { label: 'Tipo de sangre', value: formData.tipoSangre },
                { label: 'Condición de salud', value: formData.condicionSalud },
                { label: 'Tratamiento actual', value: formData.tratamientoMédico },
                { label: 'Alergias', value: formData.alergia },
                { label: 'Contacto de emergencia', value: formData.contactoEmergenciaName },
                { label: 'Teléfono de emergencia', value: formData.contactoEmergenciaTel }
            ]),
            reviewSection('Apoyos y preferencias', [
                { label: 'Discapacidad', value: formData.discapacidad, emptyValue: 'Ninguna' },
                { label: 'Apoyo técnico', value: formData.apoyoTecnico },
                { label: 'Ajustes razonables', value: formData.ajustes },
                { label: 'Canal preferido', value: formData.canalPreferido },
                { label: 'Avisos segmentados', value: formData.avisosSegmentados },
                { label: 'Intereses institucionales', value: formData.interesesInstitucionales, emptyValue: 'Sin selección' }
            ])
        ].join('');

        container.innerHTML = reviewHtml;
    };

    const showStep = (step) => {
        // Ocultar todos los pasos
        document.querySelectorAll('.reg-step-container').forEach(el => el.classList.add('d-none'));

        // Mostrar actual
        const stepEl = document.getElementById(`reg-step-${step}`);
        if (stepEl) {
            stepEl.classList.remove('d-none');
            stepEl.classList.add('fade-in');
        }

        // Actualizar barra de progreso (si existe visualmente)
        updateProgressBar(step);
        _currentStep = step;
        if (step === TOTAL_STEPS) {
            renderReviewStep();
        }

        // Scroll top
        window.scrollTo(0, 0);
    };

    const nextStep = () => {
        if (!validateCurrentStep()) return;

        if (_currentStep < TOTAL_STEPS) {
            showStep(_currentStep + 1);
        } else {
            submitStudentRegistration();
        }
    };

    const prevStep = () => {
        if (_currentStep > 0) {
            showStep(_currentStep - 1);
        }
    };

    const validateCurrentStep = () => {
        const currentContainer = document.getElementById(`reg-step-${_currentStep}`);
        if (!currentContainer) return true;

        const inputs = currentContainer.querySelectorAll('input[required], select[required], textarea[required]');
        let valid = true;
        let firstInvalid = null;

        inputs.forEach(input => {
            const trimmedValue = typeof input.value === 'string' ? input.value.trim() : input.value;
            if (typeof input.value === 'string' && input.value !== trimmedValue) {
                input.value = trimmedValue;
            }

            const isEmpty = !trimmedValue;
            const fieldValid = !isEmpty && input.checkValidity();
            if (!fieldValid) {
                input.classList.add('is-invalid');
                valid = false;
                if (!firstInvalid) firstInvalid = input;
            } else {
                input.classList.remove('is-invalid');
            }
        });

        if (!valid) {
            if (firstInvalid && typeof firstInvalid.reportValidity === 'function') {
                firstInvalid.reportValidity();
            } else {
                alert("Por favor completa los campos obligatorios para continuar.");
            }
        }
        return valid;
    };

    const updateProgressBar = (step) => {
        const progress = ((step + 1) / (TOTAL_STEPS + 1)) * 100;
        const bar = document.getElementById('reg-progress-bar');
        if (bar) bar.style.width = `${progress}%`;
        updateStepChrome(step);
    };

    // --- FLUJO STAFF / DEPARTAMENTO ---

    const showDeptSelectionView = () => {
        document.querySelectorAll('.reg-step-container').forEach(el => el.classList.add('d-none'));
        const deptView = document.getElementById('reg-view-dept-selector');
        if (deptView) {
            deptView.classList.remove('d-none');
            deptView.classList.add('fade-in');
        }
    };

    const selectDept = (deptKey) => {
        if (deptKey === 'medico') {
            // Mostrar sub-opciones para médico
            document.getElementById('dept-options-main').classList.add('d-none');
            document.getElementById('dept-options-medico').classList.remove('d-none');
            return;
        }

        // Registrar directamente con el departamento seleccionado
        submitStaffRegistration(deptKey);
    };

    const backToDeptMain = () => {
        document.getElementById('dept-options-medico').classList.add('d-none');
        document.getElementById('dept-options-main').classList.remove('d-none');
    };

    // --- SUBMIT FINAL ---

    const checkGender = (val) => {
        const matGroup = document.getElementById('group-maternity');
        const embarazoInput = document.getElementById('reg-embarazo');
        const lactanciaInput = document.getElementById('reg-lactancia');
        if (!matGroup) return;

        if (normalizeSelection(val) === 'femenino') {
            matGroup.classList.remove('d-none');
            matGroup.querySelector('input, select')?.focus();
            return;
        }

        matGroup.classList.add('d-none');
        if (embarazoInput) embarazoInput.value = 'No';
        if (lactanciaInput) lactanciaInput.value = 'No';
        checkLactancy('No');
    };

    const checkLactancy = (val) => {
        const groupTime = document.getElementById('group-lactancia-tiempo');
        const inputTime = document.getElementById('reg-lactancia-tiempo');
        if (!groupTime || !inputTime) return;

        if (isAffirmative(val)) {
            groupTime.classList.remove('d-none');
            inputTime.required = true;
            inputTime.focus();
        } else {
            groupTime.classList.add('d-none');
            inputTime.required = false;
            inputTime.value = '';
        }
    };



    // --- SUBMIT FINAL ---

    const submitStudentRegistration = async () => {
        showLoading("Creando tu perfil...");

        try {
            const formData = collectStudentFormData();

            // Sanitizar datos para evitar error "Unsupported field value: undefined"
            const sanitize = (value) => {
                if (value === undefined || value === null) return '';
                if (value instanceof Date) return value;
                if (Array.isArray(value)) return value.map((item) => sanitize(item));
                if (typeof value !== 'object') return value;

                const newObj = {};
                Object.keys(value).forEach((key) => {
                    newObj[key] = sanitize(value[key]);
                });
                return newObj;
            };

            // LÓGICA DE ROLES:
            // El usuario pidió que TODOS se vean como "student" en la vista (role='student')
            // PERO que se guarde su "Identidad Institucional" real para reportes.

            let finalEmail = getResolvedInstitutionalEmail();

            // [FIX] Si el correo viene vacío de la autenticación por error,
            // pero tenemos la matrícula del formulario, lo reconstruimos.
            const rawMatricula = formData.matricula || '';
            if (!finalEmail && rawMatricula) {
                if (!rawMatricula.includes('@')) {
                    finalEmail = `${rawMatricula.toLowerCase().trim()}@loscabos.tecnm.mx`;
                } else {
                    finalEmail = rawMatricula.toLowerCase().trim();
                }
                console.log("[Register] Reconstructed missing email from matricula:", finalEmail);
            }

            const rawProfileData = {
                uid: _userCandidate.uid,
                email: finalEmail,
                emailInstitucional: finalEmail,
                emailPersonal: (_userCandidate.email || '').trim().toLowerCase(),
                displayName: formData.nombreCompleto || _userCandidate.displayName,
                matricula: rawMatricula,
                extension: formData.docenteExtension || formData.adminExtension || formData.operativoExtension || '',
                cubiculo: formData.docenteCubiculo || '',

                // Separar identidad institucional de acceso operativo
                role: formData.tipoUsuario === 'estudiante' ? 'student' : 'personal',

                // DATOS REALES (Para Reportes/Distinción)
                tipoUsuario: formData.tipoUsuario, // 'estudiante', 'docente', 'administrativo', etc.
                areaAdscripcion: formData.areaAdscripcion,
                carrera: formData.carrera,

                // Top level copies for easier querying
                domicilio: formData.domicilio,
                tipoSangre: formData.tipoSangre,
                idiomasExtras: formData.idiomasExtra,

                // [FIX] Datos críticos en top-level
                fechaNacimiento: formData.fechaNacimiento,
                telefono: formData.telefono,
                turno: formData.turno,
                genero: formData.genero, // User requested 'Genero' mapping

                contactoEmergenciaName: formData.contactoEmergenciaName,
                contactoEmergenciaTel: formData.contactoEmergenciaTel,

                // Datos extendidos
                personalData: {
                    genero: formData.genero,
                    estadoCivil: formData.estadoCivil,
                    dependientes: formData.dependientes, // String format: "Sí - 2" or "No"
                    dependientesQty: formData.dependientesQty,
                    telefono: formData.telefono,
                    trabaja: formData.trabaja,
                    domicilio: formData.domicilio,
                    beca: formData.beca,
                    areaAdscripcion: formData.areaAdscripcion
                },
                institutionalContext: {
                    category: formData.tipoUsuario,
                    semester: formData.semestre,
                    commuteMethod: formData.traslado,
                    commuteTime: formData.trasladoTiempo,
                    homeInternet: formData.internetCasa,
                    supportInterest: formData.apoyoAcademico,
                    docenteAcademia: formData.docenteAcademia,
                    docenteEnfoque: formData.docenteEnfoque,
                    docenteAsesoria: formData.docenteAsesoria,
                    docenteCubiculo: formData.docenteCubiculo,
                    docenteExtension: formData.docenteExtension,
                    adminPuesto: formData.adminPuesto,
                    adminHorario: formData.adminHorario,
                    adminAtencion: formData.adminAtencion,
                    adminExtension: formData.adminExtension,
                    operativoPuesto: formData.operativoPuesto,
                    operativoZona: formData.operativoZona,
                    operativoSupervisor: formData.operativoSupervisor,
                    operativoTurno: formData.operativoTurno,
                    operativoRiesgo: formData.operativoRiesgo,
                    operativoExtension: formData.operativoExtension,
                    preferredChannel: formData.canalPreferido,
                    segmentedNotices: formData.avisosSegmentados,
                    interests: formData.interesesInstitucionales
                },
                healthData: {
                    tipoSangre: formData.tipoSangre,
                    discapacidad: formData.discapacidad, // Array
                    condicionSalud: formData.condicionSalud,
                    tratamientoMédico: formData.tratamientoMédico,
                    padecimientoMental: formData.padecimientoMental,
                    padecimientoFisico: formData.padecimientoFisico,
                    sustancias: formData.sustancias,
                    apoyoPsico: formData.apoyoPsico,
                    alergia: formData.alergia,
                    contactoEmergencia: formData.contactoEmergenciaName,
                    contactoEmergenciaTel: formData.contactoEmergenciaTel,
                    contactos: (formData.contactoEmergenciaName || formData.contactoEmergenciaTel)
                        ? [{
                            nombre: formData.contactoEmergenciaName,
                            parentesco: formData.contactoEmergenciaRel,
                            telefono: formData.contactoEmergenciaTel
                        }]
                        : [],
                    // NUEVOS CAMPOS (Mujer)
                    embarazo: formData.embarazo || 'No',
                    lactancia: formData.lactancia || 'No',
                    lactanciaTiempo: formData.lactanciaTiempo || '',
                    lactanciaInicio: formData.lactanciaInicio || null
                },
                culturalData: {
                    lenguaIndigena: formData.lenguaIndigena,
                    lenguaSenas: formData.lenguaSenas,
                    grupoEtnico: formData.etnia,
                    apoyoTecnico: formData.apoyoTecnico,
                    ajustes: formData.ajustes,
                    idiomasExtra: formData.idiomasExtra
                },
                prefs: {
                    preferredChannel: formData.canalPreferido,
                    segmentedNotices: isAffirmative(formData.avisosSegmentados)
                },

                createdAt: new Date(),
                lastLogin: new Date(),
                onboardingCompleted: true,
                photoURL: _userCandidate.photoURL || ''
            };

            const profileData = sanitize(rawProfileData);

            await SIA.saveUserProfile(profileData);
            clearDraft();

            // Éxito: Mostrar Modal de Bienvenida
            const wizContainer = document.getElementById('view-register-wizard');
            if (wizContainer) {
                wizContainer.innerHTML = `
                <div class="container min-vh-100 d-flex align-items-center justify-content-center animate-fade-in">
                    <div class="card border-0 shadow-lg rounded-4 text-center p-5" style="max-width: 500px;">
                        <div class="mb-4 text-success">
                            <i class="bi bi-check-circle-fill display-1"></i>
                        </div>
                        <h2 class="fw-bold mb-3">¡Registro Completo!</h2>
                        <p class="text-muted mb-4">
                            Tu expediente digital ha sido creado exitosamente. 
                            Ahora tienes acceso completo a la plataforma SIA.
                        </p>
                        <button onclick="location.reload()" class="btn btn-primary rounded-pill px-5 fw-bold shadow">
                            Entrar a MI SIA <i class="bi bi-arrow-right ms-2"></i>
                        </button>
                    </div>
                </div>`;
            } else {
                location.reload();
            }

        } catch (error) {
            console.error("Error al registrar:", error);
            alert("Hubo un error al guardar tu perfil. Intenta nuevamente.");
            hideLoading();
        }
    };

    const submitStaffRegistration = async (deptKey, subRole = null) => {
        showLoading("Configurando acceso departamental...");
        try {
            const finalEmail = getResolvedInstitutionalEmail();
            const staffAccess = buildStaffRegistrationProfile(deptKey, subRole);
            const profileData = {
                uid: _userCandidate.uid,
                email: finalEmail,
                emailInstitucional: finalEmail,
                emailPersonal: (_userCandidate.email || '').trim().toLowerCase(),
                displayName: _userCandidate.displayName || deptKey.toUpperCase(),
                role: staffAccess.role,
                department: staffAccess.department,
                tipoUsuario: staffAccess.tipoUsuario,
                specialty: staffAccess.specialty,
                especialidad: staffAccess.especialidad,
                allowedViews: staffAccess.allowedViews,
                permissions: staffAccess.permissions,
                createdAt: new Date(),
                lastLogin: new Date(),
                onboardingCompleted: true,
                photoURL: _userCandidate.photoURL || ''
            };

            await SIA.saveUserProfile(profileData);
            clearDraft();
            if (typeof showToast === 'function') showToast("Acceso configurado correctamente.", "success");
            location.reload();

        } catch (error) {
            console.error(error);
            alert("Error configurando departamento.");
            hideLoading();
        }
    };

    // Helper: Recolectar datos del form gigante
    const collectStudentFormData = () => {
        const userCategory = getValue('reg-tipo-usuario');

        const getOptionalInput = (selectId, textId) => {
            const selEl = document.getElementById(selectId);
            if (!selEl) return 'No';
            return isAffirmative(selEl.value) ? (getValue(textId) || 'Si (Sin especificar)') : 'No';
        };

        const getDisabledOrVal = (textId) => {
            const el = document.getElementById(textId);
            return (el && !el.disabled) ? (el.value || 'No') : 'No';
        };

        // Dependientes Logic
        const depBool = getValue('reg-dependientes-bool');
        const depQty = isAffirmative(depBool) ? getValue('reg-dependientes-qty') : '0';
        const dependientesStr = isAffirmative(depBool) ? `Si (${depQty})` : 'No';

        return {
            // METADATOS DE CATEGORÍA
            tipoUsuario: userCategory, // 'estudiante', 'docente', 'administrativo', 'operativo'

            nombreCompleto: getValue('reg-nombre-completo'),
            matricula: getValue('reg-matricula-readonly'),

            // NUEVOS CAMPOS (Solicitados por usuario)
            fechaNacimiento: getValue('reg-fecha-nacimiento'),
            telefono: getValue('reg-telefono'),
            sexo: getValue('reg-genero'), // Mapping "genero" to "sexo" for clarity if needed

            // LÓGICA CONDICIONAL
            carrera: userCategory === 'estudiante' ? getValue('reg-carrera') : '',
            areaAdscripcion: userCategory !== 'estudiante' ? getValue('reg-area-adscripcion') : '',
            turno: userCategory === 'estudiante' ? getValue('reg-turno') : '',
            semestre: getValue('reg-semestre'),
            traslado: getValue('reg-traslado'),
            trasladoTiempo: getValue('reg-traslado-tiempo'),
            internetCasa: getValue('reg-internet-casa'),
            apoyoAcademico: getValue('reg-apoyo-academico'),
            docenteAcademia: getValue('reg-docente-academia'),
            docenteEnfoque: getValue('reg-docente-enfoque'),
            docenteAsesoria: getValue('reg-docente-asesoria'),
            docenteCubiculo: getValue('reg-docente-cubiculo'),
            docenteExtension: getValue('reg-docente-extension'),
            adminPuesto: getValue('reg-admin-puesto'),
            adminHorario: getValue('reg-admin-horario'),
            adminAtencion: getValue('reg-admin-atencion'),
            adminExtension: getValue('reg-admin-extension'),
            operativoPuesto: getValue('reg-operativo-puesto'),
            operativoZona: getValue('reg-operativo-zona'),
            operativoSupervisor: getValue('reg-operativo-supervisor'),
            operativoTurno: getValue('reg-operativo-turno'),
            operativoRiesgo: getValue('reg-operativo-riesgo'),
            operativoExtension: getValue('reg-operativo-extension'),

            genero: getValue('reg-genero'),

            // Maternal (Solo Femenino)
            embarazo: getValue('reg-embarazo'),
            lactancia: getValue('reg-lactancia'),
            lactanciaTiempo: getValue('reg-lactancia-tiempo'),
            lactanciaInicio: (() => {
                const meses = parseInt(getValue('reg-lactancia-tiempo') || '0');
                if (meses > 0) {
                    const d = new Date();
                    d.setMonth(d.getMonth() - meses);
                    return d;
                }
                return null;
            })(),

            estadoCivil: getValue('reg-civil'),

            // Dependientes
            dependientes: dependientesStr,
            dependientesQty: depQty,

            trabaja: getValue('reg-trabaja'),
            domicilio: getValue('reg-domicilio'),
            beca: getOptionalInput('reg-beca-bool', 'reg-beca-desc'),

            // SALUD
            sustancias: getValue('reg-sustancias'),
            apoyoPsico: getValue('reg-apoyo-psico'),
            tipoSangre: getValue('reg-sangre'),
            condicionSalud: getDisabledOrVal('reg-condicion-salud'),
            tratamientoMédico: getDisabledOrVal('reg-tratamiento'),
            padecimientoFisico: getDisabledOrVal('reg-padecimiento-fisico'),
            padecimientoMental: getDisabledOrVal('reg-padecimiento-mental'),
            alergia: getDisabledOrVal('reg-alergia'),

            // INCLUSIÓN Y ACCESIBILIDAD
            discapacidad: getCheckedValues('reg-discapacidad'),
            appoyoTecnico: getValue('reg-apoyo-tecnico'), // typo in original but keeping for consistency if DB uses it
            apoyoTecnico: getValue('reg-apoyo-tecnico'), // Correct one
            ajustes: getValue('reg-ajustes'),
            etnia: getDisabledOrVal('reg-etnia'),
            lenguaIndigena: getValue('reg-lengua'),
            lenguaSenas: getValue('reg-senas'),
            idiomasExtra: getDisabledOrVal('reg-idioma-extra'),
            canalPreferido: getValue('reg-canal-preferido'),
            avisosSegmentados: getValue('reg-avisos-segmentados'),
            interesesInstitucionales: getCheckedValues('reg-intereses'),

            // Contacto Emergencia
            contactoEmergenciaRel: getValue('reg-contacto-rel'),
            contactoEmergenciaName: getValue('reg-contacto-nombre'),
            contactoEmergenciaTel: getValue('reg-contacto-tel')
        };
    };

    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
    };

    const setValue = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }

    const getCheckedValues = (name) => {
        const checked = [];
        document.querySelectorAll(`input[name="${name}"]:checked`).forEach(cb => checked.push(cb.value));
        return checked;
    };

    const resetForms = () => {
        if (_draftSaveTimer) {
            window.clearTimeout(_draftSaveTimer);
            _draftSaveTimer = null;
        }
        document.querySelectorAll('#view-register-wizard form').forEach(f => f.reset());
        document.querySelectorAll('#view-register-wizard .is-invalid').forEach(el => el.classList.remove('is-invalid'));
        if (document.getElementById('reg-progress-bar')) {
            document.getElementById('reg-progress-bar').style.width = '20%';
        }
        _selectedUserType = '';
        handleUserTypeChange('');
        checkGender('');
        updateWelcomePreview('');
        updateStepChrome(0);
        hideLoading();
    };

    const getWizardSubmitButtons = () => Array.from(
        document.querySelectorAll('#view-register-wizard button[type="submit"]')
    );

    const getActiveWizardSubmitButton = () =>
        document.querySelector('#view-register-wizard .reg-step-container:not(.d-none) button[type="submit"]');

    const showLoading = (msg) => {
        const buttons = getWizardSubmitButtons();
        buttons.forEach((button) => {
            if (!button.dataset.originalLabel) button.dataset.originalLabel = button.innerHTML;
            button.disabled = true;
        });

        const activeButton = getActiveWizardSubmitButton();
        if (activeButton) {
            activeButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${msg}`;
        }
    };

    const hideLoading = () => {
        getWizardSubmitButtons().forEach((button) => {
            button.disabled = false;
            button.innerHTML = button.dataset.originalLabel || button.innerHTML;
        });
    };

    const logout = () => {
        if (window.logout) window.logout();
        else location.reload();
    };

    // Public API
    return {
        init,
        nextStep,
        prevStep,
        previewRole,
        selectDept,
        handleUserTypeChange,
        backToDeptMain,
        submitStaffRegistration,
        logout,
        checkGender, // Exported
        checkLactancy // Exported
    };

})();

// Exponer globalmente
window.SIA_Register = SIA_Register;
