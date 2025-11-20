// modules/medi.js
// Sistema Profesional de Gestión Médica (v4.0 - Consolidado)

const Medi = (function () {
  // --- CONSTANTES & CONFIG ---
  const SLOT_START = 8, SLOT_END = 20, SLOT_STEP = 30;
  const SLOTS_COLL = 'medi-slots';
  const C_CITAS    = 'citas-medi';
  const C_EXP      = 'expedientes-clinicos';
  // const RECOS_COLL = 'medi-recomendaciones'; // Futuro uso
  
  let _ctx = null;
  let _myUid = null;
  let _myRole = null;
  let _unsubs = [];

  // --- HELPERS (CRÍTICOS PARA QUE NO FALLE toISO) ---
  const pad = n => String(n).padStart(2,'0');
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const isWeekday = d => { const x = d.getDay(); return x>=1 && x<=5; };
  
  const slotIdFromDate = d => 
    `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}:${pad(d.getMinutes())}`;
  
  const ts = d => firebase.firestore.Timestamp.fromDate(d);

  function buildSlotsForDate(d){
    const out=[]; 
    for(let h=SLOT_START; h<=SLOT_END; h++){
      for(let m=0; m<60; m+=SLOT_STEP){ 
        if(h===SLOT_END && m>0) continue; 
        out.push(new Date(d.getFullYear(),d.getMonth(),d.getDate(),h,m,0,0)); 
      }
    }
    return out;
  }

  // ==========================================================
  //                 ZONA ESTUDIANTE (FASE 2)
  // ==========================================================

  function initStudent(ctx){
    _ctx = ctx;
    const user = _ctx.auth.currentUser;

    // 1. Cargar Tarjeta de Emergencia
    loadEmergencyCard(user);
    // 2. Configurar Formulario
    setupAppointmentForm();
    // 3. Historial
    loadStudentHistory(user.uid);
    // 4. Feed
    loadWellnessFeed();
  }

  function loadEmergencyCard(user) {
      const p = _ctx.currentUserProfile || {};
      
      // Render Vista
      const elSangre = document.getElementById('view-sangre');
      if(elSangre) elSangre.textContent = p.tipoSangre || '--';
      
      const elAlergias = document.getElementById('view-alergias');
      if(elAlergias) elAlergias.textContent = p.alergias || 'Ninguna';
      
      const elContNom = document.getElementById('view-contacto-nombre');
      if(elContNom) elContNom.textContent = p.contactoEmergenciaName || '--';
      
      const elContTel = document.getElementById('view-contacto-tel');
      if(elContTel) elContTel.textContent = p.contactoEmergenciaTel || '--';

      // Render Form
      const inpSangre = document.getElementById('edit-sangre');
      if(inpSangre) inpSangre.value = p.tipoSangre || '';
      
      const inpAlergias = document.getElementById('edit-alergias');
      if(inpAlergias) inpAlergias.value = p.alergias || '';

      const inpContNom = document.getElementById('edit-contacto-nombre');
      if(inpContNom) inpContNom.value = p.contactoEmergenciaName || '';

      const inpContTel = document.getElementById('edit-contacto-tel');
      if(inpContTel) inpContTel.value = p.contactoEmergenciaTel || '';

      // Handler
      const form = document.getElementById('medi-card-form');
      if(form) {
          const newForm = form.cloneNode(true); 
          form.parentNode.replaceChild(newForm, form);
          
          newForm.addEventListener('submit', async (e) => {
              e.preventDefault();
              const data = {
                  tipoSangre: document.getElementById('edit-sangre').value,
                  alergias: document.getElementById('edit-alergias').value,
                  contactoEmergenciaName: document.getElementById('edit-contacto-nombre').value,
                  contactoEmergenciaTel: document.getElementById('edit-contacto-tel').value
              };
              
              try {
                  await _ctx.db.collection('usuarios').doc(user.uid).update(data);
                  Object.assign(_ctx.currentUserProfile, data);
                  loadEmergencyCard(user); 
                  cancelarEdicionTarjeta();
                  showToast('Tarjeta actualizada', 'success');
              } catch(e) {
                  console.error(e);
                  showToast('Error al guardar', 'danger');
              }
          });
      }
  }

  function setupAppointmentForm() {
    const fFecha = document.getElementById('medi-cita-fecha');
    const fHoraInput = document.getElementById('medi-cita-hora'); // Input oculto
    const fGrid = document.getElementById('medi-time-grid');      // Grid de botones
    const fMsg = document.getElementById('medi-time-msg');        // Mensaje estado
    const fCat = document.getElementById('medi-cita-categoria');
    const fTipo = document.getElementById('medi-cita-tipo');
    const fMotivo = document.getElementById('medi-cita-motivo');
    const fDisp = document.getElementById('medi-cita-disponibilidad');
    const form = document.getElementById('form-medi-nueva-cita');

    if (!form) return;

    // Categoría -> Tipo
    fCat?.addEventListener('change', () => {
        fTipo.value = (fCat.value === 'Salud Mental') ? 'Psicologico' : 'Medico';
    });

    // Configurar Fechas
    fFecha.min = toISO(new Date());
    
    fFecha.addEventListener('change', async () => {
      // Reset UI
      fDisp.textContent = 'Verificando...';
      fDisp.className = 'badge bg-warning-subtle text-warning border';
      fGrid.innerHTML = '';
      fGrid.classList.add('d-none');
      fMsg.classList.remove('d-none');
      fMsg.innerHTML = '<div class="spinner-border spinner-border-sm text-primary"></div> Cargando horarios...';
      fHoraInput.value = '';

      const parts = fFecha.value.split('-');
      const sel = new Date(parts[0], parts[1]-1, parts[2]); 
      
      if(!isWeekday(sel)){ 
          fMsg.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle me-1"></i>Solo atendemos de Lunes a Viernes.</span>';
          fDisp.textContent = 'Cerrado';
          fDisp.className = 'badge bg-secondary text-white';
          return; 
      }

      // Generar slots
      const slots = buildSlotsForDate(sel);
      
      // Consultar ocupados en lote (Optimización)
      // En un sistema real, haríamos una sola query por rango de fecha.
      // Aquí, para mantener simpleza sin cambiar backend masivo, verificamos uno a uno en paralelo o asumimos libres y validamos al click.
      // MEJORA: Validar visualmente cuáles están llenos.
      
      // Generamos botones visuales
      fMsg.classList.add('d-none');
      fGrid.classList.remove('d-none');
      fDisp.textContent = 'Selecciona hora';
      fDisp.className = 'badge bg-info-subtle text-info border';

      // Renderizar botones
      for (const d of slots) {
          const h = pad(d.getHours());
          const m = pad(d.getMinutes());
          const timeLabel = `${h}:${m}`;
          const slotId = slotIdFromDate(d);
          
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn-time-slot slot-enter';
          btn.textContent = timeLabel;
          btn.dataset.time = timeLabel;
          
          // Verificar disponibilidad (async per button para efecto cascada visual)
          // Nota: Esto genera muchas lecturas. En producción, leer colección 'medi-slots' por día.
          // Para este demo, lo hacemos lazy o al click. Vamos a hacerlo al click para ahorrar lecturas,
          // PERO marcaremos visualmente si ya sabemos que está lleno en cache local.
          
          btn.onclick = () => selectTimeSlot(btn, timeLabel);
          
          fGrid.appendChild(btn);
      }
    });

    function selectTimeSlot(btn, time) {
        // Quitar selección previa
        fGrid.querySelectorAll('.btn-time-slot').forEach(b => b.classList.remove('selected'));
        
        btn.classList.add('selected');
        fHoraInput.value = time;
        fDisp.textContent = `Horario: ${time}`;
        fDisp.className = 'badge bg-primary text-white shadow-sm';
    }

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const user = _ctx.auth.currentUser;
      
      if(!fFecha.value || !fHoraInput.value){ 
          showToast('Por favor selecciona una fecha y un horario.','warning'); 
          return; 
      }

      const [h,m] = fHoraInput.value.split(':').map(Number);
      const parts = fFecha.value.split('-');
      const sd = new Date(parts[0], parts[1]-1, parts[2], h, m, 0, 0);
      const sId = slotIdFromDate(sd);

      // --- FIX DEL ERROR "toDate" ---
      const dayStart = new Date(parts[0], parts[1]-1, parts[2]); 
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate()+1);
      
      const q1 = await _ctx.db.collection(C_CITAS)
        .where('studentId','==',user.uid)
        .where('estado','in',['pendiente','confirmada']).get();
        
      const existing = q1.docs.find(d => {
          const data = d.data();
          // VALIDACIÓN SEGURA: Si no hay fecha, ignoramos ese registro corrupto
          if (!data.fechaHoraSlot) return false; 
          
          // Si es timestamp de firestore, tiene toDate()
          const t = data.fechaHoraSlot.toDate ? data.fechaHoraSlot.toDate() : new Date(data.fechaHoraSlot);
          return t >= dayStart && t < dayEnd;
      });

      if(existing){ 
          showToast('Ya tienes una cita programada para este día.','warning'); 
          return; 
      }
      // ------------------------------

      try{
        await _ctx.db.runTransaction(async tx=>{
          const slotRef = _ctx.db.collection(SLOTS_COLL).doc(sId);
          const snap = await tx.get(slotRef);
          if(snap.exists) throw new Error('Lo sentimos, este horario acaba de ser ocupado.');

          tx.set(slotRef, { holder:user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          const ref = _ctx.db.collection(C_CITAS).doc();
          const motivoFinal = fCat ? `[${fCat.value}] ${fMotivo.value}` : fMotivo.value;

          tx.set(ref, {
            studentId: user.uid, studentEmail: user.email,
            fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
            fechaHoraSlot: ts(sd), slotId: sId,
            tipoServicio: fTipo.value, 
            motivo: motivoFinal,
            estado:'pendiente', profesionalId:null, profesionalEmail:null
          });
        });
        showToast('¡Cita reservada con éxito!','success');
        
        if(window.Notify) {
           window.Notify.send(user.uid, {
             title: 'Cita Agendada',
             message: `Tu cita para el ${fFecha.value} a las ${fHoraInput.value} ha sido registrada.`,
             type: 'medi', link: '/medi'
           });
        }
        
        // Reset UI
        form.reset(); 
        fGrid.innerHTML = ''; 
        fGrid.classList.add('d-none');
        fMsg.classList.remove('d-none');
        fDisp.textContent = '';
        
      }catch(err){ showToast(err.message||'Error al reservar','danger'); }
    });
  }
  function loadStudentHistory(uid) {
    // Citas
    const contCitas = document.getElementById('medi-stu-citas');
    if(contCitas) {
        _ctx.db.collection(C_CITAS)
          .where('studentId','==', uid)
          .orderBy('fechaHoraSlot','desc').limit(10)
          .onSnapshot(snap=>{
            if(snap.empty){ contCitas.innerHTML='<div class="text-center p-4 text-muted small">Sin citas recientes.</div>'; return; }
            
            let html = `<div class="list-group list-group-flush">`;
            snap.forEach(d=>{
              const c=d.data();
              const f = c.fechaHoraSlot?.toDate();
              const fechaStr = f ? f.toLocaleDateString('es-MX',{day:'numeric',month:'short'}) : '-';
              const horaStr = f ? f.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '';
              
              let badgeClass = 'bg-secondary';
              if(c.estado==='confirmada') badgeClass='bg-success';
              if(c.estado==='pendiente') badgeClass='bg-warning text-dark';
              if(c.estado==='cancelada') badgeClass='bg-danger';

              html += `
                <div class="list-group-item">
                   <div class="d-flex justify-content-between align-items-center">
                      <div>
                         <div class="fw-bold text-dark">${c.tipoServicio}</div>
                         <div class="small text-muted">${fechaStr} - ${horaStr}</div>
                      </div>
                      <span class="badge ${badgeClass} rounded-pill">${c.estado}</span>
                   </div>
                </div>`;
            });
            html+='</div>'; contCitas.innerHTML=html;
          });
    }

    // Expediente
    const contCons = document.getElementById('medi-stu-consultas');
    if(contCons) {
        _ctx.db.collection(C_EXP)
          .where('studentId','==', uid)
          .where('visiblePaciente', '==', true)
          .orderBy('createdAt','desc').limit(10)
          .onSnapshot(snap=>{
            if(snap.empty){ contCons.innerHTML='<div class="text-center p-4 text-muted small">Sin expediente visible.</div>'; return; }
            
            let html = `<div class="d-flex flex-column gap-3">`;
            snap.forEach(d=>{
              const c=d.data(); 
              const fechaStr = c.createdAt?.toDate().toLocaleDateString() || '-';
              html += `
                <div class="border rounded-3 p-3 bg-white shadow-sm">
                   <div class="d-flex justify-content-between mb-2">
                      <span class="badge bg-primary-subtle text-primary border border-primary-subtle">${c.tipoServicio}</span>
                      <small class="text-muted">${fechaStr}</small>
                   </div>
                   <div class="small fw-bold text-dark mb-1">Diagnóstico:</div>
                   <div class="text-muted small mb-2 fst-italic">${c.diagnostico || 'Reservado'}</div>
                   ${c.plan ? `
                   <div class="p-2 bg-light rounded border-start border-4 border-success mt-2">
                      <div class="extra-small fw-bold text-uppercase text-success">Indicaciones</div>
                      <div class="small" style="white-space: pre-wrap;">${c.plan}</div>
                   </div>` : ''}
                </div>`;
            });
            html += '</div>'; contCons.innerHTML = html;
          }, err => console.log("Expediente student vacio o error", err));
    }
  }

  function loadWellnessFeed() {
      const rec = document.getElementById('medi-recos');
      if(!rec) return;
      const tips = [
          {img: 'https://images.unsplash.com/photo-1544367563-12123d8959bd?w=400', title: 'Salud Mental', text: 'Toma descansos de 5 minutos por cada hora de estudio.'},
          {img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400', title: 'Nutrición', text: 'Evita el exceso de cafeína antes de exámenes.'},
          {img: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400', title: 'Actívate', text: 'El gimnasio del campus está abierto de 7am a 8pm.'}
      ];
      rec.innerHTML = tips.map(t => `
         <div class="col-md-4">
            <div class="card h-100 border-0 shadow-sm overflow-hidden">
               <div style="height:120px; background:url(${t.img}) center/cover;"></div>
               <div class="card-body p-3">
                  <h6 class="fw-bold text-primary mb-1">${t.title}</h6>
                  <p class="small text-muted mb-0" style="line-height:1.3">${t.text}</p>
               </div>
            </div>
         </div>
      `).join('');
  }


  // ==========================================================
  //                 ZONA ADMINISTRATIVA (FASE 3 + 3.5)
  // ==========================================================

  async function initAdmin(ctx) {
    _ctx = ctx;
    _myUid = ctx.auth.currentUser.uid;
    
    const perfil = ctx.currentUserProfile;
    _myRole = (perfil && perfil.especialidad === 'Psicologo') ? 'Psicologo' : 'Medico';

    const elName = document.getElementById('medi-pro-name');
    const elEsp = document.getElementById('medi-pro-esp');
    if(elName) elName.textContent = perfil.displayName || 'Profesional';
    if(elEsp) {
        elEsp.textContent = _myRole;
        elEsp.className = _myRole === 'Psicologo' ? 'badge bg-purple text-white' : 'badge bg-info text-dark';
    }

    loadWall();      
    loadMyAgenda();  
    
    const searchInput = document.getElementById('medi-search-paciente');
    if(searchInput){
        const newSearch = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearch, searchInput);
        newSearch.addEventListener('keyup', (e) => {
            if(e.key === 'Enter') buscarPaciente(e.target.value);
        });
    }

    const formSoap = document.getElementById('form-soap');
    if(formSoap){
        const newForm = formSoap.cloneNode(true);
        formSoap.parentNode.replaceChild(newForm, formSoap);
        newForm.addEventListener('submit', saveConsultation);
    }
  }

  function loadWall() {
    const list = document.getElementById('medi-muro-list');
    const badge = document.getElementById('badge-sala-espera');
    if(!list) return;
    
    const q = _ctx.db.collection(C_CITAS)
      .where('estado', '==', 'pendiente')
      .where('tipoServicio', '==', _myRole) 
      .orderBy('fechaHoraSlot', 'asc');

    const unsub = q.onSnapshot(snap => {
      if(badge) badge.textContent = snap.size;
      if (snap.empty) {
        list.innerHTML = '<div class="text-center py-4 text-muted">Sala de espera vacía.</div>';
        return;
      }

      list.innerHTML = snap.docs.map(d => {
        const c = d.data();
        const fechaObj = c.fechaHoraSlot ? c.fechaHoraSlot.toDate() : new Date();
        const fechaStr = fechaObj.toLocaleDateString('es-MX', {weekday:'short', day:'numeric', month:'numeric'});
        const horaStr = fechaObj.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        
        return `
          <div class="list-group-item d-flex justify-content-between align-items-center p-3">
            <div class="d-flex align-items-center gap-3">
              <div class="bg-light rounded-circle p-2 text-primary"><i class="bi bi-person-fill"></i></div>
              <div>
                <div class="fw-bold text-dark">${c.studentEmail}</div>
                <div class="small text-muted">Motivo: ${c.motivo || '-'}</div>
                <span class="badge bg-warning-subtle text-warning border border-warning-subtle mt-1">
                   <i class="bi bi-calendar3"></i> ${fechaStr} ${horaStr}
                </span>
              </div>
            </div>
            <button class="btn btn-primary btn-sm rounded-pill px-3 shadow-sm" 
                    onclick="Medi.tomarPaciente('${d.id}')">
               Tomar Paciente
            </button>
          </div>
        `;
      }).join('');
    });
    _unsubs.push(unsub);
  }

  function loadMyAgenda() {
    const list = document.getElementById('medi-agenda-list');
    if(!list) return;
    
    const q = _ctx.db.collection(C_CITAS)
      .where('profesionalId', '==', _myUid)
      .where('estado', '==', 'confirmada')
      .orderBy('fechaHoraSlot', 'asc');

    const unsub = q.onSnapshot(snap => {
      if (snap.empty) {
        list.innerHTML = '<div class="p-4 text-muted text-center">No tienes citas activas.</div>';
        return;
      }

      let html = `<table class="table table-hover align-middle mb-0">
        <thead class="table-light"><tr><th>Hora</th><th>Paciente</th><th>Acción</th></tr></thead><tbody>`;
      
      snap.forEach(d => {
        const c = d.data();
        const fechaObj = c.fechaHoraSlot ? c.fechaHoraSlot.toDate() : new Date();
        const fechaStr = fechaObj.toLocaleDateString('es-MX', {weekday:'short', day:'numeric', month:'numeric'});
        const horaStr = fechaObj.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        
        const safeStudent = encodeURIComponent(JSON.stringify({ uid: c.studentId, email: c.studentEmail }));

        html += `<tr>
          <td class="fw-bold">
            <div class="small text-muted" style="font-size:0.75rem">${fechaStr}</div>
            <div class="fs-6">${horaStr}</div>
          </td>
          <td>
             <div class="fw-semibold">${c.studentEmail}</div>
             <small class="text-muted">${c.tipoServicio}</small>
          </td>
          <td>
             <div class="btn-group">
               <button class="btn btn-success btn-sm rounded-start-pill px-3"
                       onclick="Medi.iniciarConsulta('${d.id}', '${safeStudent}')">
                 Atender
               </button>
               <button class="btn btn-outline-danger btn-sm rounded-end-pill px-2"
                       onclick="Medi.cancelarCitaAdmin('${d.id}')" title="Cancelar">
                 <i class="bi bi-x-lg"></i>
               </button>
             </div>
          </td>
        </tr>`;
      });
      html += '</tbody></table>';
      list.innerHTML = html;
    });
    _unsubs.push(unsub);
  }

  // --- ACCIONES ---

  async function tomarPaciente(citaId) {
    try {
      const ref = _ctx.db.collection(C_CITAS).doc(citaId);
      const snap = await ref.get();
      if(!snap.exists) throw new Error("Cita no encontrada");
      const cita = snap.data();

      // Validar conflicto horario
      const conflict = await _ctx.db.collection(C_CITAS)
        .where('profesionalId', '==', _myUid)
        .where('estado', '==', 'confirmada')
        .where('fechaHoraSlot', '==', cita.fechaHoraSlot)
        .get();

      if(!conflict.empty) {
        showToast('Ya tienes cita a esa hora.', 'warning');
        return;
      }

      await ref.update({
        estado: 'confirmada',
        profesionalId: _myUid,
        profesionalEmail: _ctx.auth.currentUser.email
      });
      showToast('Paciente asignado', 'success');
      
      if (window.Notify && cita.studentId) {
          window.Notify.send(cita.studentId, {
              title: 'Cita Asignada',
              message: `Tu cita ha sido tomada por el profesional.`,
              type: 'medi', link: '/medi'
          });
      }
    } catch (e) { console.error(e); showToast('Error al tomar', 'danger'); }
  }

  // Cancelación inteligente (>24h muro, <24h cancelada)
  async function cancelarCitaAdmin(citaId) {
    if(!confirm('¿Cancelar cita?')) return;
    try {
      const ref = _ctx.db.collection(C_CITAS).doc(citaId);
      const snap = await ref.get();
      if(!snap.exists) return;
      const data = snap.data();
      
      const now = new Date();
      const slotDate = data.fechaHoraSlot ? data.fechaHoraSlot.toDate() : now;
      const diffHours = (slotDate - now) / (1000 * 60 * 60);
      
      let updateData = {};
      let msg = '';

      if (diffHours > 24) {
        updateData = { estado: 'pendiente', profesionalId: null, profesionalEmail: null };
        msg = 'Tu cita ha regresado a la sala de espera.';
        showToast('Devuelta al muro (>24h)', 'info');
      } else {
        updateData = { estado: 'cancelada', motivoCancelacion: 'Cancelada por médico' };
        msg = 'Cita cancelada por el profesional.';
        showToast('Cancelada definitivamente (<24h)', 'warning');
      }
      
      await ref.update(updateData);
      if(window.Notify && data.studentId) {
         window.Notify.send(data.studentId, { title: 'Actualización Cita', message: msg, type: 'medi', link: '/medi' });
      }
    } catch(e) { console.error(e); showToast('Error', 'danger'); }
  }

  function iniciarConsulta(citaId, jsonStudent) {
    const student = JSON.parse(decodeURIComponent(jsonStudent));
    document.getElementById('form-soap').reset();
    document.getElementById('soap-cita-id').value = citaId || '';
    document.getElementById('soap-student-id').value = student.uid;
    document.getElementById('soap-student-email').value = student.email;
    document.getElementById('soap-patient-info').textContent = student.email;
    
    loadHistory(student.uid);
    new bootstrap.Modal(document.getElementById('modalConsultaSOAP')).show();
  }

  // Carga Historial con Mix de Permisos
  async function loadHistory(uid) {
    const list = document.getElementById('soap-history-list');
    list.innerHTML = '<div class="text-center py-3"><span class="spinner-border spinner-border-sm"></span></div>';

    try {
      let queries = [];
      // 1. Médico General (visible para todos roles salud)
      queries.push(
          _ctx.db.collection(C_EXP)
          .where('studentId', '==', uid)
          .where('tipoServicio', '==', 'Medico')
          .get()
      );

      // 2. Psicológico (solo si soy psicólogo y son MÍAS)
      if (_myRole === 'Psicologo') {
          queries.push(
              _ctx.db.collection(C_EXP)
              .where('studentId', '==', uid)
              .where('tipoServicio', '==', 'Psicologico')
              .where('autorId', '==', _myUid)
              .get()
          );
      }

      const snapshots = await Promise.all(queries);
      let docs = [];
      snapshots.forEach(s => s.docs.forEach(d => docs.push(d.data())));

      // Ordenar cliente
      docs.sort((a, b) => {
          const da = a.createdAt ? a.createdAt.toDate() : new Date(0);
          const db = b.createdAt ? b.createdAt.toDate() : new Date(0);
          return db - da;
      });

      if(docs.length === 0) {
         list.innerHTML = '<div class="text-muted small text-center mt-4">Sin historial visible.</div>';
         return;
      }

      list.innerHTML = docs.map(exp => {
         const fecha = exp.createdAt ? exp.createdAt.toDate().toLocaleDateString() : '-';
         const isPsico = exp.tipoServicio === 'Psicologico';
         const borderClass = isPsico ? 'border-start border-4 border-purple' : 'border-start border-4 border-info';
         const safeNotas = (exp.notas || '').replace(/'/g, "\\'").replace(/\n/g, " ");

         return `
           <div class="card mb-2 shadow-sm ${borderClass}">
             <div class="card-body p-2">
               <div class="d-flex justify-content-between small mb-1">
                 <span class="fw-bold">${fecha}</span>
                 <span class="badge bg-light text-dark border">${exp.tipoServicio}</span>
               </div>
               <div class="small text-muted fst-italic mb-1 text-truncate">
                 ${exp.diagnostico || 'Sin diagnóstico'}
               </div>
               <button class="btn btn-link btn-sm p-0 text-decoration-none" 
                       style="font-size: 0.75rem;"
                       onclick="alert('${safeNotas}')">Ver notas</button>
             </div>
           </div>`;
      }).join('');

    } catch(e) {
      console.error("Error historial:", e);
      list.innerHTML = '<div class="alert alert-warning small p-2">Error permisos.</div>';
    }
  }

  async function saveConsultation(e) {
    e.preventDefault();
    if(document.activeElement) document.activeElement.blur();

    const studentId = document.getElementById('soap-student-id').value;
    const studentEmail = document.getElementById('soap-student-email').value;
    const citaId = document.getElementById('soap-cita-id').value;
    
    const payload = {
       studentId, studentEmail,
       autorId: _myUid,
       autorEmail: _ctx.auth.currentUser.email,
       tipoServicio: _myRole,
       createdAt: firebase.firestore.FieldValue.serverTimestamp(),
       subjetivo: document.getElementById('soap-s').value,
       signos: {
          temp: document.getElementById('soap-temp').value,
          presion: document.getElementById('soap-presion').value,
          peso: document.getElementById('soap-peso').value,
          talla: document.getElementById('soap-talla').value
       },
       diagnostico: document.getElementById('soap-a').value,
       plan: document.getElementById('soap-p').value,
       visiblePaciente: document.getElementById('soap-visible').checked
    };

    try {
       await _ctx.db.collection(C_EXP).add(payload);
       if(citaId) {
          await _ctx.db.collection(C_CITAS).doc(citaId).update({ estado: 'finalizada' });
       }
       showToast('Consulta guardada', 'success');
       const m = bootstrap.Modal.getInstance(document.getElementById('modalConsultaSOAP'));
       if(m) m.hide();
    } catch(e) { console.error(e); showToast('Error', 'danger'); }
  }
  
  async function buscarPaciente(term) {
      const container = document.getElementById('medi-pacientes-results');
      container.innerHTML = '<div class="text-center"><span class="spinner-border spinner-border-sm"></span></div>';
      const snap = await _ctx.db.collection('usuarios').where('email', '==', term.trim()).get();
      if(snap.empty) { container.innerHTML = '<div class="alert alert-info mt-2">No encontrado.</div>'; return; }
      
      const u = snap.docs[0].data();
      const uid = snap.docs[0].id;
      const safeObj = encodeURIComponent(JSON.stringify({uid, email: u.email}));
      
      container.innerHTML = `
         <div class="card mt-3 border-success shadow-sm">
            <div class="card-body d-flex justify-content-between align-items-center p-3">
               <div>
                  <h6 class="mb-0 fw-bold">${u.displayName || 'Estudiante'}</h6>
                  <small class="text-muted">${u.email}</small>
               </div>
               <button class="btn btn-primary btn-sm rounded-pill" onclick="Medi.iniciarConsulta(null, '${safeObj}')">
                  <i class="bi bi-clipboard-pulse"></i> Nueva Consulta
               </button>
            </div>
         </div>`;
  }
  
  function nuevaConsultaWalkIn() {
      const tabBtn = document.getElementById('tab-pacientes-btn');
      if(tabBtn) new bootstrap.Tab(tabBtn).show();
      setTimeout(() => document.getElementById('medi-search-paciente').focus(), 100);
  }

  // --- HELPERS UI EXPORTADOS ---
  function editarTarjeta() {
      document.getElementById('medi-card-view').classList.add('d-none');
      document.getElementById('medi-card-form').classList.remove('d-none');
  }
  function cancelarEdicionTarjeta() {
      document.getElementById('medi-card-form').reset();
      document.getElementById('medi-card-view').classList.remove('d-none');
      document.getElementById('medi-card-form').classList.add('d-none');
  }
  function toggleSOS() {
      new bootstrap.Modal(document.getElementById('modalSOS')).show();
  }
  function refreshAdmin() { loadWall(); loadMyAgenda(); }

  return {
    initStudent, initAdmin,
    tomarPaciente, iniciarConsulta, saveConsultation,
    refreshAdmin, nuevaConsultaWalkIn, cancelarCitaAdmin,
    editarTarjeta, cancelarEdicionTarjeta, toggleSOS,
    initSuperAdmin: (ctx) => {}
  };

})();