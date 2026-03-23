// admin.medi.consultas.js
if (!window.AdminMedi) window.AdminMedi = {};
window.AdminMedi.Consultas = (function () {
  // Sub-module consultas
  const getOperationalContext = () => AdminMedi.getOperationalContext ? AdminMedi.getOperationalContext() : {
    role: AdminMedi.State.myRole,
    shift: AdminMedi.State.currentShift || null,
    profileId: AdminMedi.State.currentProfile ? AdminMedi.State.currentProfile.id : null,
    ownerUid: AdminMedi.State.myUid,
    professionalName: AdminMedi.State.currentProfile
      ? AdminMedi.State.currentProfile.displayName
      : (AdminMedi.State.ctx?.profile?.displayName || AdminMedi.State.ctx?.auth?.currentUser?.email || 'Profesional'),
    specialty: AdminMedi.State.currentProfile?.specialty || AdminMedi.State.currentProfile?.especialidad || '',
    professionalPhone: AdminMedi.State.currentProfile?.phone || AdminMedi.State.currentProfile?.telefono || '',
    professionalEmail: AdminMedi.State.currentProfile?.email || AdminMedi.State.ctx?.auth?.currentUser?.email || '',
    cedulaLabel: AdminMedi.State.currentProfile?.cedulaLabel || '',
    cedula: AdminMedi.State.profesionalCedula || AdminMedi.State.ctx?.profile?.cedula || ''
  };
  const CONSULTATION_TEMPLATES = {
    med_cefalea: {
      label: 'Cefalea',
      subjetivo: 'Paciente refiere cefalea de inicio reciente, sin datos de alarma al interrogatorio inicial.',
      objetivo: 'Paciente consciente, orientado y cooperador. Sin alteraciones aparentes en exploracion general.',
      diagnostico: 'Cefalea',
      plan: 'Reposo relativo, hidratacion, analgesico segun indicacion y vigilancia de datos de alarma.'
    },
    med_resfriado: {
      label: 'Resfriado',
      subjetivo: 'Paciente refiere malestar general con sintomas respiratorios altos de corta evolucion.',
      objetivo: 'Orofaringe sin datos de compromiso severo. Signos vitales estables.',
      diagnostico: 'Infeccion respiratoria alta',
      plan: 'Manejo sintomatico, hidratacion, reposo y vigilancia de fiebre persistente o dificultad respiratoria.'
    },
    med_gastro: {
      label: 'Gastrico',
      subjetivo: 'Paciente refiere dolor abdominal o molestia gastrica posterior a alimentos.',
      objetivo: 'Paciente estable, abdomen depresible y sin datos de abdomen agudo a la exploracion inicial.',
      diagnostico: 'Gastritis / dispepsia',
      plan: 'Dieta blanda, hidratacion, manejo indicado y retorno si hay dolor intenso, vomito persistente o fiebre.'
    },
    psi_ansiedad: {
      label: 'Ansiedad',
      subjetivo: 'Paciente refiere ansiedad situacional asociada a carga academica o personal reciente.',
      objetivo: 'Se observa inquietud, pero mantiene adecuada orientacion, lenguaje y cooperacion.',
      diagnostico: 'Sintomatologia ansiosa',
      plan: 'Psicoeducacion, tecnicas de respiracion, contencion breve y seguimiento cercano.',
      estadoEmocional: 'Ansioso/a',
      tipoIntervencion: 'Apoyo emocional'
    },
    psi_orientacion: {
      label: 'Orientacion',
      subjetivo: 'Paciente solicita orientacion respecto a situacion personal o academica actual.',
      objetivo: 'Paciente participa de forma activa y mantiene capacidad de insight durante la sesion.',
      diagnostico: 'Orientacion psicologica inicial',
      plan: 'Orientacion breve, acuerdos de autocuidado y seguimiento si persisten sintomas.',
      estadoEmocional: 'Estable',
      tipoIntervencion: 'Orientación'
    },
    psi_crisis: {
      label: 'Crisis',
      subjetivo: 'Paciente refiere sentirse rebasado por evento reciente y solicita apoyo inmediato.',
      objetivo: 'Se observa activacion emocional importante; se prioriza contencion y estabilizacion.',
      diagnostico: 'Intervencion en crisis',
      plan: 'Contencion emocional, red de apoyo, plan de seguridad y cita de seguimiento prioritaria.',
      estadoEmocional: 'En crisis',
      tipoIntervencion: 'Crisis'
    }
  };

  function _buildTemplateBar() {
    const isMedicalRole = !/psic/i.test(String(AdminMedi.State.myRole || ''));
    const templateIds = isMedicalRole
      ? ['med_cefalea', 'med_resfriado', 'med_gastro']
      : ['psi_ansiedad', 'psi_orientacion', 'psi_crisis'];

    return `
      <div class="mb-3">
        <div class="d-flex align-items-center gap-2 mb-2">
          <span class="badge bg-dark-subtle text-dark border" style="font-size:.62rem;">
            <i class="bi bi-lightning-charge-fill me-1"></i>PLANTILLAS RAPIDAS
          </span>
          <span class="text-muted" style="font-size:.68rem;">Rellenan el SOAP base sin cambiar notas privadas.</span>
        </div>
        <div class="d-flex flex-wrap gap-2">
          ${templateIds.map((templateId) => `
            <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill fw-semibold"
              onclick="AdminMedi.Consultas.applyConsultaTemplate('${templateId}')">
              ${CONSULTATION_TEMPLATES[templateId].label}
            </button>
          `).join('')}
        </div>
      </div>`;
  }

  function applyConsultaTemplate(templateId) {
    const template = CONSULTATION_TEMPLATES[templateId];
    if (!template) return;

    const fieldMap = {
      subjetivo: document.getElementById('soap-subjetivo'),
      objetivo: document.getElementById('soap-objetivo'),
      diagnostico: document.getElementById('soap-diagnóstico'),
      plan: document.getElementById('soap-plan'),
      estadoEmocional: document.getElementById('soap-estado-emocional'),
      tipoIntervencion: document.getElementById('soap-tipo-intervencion')
    };

    const hasContent = ['subjetivo', 'objetivo', 'diagnostico', 'plan']
      .some((key) => fieldMap[key] && String(fieldMap[key].value || '').trim());

    if (hasContent && !window.confirm('Esta plantilla reemplazara el contenido actual del SOAP. ¿Deseas continuar?')) {
      return;
    }

    Object.entries(fieldMap).forEach(([key, field]) => {
      if (!field || template[key] == null) return;
      field.value = template[key];
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    });

    showToast(`Plantilla aplicada: ${template.label}`, 'success');
  }

  async function _resolvePrivateConsultationNotes(exp = {}) {
    const inlineNotes = String(exp?.notasPrivadas || '').trim();
    const scope = getOperationalContext();
    if (inlineNotes) {
      if (exp.studentId && exp.id && MediService?.migrateLegacyPrivateConsultaNote) {
        MediService.migrateLegacyPrivateConsultaNote(AdminMedi.State.ctx, exp.studentId, exp.id, inlineNotes, exp).catch(() => { });
      }
      return inlineNotes;
    }

    if (!exp.studentId || !exp.id || !MediService?.getPrivateConsultaNote) return '';
    return MediService.getPrivateConsultaNote(AdminMedi.State.ctx, exp.studentId, exp.id, scope, exp);
  }

  async function iniciarConsulta(encodedCita, encodedStudent) {
    let cita = {};
    let student = {};

    if (encodedCita && encodedCita !== "null") {
      cita = JSON.parse(decodeURIComponent(encodedCita));
      const studentSnap = await AdminMedi.State.ctx.db.collection('usuarios').doc(cita.studentId).get();
      student = studentSnap.exists ? studentSnap.data() : {};

    } else if (encodedStudent) {
      const s = JSON.parse(decodeURIComponent(encodedStudent));

      // [FIX] Ensure Anonymous/Walk-in data is captured correctly
      student = {
        uid: s.uid,
        email: s.email,
        displayName: s.displayName || s.email,
        matricula: s.matricula,
        // IMPORTANT: Capture Gender for Reports
        genero: s.genero || (s.personalData ? s.personalData.genero : 'Desconocido'),
        sexo: s.genero || (s.personalData ? s.personalData.genero : 'Desconocido'), // fallback
        edad: s.edad
      };

      // Also carry over personalData object if it exists (for robustness)
      if (s.personalData) student.personalData = s.personalData;

      cita = {
        id: 'walkin_' + Date.now(),
        studentId: s.uid,
        studentEmail: s.email,
        tipoServicio: AdminMedi.State.myRole,
        // Persist basic demog for report generation if student doesn't adhere to standard profile
        pacienteNombre: student.displayName,
        pacienteGenero: student.genero,
        pacienteMatricula: student.matricula
      };

      // Try to fetch real profile if it's a real UID (not anon)
      if (!s.uid.startsWith('anon_')) {
        const studentSnap = await AdminMedi.State.ctx.db.collection('usuarios').doc(s.uid).get();
        if (studentSnap.exists) {
          const realData = studentSnap.data();
          student = { ...student, ...realData };
          // Prefer real data if available
          if (realData.genero) student.genero = realData.genero;
        }
      }

    }

    // Store consultation data
    AdminMedi.State.lastConsultaData = { cita, studentId: cita.studentId };
    AdminMedi.State.consultaActive = true;

    // Render SOAP form in the modal
    renderInlineConsultationUI(student, cita);

    // Open the SOAP modal (fullscreen-like)
    const soapModal = document.getElementById('modalConsulta');
    if (soapModal) {
      // Update modal header with patient info
      const nameEl = document.getElementById('soap-patient-name');
      const metaEl = document.getElementById('soap-patient-meta');
      if (nameEl) nameEl.textContent = student.displayName || student.email || 'Paciente';
      if (metaEl) metaEl.textContent = `${student.matricula || ''} • ${AdminMedi.State.myRole} `;

      const modal = new bootstrap.Modal(soapModal);
      modal.show();
    }

    // [FIX] Populate hidden form inputs so saveConsultation can read studentId/email/citaId
    const hidStudentId = document.getElementById('soap-student-id');
    const hidStudentEmail = document.getElementById('soap-student-email');
    const hidCitaId = document.getElementById('soap-cita-id');
    if (hidStudentId) hidStudentId.value = student.uid || cita.studentId || '';
    if (hidStudentEmail) hidStudentEmail.value = student.email || cita.studentEmail || '';
    if (hidCitaId) hidCitaId.value = cita.id || '';

    const precheckEl = document.getElementById('soap-precheck-summary');
    if (precheckEl) {
      precheckEl.innerHTML = '<div class="text-center py-2 text-muted small"><span class="spinner-border spinner-border-sm"></span></div>';
      const operational = AdminMedi.getOperationalContext ? AdminMedi.getOperationalContext() : {
        role: AdminMedi.State.myRole,
        ownerUid: AdminMedi.State.myUid,
        shift: AdminMedi.State.currentShift,
        profileId: AdminMedi.State.currentProfile ? AdminMedi.State.currentProfile.id : null
      };

      MediService.getPatientOperationalSnapshot(AdminMedi.State.ctx, student.uid || cita.studentId, operational)
        .then((snapshot) => {
          const chips = [];
          chips.push(`<span class="badge border text-dark">Consultas: ${snapshot.totalConsultas || 0}</span>`);
          chips.push(`<span class="badge border text-dark">Citas activas: ${snapshot.activeAppointments || 0}</span>`);
          chips.push(`<span class="badge border text-dark">No-show: ${snapshot.noShowCount || 0}</span>`);
          if (snapshot.followUp?.date) {
            chips.push(`<span class="badge ${snapshot.followUp.overdue ? 'bg-danger' : 'bg-warning text-dark'}">${snapshot.followUp.overdue ? 'Seguimiento vencido' : 'Seguimiento activo'}: ${snapshot.followUp.date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>`);
          }

          precheckEl.innerHTML = `
            <div class="rounded-4 border p-3" style="background:linear-gradient(135deg,#f8fbff,#eef6ff);">
              <div class="d-flex justify-content-between align-items-start gap-3 mb-2">
                <div>
                  <div class="fw-bold text-dark">Resumen preconsulta</div>
                  <div class="small text-muted">${snapshot.lastDiagnosis ? escapeHtml(snapshot.lastDiagnosis) : 'Sin diagnóstico previo registrado'}</div>
                </div>
                <div class="small text-muted text-end">${snapshot.lastConsultationDate ? snapshot.lastConsultationDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Primera consulta'}</div>
              </div>
              <div class="d-flex flex-wrap gap-2">${chips.join('')}</div>
            </div>`;
        })
        .catch(() => {
          precheckEl.innerHTML = '<div class="small text-muted">No se pudo cargar el resumen preconsulta.</div>';
        });
    }

    // Populate Right Panel (Patient Info & Previous Consultations)
    const profileEl = document.getElementById('soap-patient-profile');
    if (profileEl) {
      const age = student.fechaNacimiento ? MediService.calculateAge(student.fechaNacimiento) : (student.edad || '--');
      profileEl.innerHTML = `
        <div class="row g-2 mb-3">
          <div class="col-4 text-center"><div class=" rounded-3 p-2"><div class="extra-small text-muted">Edad</div><div class="fw-bold small">${age}</div></div></div>
          <div class="col-4 text-center"><div class=" rounded-3 p-2"><div class="extra-small text-muted">Sangre</div><div class="fw-bold small text-danger">${escapeHtml(student.tipoSangre || '--')}</div></div></div>
          <div class="col-4 text-center"><div class=" rounded-3 p-2"><div class="extra-small text-muted">Género</div><div class="fw-bold small">${escapeHtml(student.genero || '--')}</div></div></div>
        </div>
        ${student.alergias ? `<div class="alert alert-danger border-0 py-2 px-3 small mb-0"><i class="bi bi-exclamation-triangle-fill me-1"></i><strong>Alergias:</strong> ${escapeHtml(student.alergias)}</div>` : ''}
      `;
    }

    const historyEl = document.getElementById('soap-history-list');
    if (historyEl) {
      historyEl.innerHTML = '<div class="text-center text-muted extra-small py-2"><span class="spinner-border spinner-border-sm"></span></div>';
      const profId = AdminMedi.State.currentProfile ? AdminMedi.State.currentProfile.id : null;
      MediService.getExpedienteHistory(AdminMedi.State.ctx, student.uid || cita.studentId, AdminMedi.State.myRole, AdminMedi.State.myUid, AdminMedi.State.currentShift, profId)
        .then(history => {
          if (!history || history.length === 0) {
            historyEl.innerHTML = '<div class="text-muted extra-small py-2 text-center">Sin consultas previas</div>';
            return;
          }
          historyEl.innerHTML = history.slice(0, 5).map(h => {
            const d = h.safeDate || new Date();
            return `<div class="list-group-item list-group-item-action px-0 py-2 border-bottom border-light bg-transparent">
               <div class="d-flex w-100 justify-content-between mb-1">
                 <h6 class="mb-0 fw-bold small text-truncate" style="max-width: 70%;">${escapeHtml(h.diagnostico || h.motivo || 'General')}</h6>
                 <small class="text-muted" style="font-size: 0.65rem;">${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
               </div>
               <div class="mb-0 small text-muted text-truncate">${escapeHtml(h.tipoServicio || '')}</div>
             </div>`;
          }).join('');
        })
        .catch(e => {
          historyEl.innerHTML = '<div class="text-danger extra-small py-2">Error cargando historial</div>';
        });
    }

    // Start consultation timer
    _startConsultaTimer();


  }

  function renderInlineConsultationUI(u, cita) {
    const container = document.getElementById('soap-fields-container') || document.getElementById('medi-inline-consulta');
    if (!container) return;

    const safeName = escapeHtml(u.displayName || u.email || '');
    const safeMatricula = escapeHtml(u.matricula || 'Ext');
    const initial = (u.displayName || u.email || 'P')[0].toUpperCase();
    const COLORS = [['#dbeafe', '#1d4ed8'], ['#d1fae5', '#065f46'], ['#ede9fe', '#5b21b6'],
    ['#fce7f3', '#9d174d'], ['#fef3c7', '#92400e'], ['#fee2e2', '#991b1b']];
    const [bgC, fgC] = COLORS[initial.charCodeAt(0) % COLORS.length];

    // --- HEADER DEL PACIENTE ---
    const patientHeader = `
        <div class="d-flex align-items-center gap-3 p-3 mb-3 rounded-3 border-0"
             style="background:linear-gradient(135deg,#f0f7ff,#e8f4fd);">
        <div class="medi-avatar flex-shrink-0" style="background:${bgC};color:${fgC};width:44px;height:44px;font-size:1.1rem;">${initial}</div>
        <div class="flex-fill">
          <div class="fw-bold text-dark" style="font-size:.9rem;">${safeName}</div>
          <div class="text-muted" style="font-size:.7rem;">${safeMatricula}</div>
        </div>
        <div class="text-end">
          <div class="text-muted fw-bold" style="font-size:.75rem;">
            ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} <br>
            <span style="font-size:.65rem; font-weight:normal;">${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>`;

    let formContent = '';
    const followUpSection = `
      <div class="mt-3 pt-3 border-top">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
          <div>
            <div class="fw-bold text-dark" style="font-size:.85rem;">Cierre guiado</div>
            <div class="small text-muted">¿Necesita seguimiento programado?</div>
          </div>
          <div class="form-check form-switch m-0">
            <input class="form-check-input" type="checkbox" id="soap-followup-check"
              onchange="document.getElementById('soap-followup-panel')?.classList.toggle('d-none', !this.checked)">
          </div>
        </div>
        <div id="soap-followup-panel" class="d-none rounded-4 border p-3" style="background:#fffdf5;">
          <div class="row g-2">
            <div class="col-md-4">
              <label class="small fw-bold text-muted d-block mb-1">Fecha sugerida</label>
              <input type="date" id="soap-followup-date" class="form-control form-control-sm rounded-3">
            </div>
            <div class="col-md-4">
              <label class="small fw-bold text-muted d-block mb-1">Hora sugerida</label>
              <input type="time" id="soap-followup-time" class="form-control form-control-sm rounded-3">
            </div>
            <div class="col-md-4">
              <label class="small fw-bold text-muted d-block mb-1">Motivo</label>
              <input type="text" id="soap-followup-notes" class="form-control form-control-sm rounded-3" placeholder="Seguimiento">
            </div>
          </div>
          <div class="small text-muted mt-2">Si está activado, al finalizar se intentará crear la cita de seguimiento en el mismo flujo.</div>
        </div>
      </div>
    `;

    if (AdminMedi.State.myRole === 'Médico') {
      formContent = `
        ${_buildTemplateBar()}
        <div class="mb-3">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="badge bg-primary-subtle text-primary border" style="font-size:.62rem;">
              <i class="bi bi-activity me-1"></i>SIGNOS VITALES
            </span>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <div class="soap-vital-pill">
              <label for="soap-temp">Temp °C</label>
              <input type="number" id="soap-temp" placeholder="--" step="0.1">
            </div>
            <div class="soap-vital-pill">
              <label for="soap-presion">Presion</label>
              <input type="text" id="soap-presion" placeholder="000/00">
            </div>
            <div class="soap-vital-pill">
              <label for="soap-peso">Peso kg</label>
              <input type="number" id="soap-peso" placeholder="--" step="0.1">
            </div>
            <div class="soap-vital-pill">
              <label for="soap-talla">Talla cm</label>
              <input type="number" id="soap-talla" placeholder="--">
            </div>
          </div>
        </div>

        <!-- S - Subjetivo -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill bg-primary text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;">S</span>
            <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Subjetivo — Motivo</label>
          </div>
          <textarea class="form-control form-control-sm  border-0 rounded-3"
                    id="soap-subjetivo" rows="2" placeholder="Motivo de consulta segun el paciente..."></textarea>
        </div>

        <!-- O - Objetivo -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill bg-success text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;">O</span>
            <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Objetivo — Exploracion</label>
          </div>
          <textarea class="form-control form-control-sm  border-0 rounded-3"
                    id="soap-objetivo" rows="2" placeholder="Hallazgos clinicos, exploracion fisica..."></textarea>
        </div>

        <!-- Padecimiento Privado -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill bg-danger text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;"><i class="bi bi-lock-fill" style="font-size:.5rem;"></i></span>
            <label class="fw-bold text-danger mb-0" style="font-size:.78rem;">Padecimiento Actual (Privado)</label>
          </div>
          <textarea class="form-control form-control-sm bg-danger-subtle border-danger-subtle rounded-3"
                    id="soap-private-notes" rows="2" placeholder="Notas privadas del padecimiento..."></textarea>
        </div>

        <!-- A - Diagnostico -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill bg-warning text-dark fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;">A</span>
            <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Diagnostico</label>
          </div>
          <input type="text" class="form-control form-control-sm fw-bold rounded-3 border-0 "
                 id="soap-diagnóstico" placeholder="Diagnostico principal...">
        </div>

        <!--P - Plan-- >
  <div class="mb-2">
    <div class="d-flex align-items-center gap-2 mb-1">
      <span class="badge rounded-pill text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:#0f766e;">P</span>
      <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Plan de Tratamiento</label>
    </div>
    <textarea class="form-control form-control-sm bg-success-subtle border-success-subtle rounded-3"
      id="soap-plan" rows="3" placeholder="Indicaciones, medicamentos, referencias..."></textarea>
  </div>
`;
    } else {
      // VISTA PSICOLOGO
      formContent = `
        ${_buildTemplateBar()}
        <div class="mb-3 p-3 rounded-3 border-0" style="background:rgba(124,58,237,.06);">
          <div class="d-flex align-items-center gap-2 mb-3">
            <span class="badge border fw-bold" style="font-size:.62rem;background:rgba(124,58,237,.1);color:#7c3aed;">
              <i class="bi bi-brain me-1"></i>EVALUACION PSICOLOGICA
            </span>
          </div>
          <div class="row g-2">
            <div class="col-6">
              <label class="d-block fw-bold mb-1" style="font-size:.68rem;color:#7c3aed;">Estado Emocional</label>
              <select id="soap-estado-emocional" class="form-select form-select-sm border-0 fw-bold rounded-3">
                <option value="">Seleccionar...</option>
                <option value="Estable">Estable</option>
                <option value="Ansioso/a">Ansioso/a</option>
                <option value="Deprimido/a">Deprimido/a</option>
                <option value="Agitado/a">Agitado/a</option>
                <option value="En crisis">En crisis</option>
                <option value="Inestable">Inestable</option>
                <option value="Recuperacion">En recuperacion</option>
              </select>
            </div>
            <div class="col-6">
              <label class="d-block fw-bold mb-1" style="font-size:.68rem;color:#7c3aed;">Tipo de Intervencion</label>
              <select id="soap-tipo-intervencion" class="form-select form-select-sm border-0 fw-bold rounded-3">
                <option value="">Seleccionar...</option>
                <option value="Orientación">Orientación</option>
                <option value="Apoyo emocional">Apoyo emocional</option>
                <option value="Psicoterapia breve">Psicoterapia breve</option>
                <option value="Crisis">Intervencion en crisis</option>
                <option value="Referencia">Referencia externa</option>
              </select>
            </div>
          </div>
        </div>

        <!-- S -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:#7c3aed;">S</span>
            <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Subjetivo — Motivo de consulta</label>
          </div>
          <textarea class="form-control form-control-sm  border-0 rounded-3"
                    id="soap-subjetivo" rows="2" placeholder="Motivo segun el paciente..."></textarea>
        </div>

        <!--O -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:#0891b2;">O</span>
            <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Objetivo — Observaciones</label>
          </div>
          <textarea class="form-control form-control-sm  border-0 rounded-3"
                    id="soap-objetivo" rows="2" placeholder="Comportamiento observado, lenguaje corporal..."></textarea>
        </div>

        <!--A -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill text-dark fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:#fbbf24;">A</span>
            <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Diagnostico / Evaluacion</label>
          </div>
          <input type="text" class="form-control form-control-sm fw-bold rounded-3 border-0 "
                 id="soap-diagn\u00f3stico" placeholder="Diagnostico o impresion clinica...">
        </div>

        <!--P -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:#0f766e;">P</span>
            <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Plan de Intervencion</label>
          </div>
          <textarea class="form-control form-control-sm bg-success-subtle border-success-subtle rounded-3"
                    id="soap-plan" rows="2" placeholder="Acciones, seguimiento, derivacion..."></textarea>
        </div>

        <!--Notas Privadas-- >
  <div class="mb-2">
    <div class="d-flex align-items-center gap-2 mb-1">
      <span class="badge rounded-pill text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:#dc2626;"><i class="bi bi-shield-lock-fill" style="font-size:.5rem;"></i></span>
      <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Notas Privadas (Confidencial)</label>
    </div>
    <textarea class="form-control form-control-sm border-warning bg-warning-subtle rounded-3"
      id="soap-private-notes" rows="2" placeholder="Notas confidenciales del psicologo..."></textarea>
  </div>
`;
    }

    container.innerHTML = patientHeader + formContent + followUpSection;
  }

  function _startConsultaTimer() {
    _stopConsultaTimer();
    AdminMedi.State.consultaStartTime = new Date();
    const timerEl = document.getElementById('consulta-timer');
    AdminMedi.State.consultaTimer = setInterval(() => {
      if (!timerEl) return;
      const elapsed = Math.floor((Date.now() - AdminMedi.State.consultaStartTime.getTime()) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      timerEl.textContent = mins + ':' + secs;
      // Color change after 20 min
      if (elapsed > 1200) timerEl.classList.replace('bg-dark', 'bg-warning');
    }, 1000);
  }

  function _stopConsultaTimer() {
    if (AdminMedi.State.consultaTimer) { clearInterval(AdminMedi.State.consultaTimer); AdminMedi.State.consultaTimer = null; }
  }

  function _getConsultaDurationMinutes() {
    if (!AdminMedi.State.consultaStartTime) return 0;
    return Math.round((Date.now() - AdminMedi.State.consultaStartTime.getTime()) / 60000);
  }

  function _cleanupConsultation() {
    _stopConsultaTimer();
    AdminMedi.State.consultaActive = false;
    AdminMedi.State.consultaStartTime = null;

    // Reset Zona B to agenda
    const tabBtn = document.getElementById('tab-btn-consulta');
    if (tabBtn) { tabBtn.disabled = true; tabBtn.classList.remove('text-danger'); }
    if (AdminMedi && AdminMedi.Ui && AdminMedi.Ui._switchWorkTab) {
      AdminMedi.Ui._switchWorkTab('agenda');
    }

    // Clear inline container
    const container = document.getElementById('medi-inline-consulta');
    if (container) container.innerHTML = '';
  }

  async function saveConsultation(e, isFinal = true, statusOverride = null) {
    if (e) e.preventDefault();
    if (AdminMedi.State.isSaving) return; // Block duplicate calls
    if (document.activeElement) document.activeElement.blur();

    // Manejo de UI: Spinner y deshabilitar botones
    const btnFinalizar = document.getElementById('btn-finalizar-consulta');
    const btnCancelarF = document.getElementById('btn-cancelar-finalizar');

    if (isFinal) {
      if (btnFinalizar) {
        btnFinalizar.disabled = true;
        btnFinalizar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
      }
      if (btnCancelarF) btnCancelarF.disabled = true;
      // Retrasamos el cierre del modal hasta que se complete (ver try/catch abajo)
    }

    const studentIdEl = document.getElementById('soap-student-id');
    if (!studentIdEl) return; // No active consultation

    const studentId = studentIdEl.value;
    const studentEmail = document.getElementById('soap-student-email').value;
    const citaId = document.getElementById('soap-cita-id').value;
    const studentName = document.getElementById('soap-patient-name')?.textContent?.trim() || studentEmail || 'Paciente';

    let status = 'finalizada'; // Always final if saving
    if (!isFinal) return;

    AdminMedi.State.isSaving = true; // Lock

    const operational = getOperationalContext();
    const resolvedProfessional = window.MediService?.resolveProfessionalIdentity
      ? MediService.resolveProfessionalIdentity({
        displayName: operational.professionalName,
        specialty: operational.specialty,
        cedula: operational.cedula,
        cedulaLabel: operational.cedulaLabel,
        phone: operational.professionalPhone,
        email: operational.professionalEmail,
        profileId: operational.profileId
      }, operational.role, operational.shift)
      : null;
    const payload = {
      studentId, studentEmail, studentName,
      autorId: operational.ownerUid,
      autorEmail: AdminMedi.State.ctx.auth.currentUser.email,
      tipoServicio: operational.role === 'Psicologo' ? 'Psicologico' : operational.role,
      shift: operational.shift,
      profesionalProfileId: resolvedProfessional?.profileId || operational.profileId,
      profesionalName: resolvedProfessional?.displayName || operational.professionalName,
      profesionalSpecialty: resolvedProfessional?.specialty || operational.specialty || operational.role,
      profesionalEmail: resolvedProfessional?.email || operational.professionalEmail || AdminMedi.State.ctx.auth.currentUser.email,
      profesionalPhone: resolvedProfessional?.phone || operational.professionalPhone || '',
      profesionalCedulaLabel: resolvedProfessional?.cedulaLabel || operational.cedulaLabel || '',
      cedula: resolvedProfessional?.cedula || operational.cedula || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      estado: status,
      duracionMinutos: _getConsultaDurationMinutes(),
      visiblePaciente: true,

      // SOAP FIELDS
      subjetivo: document.getElementById('soap-subjetivo')?.value || '',
      objetivo: document.getElementById('soap-objetivo')?.value || '',
      diagnostico: document.getElementById('soap-diagnóstico')?.value || '',
      plan: document.getElementById('soap-plan')?.value || '',
      // Capturamos Notas Privadas del ID unificado (está presente en ambos templates con el mismo ID)
      notasPrivadas: document.getElementById('soap-private-notes')?.value || ''
    };

    // Role-specific fields
    if (operational.role === 'Médico') {
      payload.temp = document.getElementById('soap-temp')?.value || null;
      payload.presion = document.getElementById('soap-presion')?.value || null;
      payload.peso = document.getElementById('soap-peso')?.value || null;
      payload.talla = document.getElementById('soap-talla')?.value || null;
      payload.signos = {
        temp: payload.temp,
        presion: payload.presion,
        peso: payload.peso,
        talla: payload.talla
      };
    } else {
      // Psicologo fields
      payload.estadoEmocional = document.getElementById('soap-estado-emocional')?.value || null;
      payload.tipoIntervencion = document.getElementById('soap-tipo-intervencion')?.value || null;
      // Instrumentos removed
    }

    // Auto-Booking Logic for Follow-Up (Psicologo Only)
    const followUpCheck = document.getElementById('soap-followup-check');
    let followUpSuccess = false;

    if (followUpCheck && followUpCheck.checked) {
      const fDate = document.getElementById('soap-followup-date')?.value;
      const fTime = document.getElementById('soap-followup-time')?.value;
      const fNotes = document.getElementById('soap-followup-notes')?.value || 'Seguimiento';

      if (fDate && fTime) {
        try {
          // Construct Date Object
          const [year, month, day] = fDate.split('-').map(Number);
          const [hours, minutes] = fTime.split(':').map(Number);
          const appointmentDate = new Date(year, month - 1, day, hours, minutes);

          if (appointmentDate < new Date()) {
            showToast('La fecha de seguimiento no puede ser en el pasado.', 'warning');
            payload.followUp = { required: true, created: false, date: appointmentDate.toISOString(), notes: fNotes, error: 'Fecha en el pasado' };
            throw new Error('FOLLOWUP_PAST_DATE');
          }

          // Compute slotId (Helpers available in Medi module scope?)
          // We need to call MediService helper or construct it manually.
          // medi-service.js: slotIdFromDate
          const tipoSeguimiento = operational.role === 'Psicologo' ? 'Psicologo' : operational.role;
          const slotId = `${MediService.slotIdFromDate(appointmentDate)}_${tipoSeguimiento}`;

          // Create User Object for booking
          const studentObj = {
            uid: studentId,
            email: studentEmail,
            displayName: document.querySelector('#medi-inline-consulta .fw-bold.text-dark')?.textContent || studentEmail
          };

          // Call Service
          await MediService.reservarCita(AdminMedi.State.ctx, {
            user: studentObj,
            date: appointmentDate,
            slotId: slotId,
            tipo: tipoSeguimiento,
            motivo: fNotes,
            profesionalId: operational.ownerUid,
            profesionalName: operational.professionalName,
            profesionalProfileId: operational.profileId
          });

          followUpSuccess = true;
          payload.followUp = { required: true, created: true, date: appointmentDate.toISOString(), notes: fNotes };
          showToast('Cita de seguimiento agendada correctamente', 'success');

        } catch (bookingErr) {
          if (bookingErr?.message === 'FOLLOWUP_PAST_DATE') {
            // Keep consultation save flow alive without creating the appointment.
            bookingErr = null;
          } else {
          console.error("Error booking follow-up:", bookingErr);
          showToast('No se pudo agendar el seguimiento: ' + bookingErr.message, 'warning');
          // Start save anyway, but mark failed
          payload.followUp = { required: true, created: false, date: fDate ? `${fDate}T${fTime || '00:00'}` : null, notes: fNotes, error: bookingErr.message };
          }
        }
      } else {
        // Marked checked but missing data
        payload.followUp = { required: true, created: false, notes: fNotes };
        showToast('Falta fecha u hora para el seguimiento. No se agendó.', 'warning');
      }
    }

    try {
      await MediService.saveConsulta(AdminMedi.State.ctx, payload, citaId);

      AdminMedi.State.lastConsultaData = {
        ...payload,
        studentName,
        studentAge: AdminMedi.State.selectedRecordStudent?.fechaNacimiento
          ? MediService.calculateAge(AdminMedi.State.selectedRecordStudent.fechaNacimiento)
          : (AdminMedi.State.selectedRecordStudent?.edad || ''),
        studentAllergies: AdminMedi.State.selectedRecordStudent?.alergias || '',
        doctorName: payload.profesionalName || operational.professionalName,
        doctorSpecialty: payload.profesionalSpecialty || operational.specialty || operational.role,
        doctorEmail: payload.profesionalEmail || operational.professionalEmail || AdminMedi.State.ctx.auth.currentUser.email,
        doctorPhone: payload.profesionalPhone || operational.professionalPhone || '',
        doctorCedulaLabel: payload.profesionalCedulaLabel || operational.cedulaLabel || '',
        cedula: payload.cedula || operational.cedula || ''
      };

      if (isFinal && status === 'finalizada') {
        const confirmModal = bootstrap.Modal.getInstance(document.getElementById('modalConfirmEnd'));
        if (confirmModal) confirmModal.hide();

        // Reset botones por si se reabre
        if (btnFinalizar) {
          btnFinalizar.disabled = false;
          btnFinalizar.innerHTML = '<i class="bi bi-check-lg me-1"></i> Confirmar';
        }
        if (btnCancelarF) btnCancelarF.disabled = false;

        // Cleanup inline consultation
        _cleanupConsultation();

        // [ENCUESTAS] Registrar uso
        // [ENCUESTAS] Registrar uso
        if (window.EncuestasServicioService) {
          await EncuestasServicioService.registerServiceUsage(
            AdminMedi.State.ctx,
            AdminMedi.State.myRole === 'Psicologo' ? 'psicologia' : 'servicio-medico',
            {
              action: 'consulta_finalizada',
              studentId: studentId
            },
            studentId // <--- CRITICAL FIX: Target UID (Student)
          );

          // Trigger Survey Check Immediately
          if (window.Encuestas && window.Encuestas.checkAndShowServiceSurvey) {
            setTimeout(() => {
              const surveyCtx = {
                ...AdminMedi.State.ctx,
                profile: { ...(AdminMedi.State.ctx.profile || {}), uid: studentId },
                user: { ...(AdminMedi.State.ctx.user || {}), uid: studentId }
              };
              window.Encuestas.checkAndShowServiceSurvey(AdminMedi.State.myRole === 'Psicologo' ? 'psicologia' : 'servicio-medico', surveyCtx);
            }, 1500);
          }
        }

        // Close any lingering modal
        const modalConsulta = bootstrap.Modal.getInstance(document.getElementById('modalConsulta'));
        if (modalConsulta) modalConsulta.hide();

        // Show success/print modal
        setTimeout(() => {
          new bootstrap.Modal(document.getElementById('modalSuccessConsulta')).show();
        }, 200);
      }

    } catch (err) {
      console.error(err);
      showToast('Error al guardar consulta: ' + err.message, 'danger');
      if (isFinal) {
        if (btnFinalizar) {
          btnFinalizar.disabled = false;
          btnFinalizar.innerHTML = '<i class="bi bi-check-lg me-1"></i> Confirmar';
        }
        if (btnCancelarF) btnCancelarF.disabled = false;
      }
    } finally {
      AdminMedi.State.isSaving = false; // Unlock
    }
  }

  function confirmarFinalizacion() {
    // Validaciones eliminadas a peticion del usuario (16-Feb-2026)
    // Mostrar modal confirmación directamente
    const modal = new bootstrap.Modal(document.getElementById('modalConfirmEnd'));
    modal.show();
  }

  function cerrarSuccessModal() {
    const m = bootstrap.Modal.getInstance(document.getElementById('modalSuccessConsulta'));
    if (m) m.hide();
    if (AdminMedi && AdminMedi.refreshAdmin) AdminMedi.refreshAdmin(); // Actualizar lista de espera/agenda
  }

  function showConsultationDetails(jsonExp) {
    const exp = JSON.parse(decodeURIComponent(jsonExp));

    // Header y Doctor
    const dateObj = exp.safeDate ? new Date(exp.safeDate) : new Date();
    document.getElementById('detail-date-header').textContent = `${exp.tipoServicio} • ${dateObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })} `;
    document.getElementById('detail-doctor').textContent = exp.profesionalName || exp.autorEmail || 'Profesional de Salud';

    // Signos Vitales — data is stored flat: exp.temp, exp.presion, exp.peso, exp.talla
    document.getElementById('detail-temp').textContent = exp.temp ? `${exp.temp}°C` : '--';
    document.getElementById('detail-presion').textContent = exp.presion || '--';
    document.getElementById('detail-peso').textContent = exp.peso ? `${exp.peso} kg` : '--';

    // Contenido SOAP
    document.getElementById('detail-subjetivo').textContent = exp.subjetivo || 'No registrado';
    document.getElementById('detail-diagnosis').textContent = exp.diagnostico || 'No registrado';
    document.getElementById('detail-plan').textContent = exp.plan || (exp.meds ? exp.meds : 'Seguir indicaciones generales.');

    // Acción del Botón Imprimir
    const btnPrint = document.getElementById('btn-print-receta');
    const newBtn = btnPrint.cloneNode(true);
    btnPrint.parentNode.replaceChild(newBtn, btnPrint);

    newBtn.onclick = () => {
      // Obtenemos perfil del alumno para la receta
      const studentProfile = AdminMedi.State.selectedRecordStudent || {};
      const studentAge = studentProfile.fechaNacimiento ? MediService.calculateAge(studentProfile.fechaNacimiento) : (studentProfile.edad || exp.edad || '');

      // Llamada al generador profesional
      PDFGenerator.generateProfessionalPrescription({
        doctor: {
          name: exp.profesionalName || exp.autorEmail || 'Profesional',
          specialty: exp.profesionalSpecialty || exp.tipoServicio,
          email: exp.profesionalEmail || exp.autorEmail || AdminMedi.State.ctx.auth.currentUser.email,
          phone: exp.profesionalPhone || '',
          cedula: exp.cedula || '',
          cedulaLabel: exp.profesionalCedulaLabel || ''
        },
        student: {
          name: studentProfile.displayName || exp.studentName || exp.studentEmail || 'Paciente',
          matricula: studentProfile.matricula || exp.studentId || '--',
          carrera: studentProfile.carrera || '--',
          age: studentAge || '',
          allergies: studentProfile.alergias || exp.alergias || ''
        },
        consultation: {
          date: dateObj,
          signs: exp.signos,
          diagnosis: exp.diagnostico,
          treatment: exp.plan || exp.meds
        }
      });
    };

    // Z-INDEX FIX: Ensure Details Modal is above Full Record
    // Note: DetailModal is 1055 default context. If full record is open, we need to handle stacking.
    const detailModalEl = document.getElementById('modalDetalleConsulta');
    detailModalEl.style.zIndex = "1061"; // Higher than standard modal (1055) + Full Record (1060?)
    const backdrop = document.querySelector('.modal-backdrop');
    // We can't easily control backdrop z-index globally without affecting others.
    // Bootstrap 5 handles stacked modals but sometimes needs help.


    const dSubjetivo = document.getElementById('detail-subjetivo');
    const dDiagnosis = document.getElementById('detail-diagnosis');
    const dPlan = document.getElementById('detail-plan');
    const dDate = document.getElementById('detail-date-header');

    // Update Vitals (If exist)
    if (exp.signos) {
      document.getElementById('detail-presion').textContent = exp.signos.presion || '--';
      document.getElementById('detail-temp').textContent = exp.signos.temp ? exp.signos.temp + '°C' : '--';
      document.getElementById('detail-peso').textContent = exp.signos.peso ? exp.signos.peso + 'kg' : '--';
    } else {
      // [FIX] Also check flat fields (data saved by saveConsultation is flat)
      document.getElementById('detail-presion').textContent = exp.presion || '--';
      document.getElementById('detail-temp').textContent = exp.temp ? exp.temp + '°C' : '--';
      document.getElementById('detail-peso').textContent = exp.peso ? exp.peso + ' kg' : '--';
    }

    dDate.innerHTML = `<i class="bi bi-calendar-event me-1"></i> ${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    dSubjetivo.textContent = exp.subjetivo || "Sin detalles subjetivos.";
    dDiagnosis.textContent = exp.diagnostico || "Sin diagnóstico registrado.";
    dPlan.textContent = exp.plan || "Sin plan de tratamiento.";

    // SHOW PRIVATE NOTES IF ADMIN/DOCTOR
    let pNotesEl = document.getElementById('detail-private-notes-container');
    if (!pNotesEl) {
      // Inject if missing
      const modalBodyRow = dPlan.closest('.row'); // find parent row
      const div = document.createElement('div');
      div.id = 'detail-private-notes-container';
      div.className = 'col-12 mt-3 d-none';
      div.innerHTML = `
  <div class="p-3 bg-warning-subtle border border-warning rounded-4 dashed-border">
                <h6 class="fw-bold text-dark extra-small mb-1"><i class="bi bi-eye-slash-fill me-1"></i> NOTAS PRIVADAS</h6>
                <p class="mb-0 small text-dark" id="detail-private-notes-text"></p>
            </div>
  `;
      modalBodyRow.appendChild(div);
      pNotesEl = div;
    }

    pNotesEl.classList.add('d-none');
    document.getElementById('detail-private-notes-text').textContent = '';

    _resolvePrivateConsultationNotes(exp).then((privateNotes) => {
      if (privateNotes && (AdminMedi.State.myRole === 'Médico' || AdminMedi.State.myRole === 'Psicologo')) {
        pNotesEl.classList.remove('d-none');
        document.getElementById('detail-private-notes-text').textContent = privateNotes;
      }
    }).catch((error) => {
      console.warn('[AdminMedi] No se pudieron cargar las notas privadas de la consulta:', error);
    });

    if (document.getElementById('detail-doctor')) {
      document.getElementById('detail-doctor').textContent = `${exp.profesionalName || exp.autorEmail || 'Profesional'} (${exp.tipoServicio || 'General'})`;
    }

    new bootstrap.Modal(document.getElementById('modalDetalleConsulta')).show();
  }

  return {
    iniciarConsulta: iniciarConsulta,
    renderInlineConsultationUI: renderInlineConsultationUI,
    _startConsultaTimer: _startConsultaTimer,
    _stopConsultaTimer: _stopConsultaTimer,
    _getConsultaDurationMinutes: _getConsultaDurationMinutes,
    _cleanupConsultation: _cleanupConsultation,
    saveConsultation: saveConsultation,
    confirmarFinalizacion: confirmarFinalizacion,
    cerrarSuccessModal: cerrarSuccessModal,
    applyConsultaTemplate: applyConsultaTemplate,
    showConsultationDetails: showConsultationDetails,
  };
})();
