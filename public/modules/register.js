/**
 * register.js
 * Módulo para gestionar el flujo de registro y completado de perfil en SIA.
 * Maneja tanto estudiantes/general como personal administrativo/departamental.
 */

const SIA_Register = (() => {

    let _userCandidate = null; // Objeto user de Firebase/Microsoft
    let _extraData = null;     // Datos extra de Microsoft (jobTitle, mobile, etc)
    let _currentStep = 1;
    const TOTAL_STEPS = 3;

    // Elementos DOM cacheados
    let $wizardContainer;

    const handleUserTypeChange = (value) => {
        const isStudent = (value === 'estudiante');

        const groupCarrera = document.getElementById('group-reg-carrera');
        const groupArea = document.getElementById('group-reg-area');
        const inputCarrera = document.getElementById('reg-carrera');
        const inputArea = document.getElementById('reg-area-adscripcion');
        const groupTurno = document.getElementById('group-reg-turno'); // New

        // Sections to toggle based on user role
        const groupTrabaja = document.getElementById('group-reg-trabaja');
        const groupBeca = document.getElementById('group-reg-beca');

        if (isStudent) {
            groupCarrera.classList.remove('d-none');
            groupCarrera.classList.add('animate-slide-down');
            groupArea.classList.add('d-none');
            if (inputCarrera) inputCarrera.required = true;
            if (inputArea) inputArea.required = false;

            // Show Turno for students
            if (groupTurno) {
                groupTurno.classList.remove('d-none');
                groupTurno.classList.add('animate-slide-down');
            }

            // Show Work & Schema for Students
            if (groupTrabaja) groupTrabaja.classList.remove('d-none');
            if (groupBeca) groupBeca.classList.remove('d-none');

        } else {
            groupCarrera.classList.add('d-none');
            groupArea.classList.remove('d-none');
            groupArea.classList.add('animate-slide-down');
            if (inputCarrera) inputCarrera.required = false;
            if (inputArea) inputArea.required = true;

            // Hide Turno for staff
            if (groupTurno) groupTurno.classList.add('d-none');

            // Hide Work & Schema for Staff
            if (groupTrabaja) groupTrabaja.classList.add('d-none');
            if (groupBeca) groupBeca.classList.add('d-none');
            // Reset values to avoid garbage data
            if (document.getElementById('reg-trabaja')) document.getElementById('reg-trabaja').value = 'No';
            if (document.getElementById('reg-beca-bool')) document.getElementById('reg-beca-bool').value = 'No';
        }
    };

    const init = (user, extraData) => {
        console.log("[Register] Iniciando flujo de registro para:", user.email);
        _userCandidate = user;
        _extraData = extraData || {};

        // Cachear elementos
        $wizardContainer = document.getElementById('view-register-wizard');
        // Asegurar visibilidad
        const landing = document.getElementById('landing-view');
        const shell = document.getElementById('app-shell');

        if (landing) landing.classList.add('d-none');
        if (shell) shell.classList.add('d-none');
        if ($wizardContainer) $wizardContainer.classList.remove('d-none');

        // Resetear estado
        _currentStep = 1;
        resetForms();

        // 1. Detección Inteligente de Rol
        detectRoleAndRoute();
    };

    const detectRoleAndRoute = () => {
        const email = _userCandidate.email.toLowerCase();

        // 1. Check Source of Truth (DEPARTMENT_DIRECTORY)
        let isPotentialStaff = false;

        if (window.DEPARTMENT_DIRECTORY && window.DEPARTMENT_DIRECTORY[email]) {
            isPotentialStaff = true;
        }

        // 2. Legacy / Fallback List (just in case)
        if (!isPotentialStaff) {
            const deptEmails = [
                'biblioteca', 'medico', 'atencionpsicopedagogica', 'direccion',
                'escolares', 'residencias', 'extraescolares', 'financieros'
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
        showStep(1);

        // Pre-llenar datos conocidos
        setValue('reg-nombre-completo', _userCandidate.displayName || '');
        setValue('reg-email-readonly', _userCandidate.email || '');
        setValue('reg-matricula-readonly', extractMatricula(_userCandidate.email));
    };

    const extractMatricula = (email) => {
        if (!email) return '';
        const parts = email.split('@');
        // Si es numérico asumimos matrícula, si no, dejamos vacío o user
        return parts[0]; // Simple heuristic
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
        if (_currentStep > 1) {
            showStep(_currentStep - 1);
        }
    };

    const validateCurrentStep = () => {
        const currentContainer = document.getElementById(`reg-step-${_currentStep}`);
        if (!currentContainer) return true;

        const inputs = currentContainer.querySelectorAll('input[required], select[required], textarea[required]');
        let valid = true;

        inputs.forEach(input => {
            if (!input.value.trim()) {
                input.classList.add('is-invalid');
                valid = false;
            } else {
                input.classList.remove('is-invalid');
            }
        });

        if (!valid) {
            alert("Por favor completa los campos obligatorios para continuar.");
        }
        return valid;
    };

    const updateProgressBar = (step) => {
        const progress = (step / TOTAL_STEPS) * 100;
        const bar = document.getElementById('reg-progress-bar');
        if (bar) bar.style.width = `${progress}%`;
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
        if (matGroup) {
            if (val === 'Femenino') {
                matGroup.classList.remove('d-none');
                matGroup.querySelector('input, select').focus();
            } else {
                matGroup.classList.add('d-none');
                // Reset values
            }
        }
    };

    const checkLactancy = (val) => {
        const groupTime = document.getElementById('group-lactancia-tiempo');
        const inputTime = document.getElementById('reg-lactancia-tiempo');
        if (val === 'Sí') {
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
            const sanitize = (obj) => {
                const newObj = {};
                Object.keys(obj).forEach(key => {
                    const val = obj[key];
                    if (val === undefined) newObj[key] = ''; // Default to empty string
                    else if (val === null) newObj[key] = '';
                    else if (typeof val === 'object' && !Array.isArray(val)) newObj[key] = sanitize(val); // Recursion for nested
                    else newObj[key] = val;
                });
                return newObj;
            };

            // LÓGICA DE ROLES:
            // El usuario pidió que TODOS se vean como "student" en la vista (role='student')
            // PERO que se guarde su "Identidad Institucional" real para reportes.

            const rawProfileData = {
                uid: _userCandidate.uid,
                email: _userCandidate.email,
                emailInstitucional: _userCandidate.email,
                displayName: formData.nombreCompleto || _userCandidate.displayName,
                matricula: formData.matricula,

                // MANTENER COMPATIBILIDAD DE VISTA
                role: 'student',

                // DATOS REALES (Para Reportes/Distinción)
                tipoUsuario: formData.tipoUsuario, // 'estudiante', 'docente', 'administrativo', etc.
                areaAdscripcion: formData.areaAdscripcion,
                carrera: formData.carrera,

                // Top level copies for easier querying
                domicilio: formData.domicilio,
                tipoSangre: formData.tipoSangre,

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
                    trabaja: formData.trabaja,
                    domicilio: formData.domicilio,
                    beca: formData.beca,
                    areaAdscripcion: formData.areaAdscripcion
                },
                healthData: {
                    discapacidad: formData.discapacidad, // Array
                    condicionSalud: formData.condicionSalud,
                    tratamientoMedico: formData.tratamientoMedico,
                    padecimientoMental: formData.padecimientoMental,
                    padecimientoFisico: formData.padecimientoFisico,
                    sustancias: formData.sustancias,
                    apoyoPsico: formData.apoyoPsico,
                    alergia: formData.alergia,
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
                    ajustes: formData.ajustes
                },

                createdAt: new Date(),
                lastLogin: new Date(),
                onboardingCompleted: true,
                photoURL: _userCandidate.photoURL || ''
            };

            const profileData = sanitize(rawProfileData);

            await SIA.saveUserProfile(profileData);

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
            const profileData = {
                uid: _userCandidate.uid,
                email: _userCandidate.email,
                displayName: _userCandidate.displayName || deptKey.toUpperCase(),
                role: deptKey, // biblioteca, medi, aula... 
                department: deptKey,
                especialidad: subRole, // medico, psicologo (opcional)
                createdAt: new Date(),
                lastLogin: new Date(),
                onboardingCompleted: true,
                photoURL: _userCandidate.photoURL || ''
            };

            await SIA.saveUserProfile(profileData);
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
            return (selEl.value === 'Sí') ? (getValue(textId) || 'Sí (Sin especificar)') : 'No';
        };

        const getDisabledOrVal = (textId) => {
            const el = document.getElementById(textId);
            return (el && !el.disabled) ? (el.value || 'No') : 'No';
        };

        // Dependientes Logic
        const depBool = getValue('reg-dependientes-bool');
        const depQty = (depBool === 'Sí') ? getValue('reg-dependientes-qty') : '0';
        const dependientesStr = (depBool === 'Sí') ? `Sí (${depQty})` : 'No';

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
            carrera: userCategory === 'estudiante' ? getValue('reg-carrera') : 'N/A',
            areaAdscripcion: userCategory !== 'estudiante' ? getValue('reg-area-adscripcion') : 'N/A',
            turno: userCategory === 'estudiante' ? getValue('reg-turno') : 'N/A',

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
            tratamientoMedico: getDisabledOrVal('reg-tratamiento'),
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

            // Contacto Emergencia
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
        document.querySelectorAll('#view-register-wizard form').forEach(f => f.reset());
        if (document.getElementById('reg-progress-bar')) {
            document.getElementById('reg-progress-bar').style.width = '33%';
        }
    };

    const showLoading = (msg) => {
        const btn = document.querySelector('#view-register-wizard button[type="submit"]');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${msg}`;
        }
    };

    const hideLoading = () => {
        const btn = document.querySelector('#view-register-wizard button[type="submit"]');
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Registrar y Entrar";
        }
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
