// modules/profile.js
// Gestión de Perfil v3.0 (Redesign: Cover, Tabs, Mobile Nav Compatible)

const Profile = (function () {
  let _ctx = null;
  let _isEditing = false;

  function init(ctx) {
    _ctx = ctx;
    const container = document.getElementById('view-profile');
    if (container) {
      renderStructure(container);
      render();
      setupListeners();
    }
  }

  function renderStructure(container) {
    // Cover Image & Floating Avatar Layout
    container.innerHTML = `
    <div class="container-fluid px-0 animate-fade-in">
      <!-- Portada -->
      <div class="profile-cover-image d-flex align-items-end justify-content-end p-3 shadow-sm bg-gradient" style="height: 180px; background: linear-gradient(135deg, #1b396a 0%, #0d6efd 100%);">
          <button class="btn btn-light btn-sm rounded-circle shadow-sm opacity-75" onclick="document.getElementById('prof-pic-input').click()" title="Cambiar Portada (Demo)">
            <i class="bi bi-camera-fill"></i>
          </button>
      </div>

      <div class="container" style="margin-top: -60px;">
        <div class="row">
          <!-- Columna Izquierda: Identidad -->
          <div class="col-lg-3 text-center mb-4">
            <div class="position-relative d-inline-block mb-3">
               <div class="rounded-circle border border-4 border-white shadow bg-white d-flex align-items-center justify-content-center overflow-hidden position-relative" style="width: 130px; height: 130px;">
                  <span id="prof-avatar-initials" class="fs-1 fw-bold text-primary">U</span>
                  <img id="prof-avatar-img" src="" class="w-100 h-100 object-fit-cover d-none">
               </div>
               <button class="btn btn-dark btn-sm rounded-circle position-absolute bottom-0 end-0 border border-2 border-white shadow-sm" onclick="document.getElementById('prof-pic-input').click()" style="width: 32px; height: 32px;">
                  <i class="bi bi-pencil-fill xs-icon"></i>
               </button>
               <input type="file" id="prof-pic-input" accept="image/*" class="d-none">
            </div>
            
            <h4 class="fw-bold mb-0 text-dark" id="prof-name">Cargando...</h4>
            <div class="badge bg-primary text-white mb-2 shadow-sm" id="prof-role">ESTUDIANTE</div>
            <div class="text-muted small font-monospace mb-2" id="prof-matricula-display"></div>

            <!-- Boton QR (Solo Estudiantes) -->
            <button id="btn-prof-view-qr" class="btn btn-outline-primary rounded-pill w-100 mt-2 d-none shadow-sm fw-bold" onclick="Profile.openDigitalID()">
               <i class="bi bi-qr-code me-2"></i>Ver Credencial
            </button>
            
            <!-- Boton Cerrar Sesion -->
            <button class="btn btn-link text-danger text-decoration-none w-100 mt-2 rounded-pill small fw-bold" onclick="window.logout()">
               <i class="bi bi-box-arrow-right me-1"></i> Cerrar Sesión
            </button>
          </div>

          <!-- Columna Derecha: Paneles de Información -->
          <div class="col-lg-9 mt-lg-4">
             
             <!-- Navegación de Pestañas -->
             <ul class="nav nav-pills mb-3 gap-2 justify-content-center justify-content-lg-start" id="profile-tabs" role="tablist">
                <li class="nav-item" role="presentation">
                  <button class="nav-link active rounded-pill small fw-bold px-3" id="tab-general-btn" data-bs-toggle="pill" data-bs-target="#tab-general" type="button">General</button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link rounded-pill small fw-bold px-3" id="tab-medical-btn" data-bs-toggle="pill" data-bs-target="#tab-medical" type="button">Salud y Contacto</button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link rounded-pill small fw-bold px-3" id="tab-record-btn" data-bs-toggle="pill" data-bs-target="#tab-record" type="button">Expediente</button>
                </li>
             </ul>

             <div class="card border-0 shadow-sm rounded-4 bg-white mb-5">
               <div class="card-body p-4 tab-content">
                  
                  <!-- PANEL GENERAL -->
                  <div class="tab-pane fade show active" id="tab-general" role="tabpanel">
                      <div class="d-flex justify-content-between align-items-center mb-4">
                         <h6 class="fw-bold m-0 text-primary"><i class="bi bi-person-lines-fill me-2"></i>Información Personal</h6>
                         <button class="btn btn-sm btn-light text-primary fw-bold rounded-pill toggle-edit-btn shadow-sm" onclick="Profile.toggleEditMode()">
                            <i class="bi bi-pencil-square me-1"></i> Editar
                         </button>
                      </div>
                      
                      <form id="form-general" class="row g-3">
                         <div class="col-md-6">
                            <label class="form-label small text-muted fw-bold">Nombre Completo</label>
                            <input type="text" class="form-control bg-light border-0" id="prof-fullname" disabled>
                         </div>
                         <div class="col-md-6">
                            <label class="form-label small text-muted fw-bold">Correo Institucional</label>
                            <input type="email" class="form-control bg-light border-0" id="prof-email" disabled>
                         </div>
                         <div class="col-md-6">
                            <label class="form-label small text-muted fw-bold">Teléfono Personal</label>
                            <input type="tel" class="form-control bg-light border-0" id="prof-phone" disabled>
                         </div>
                         <div class="col-md-6">
                            <label class="form-label small text-muted fw-bold">Domicilio</label>
                            <input type="text" class="form-control bg-light border-0" id="prof-address" disabled>
                         </div>
                         <div class="col-md-4">
                            <label class="form-label small text-muted fw-bold">Género</label>
                            <input type="text" class="form-control bg-light border-0" id="prof-gender" disabled>
                         </div>
                         <div class="col-md-4">
                             <label class="form-label small text-muted fw-bold">Estado Civil</label>
                             <select class="form-select bg-light border-0" id="prof-civil" disabled>
                                <option value="Soltero/a">Soltero/a</option>
                                <option value="Casado/a">Casado/a</option>
                                <option value="Unión Libre">Unión Libre</option>
                             </select>
                         </div>
                         <div class="col-md-4">
                            <label class="form-label small text-muted fw-bold">Carrera</label>
                            <input type="text" class="form-control bg-light border-0" id="prof-program" disabled>
                         </div>
                      </form>
                  </div>

                  <!-- PANEL SALUD (Contacto Emergencia + Sangre) -->
                  <div class="tab-pane fade" id="tab-medical" role="tabpanel">
                      <div class="d-flex justify-content-between align-items-center mb-4">
                         <h6 class="fw-bold m-0 text-danger"><i class="bi bi-heart-pulse-fill me-2"></i>Salud y Emergencia</h6>
                         <button class="btn btn-sm btn-light text-primary fw-bold rounded-pill toggle-edit-btn shadow-sm" onclick="Profile.toggleEditMode()">
                            <i class="bi bi-pencil-square me-1"></i> Editar
                         </button>
                      </div>

                      <form id="form-medical" class="row g-3">
                         <div class="col-md-6">
                            <label class="form-label small text-muted fw-bold">Tipo de Sangre</label>
                            <select class="form-select bg-light border-0" id="prof-blood" disabled>
                               <option value="">Desconocido</option>
                               <option value="O+">O+</option> <option value="O-">O-</option>
                               <option value="A+">A+</option> <option value="A-">A-</option>
                               <option value="B+">B+</option> <option value="B-">B-</option>
                               <option value="AB+">AB+</option> <option value="AB-">AB-</option>
                            </select>
                         </div>
                         <div class="col-md-6">
                             <label class="form-label small text-muted fw-bold">Alergias</label>
                             <input type="text" class="form-control bg-light border-0" id="prof-allergies" disabled>
                         </div>
                         <div class="col-12"><hr class="my-1 border-light"></div>
                         <div class="col-12">
                            <span class="badge bg-danger-subtle text-danger mb-2">Contacto de Emergencia</span>
                         </div>
                         <div class="col-md-6">
                            <label class="form-label small text-muted fw-bold">Nombre Contacto</label>
                            <input type="text" class="form-control bg-light border-0" id="prof-emergency-name" disabled>
                         </div>
                         <div class="col-md-6">
                            <label class="form-label small text-muted fw-bold">Teléfono Contacto</label>
                            <input type="tel" class="form-control bg-light border-0" id="prof-emergency-tel" disabled>
                         </div>
                      </form>
                  </div>

                  <!-- PANEL EXPEDIENTE (Respuestas Registro) -->
                  <div class="tab-pane fade" id="tab-record" role="tabpanel">
                      <div class="alert alert-light border-0 d-flex align-items-center small text-muted shadow-sm mb-4">
                         <i class="bi bi-info-circle-fill me-2 fs-5 text-info"></i>
                         Esta información fue capturada durante tu registro inicial.
                      </div>
                      
                      <div class="row g-3" id="record-readonly-container">
                         <!-- Inyectado dinámicamente -->
                         <p class="text-center text-muted">Cargando expediente...</p>
                      </div>
                  </div>

               </div>
               
               <!-- Footer acciones editar -->
               <div class="card-footer bg-white border-0 text-end d-none border-top" id="prof-save-actions">
                  <button class="btn btn-light rounded-pill me-2" onclick="Profile.cancelEdit()">Cancelar</button>
                  <button class="btn btn-primary rounded-pill px-4 shadow-sm" onclick="Profile.saveChanges()">Guardar Cambios</button>
               </div>
             </div>

          </div>
        </div>
      </div>
    </div>`;
  }

  function render() {
    // Fallback to global SIA profile if _ctx is not ready
    const p = (_ctx && _ctx.currentUserProfile) ? _ctx.currentUserProfile : (window.SIA ? window.SIA.currentUserProfile : null);

    if (!p) {
      console.warn("Profile: No profile data found to render.");
      setText('prof-name', 'Cargando...');
      return;
    }

    // Strict Student Check
    const isStudent = (p.role === 'student');

    // Header Data
    setText('prof-name', p.displayName || 'Usuario');

    // Display Role
    let displayRole = 'Usuario';
    if (p.department) displayRole = p.department.toUpperCase();
    else if (p.role === 'student') displayRole = 'ESTUDIANTE';
    else displayRole = (p.role || '').toUpperCase();

    setText('prof-role', displayRole);

    const matricula = p.matricula || ((p.uid) ? p.uid.substring(0, 8).toUpperCase() : '');
    setText('prof-matricula-display', matricula);

    // Avatar
    const img = document.getElementById('prof-avatar-img');
    const init = document.getElementById('prof-avatar-initials');
    if (p.photoURL) {
      if (img) { img.src = p.photoURL; img.classList.remove('d-none'); }
      if (init) init.classList.add('d-none');
    } else {
      if (init) {
        init.textContent = (p.displayName || 'U').substring(0, 2).toUpperCase();
        init.classList.remove('d-none');
      }
      if (img) img.classList.add('d-none');
    }

    // Visibility Logic (Role-based) - AGGRESSIVE HIDING
    const qrBtn = document.getElementById('btn-prof-view-qr');
    const tabRecord = document.getElementById('tab-record-btn');
    const tabMedical = document.getElementById('tab-medical-btn'); // For 'Salud'

    if (isStudent) {
      // SHOW Student Tabs
      if (qrBtn) qrBtn.classList.remove('d-none');
      if (tabRecord) tabRecord.parentElement.classList.remove('d-none');
      if (tabMedical) tabMedical.parentElement.classList.remove('d-none');
      renderRecordTab(p);
    } else {
      // HIDE Tabs for Staff/Dept
      if (qrBtn) qrBtn.classList.add('d-none');
      if (tabRecord) tabRecord.parentElement.classList.add('d-none');
      if (tabMedical) tabMedical.parentElement.classList.add('d-none');

      // Switch to General Tab if current is hidden
      const triggerEl = document.querySelector('#profile-tabs button[data-bs-target="#tab-general"]');
      if (triggerEl) {
        setTimeout(() => new bootstrap.Tab(triggerEl).show(), 100);
      }
    }

    // Fill General Form (Safe Access)
    setVal('prof-fullname', p.displayName);
    setVal('prof-email', p.email);
    setVal('prof-phone', p.telefono || '');

    // Handle Nested Data Safely
    const pd = p.personalData || {};
    const hd = p.healthData || {};

    setVal('prof-address', pd.domicilio || p.domicilio || '');
    setVal('prof-gender', pd.genero || p.genero || '');
    setVal('prof-civil', pd.estadoCivil || p.estadoCivil || '');
    setVal('prof-program', p.carrera || 'No asignada');

    setVal('prof-blood', p.tipoSangre || '');

    // Medical Contact (Valid for everyone?) - Maybe only students?
    // User said: "Departamentos igual no carga nada pero ellos siguen viendo salud y contacto"
    // If we hid the tab, we don't need to populate it for them.

    if (isStudent) {
      setVal('prof-allergies', hd.alergia || '');
      setVal('prof-emergency-name', p.contactoEmergenciaName || '');
      setVal('prof-emergency-tel', p.contactoEmergenciaTel || '');
    }
  }

  function renderRecordTab(profile) {
    const container = document.getElementById('record-readonly-container');
    if (!container) return;

    const h = profile.healthData || {};
    const c = profile.culturalData || {};
    const p = profile.personalData || {};

    const item = (label, val) => `
           <div class="col-md-6 col-lg-4">
              <div class="p-3 border-0 rounded-4 bg-light h-100">
                 <div class="small fw-bold text-muted text-uppercase mb-1" style="font-size: 0.65rem;">${label}</div>
                 <div class="text-dark small text-break" style="font-weight: 500;">${val || 'N/A'}</div>
              </div>
           </div>`;

    container.innerHTML = `
           <div class="col-12"><h6 class="fw-bold text-success small mb-0"><i class="bi bi-heart-pulse me-1"></i>Salud</h6></div>
           ${item('Condición', h.condicionSalud)}
           ${item('Tratamiento', h.tratamientoMedico)}
           ${item('Pad. Físico', h.padecimientoFisico)}
           ${item('Pad. Mental', h.padecimientoMental)}
           ${item('Sustancias', h.sustancias)}
           ${item('Discapacidad', h.discapacidad)}
           
           <div class="col-12 mt-3"><h6 class="fw-bold text-info small mb-0"><i class="bi bi-people me-1"></i>Inclusión</h6></div>
           ${item('Lengua Indígena', c.lenguaIndigena)}
           ${item('Pueblo Originario', c.grupoEtnico)}
           ${item('Lengua Señas', c.lenguaSenas)}
           
           <div class="col-12 mt-3"><h6 class="fw-bold text-primary small mb-0"><i class="bi bi-person me-1"></i>Personal</h6></div>
           ${item('Dependientes', p.dependientes || p.hijos)}
           ${item('¿Trabaja?', p.trabaja)}
           ${item('Beca', profile.beca || 'No')}
        `;
  }

  function toggleEditMode() {
    _isEditing = !_isEditing;
    updateFormState();
  }

  function updateFormState() {
    const editableIds = ['prof-phone', 'prof-address', 'prof-civil', 'prof-blood', 'prof-allergies', 'prof-emergency-name', 'prof-emergency-tel'];

    editableIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = !_isEditing;
        if (_isEditing) {
          el.classList.remove('bg-light');
          el.classList.remove('border-0');
          el.classList.add('border');
          el.classList.add('shadow-sm');
        } else {
          el.classList.remove('border', 'shadow-sm');
          el.classList.add('bg-light', 'border-0');
        }
      }
    });

    const actions = document.getElementById('prof-save-actions');
    if (actions) actions.classList.toggle('d-none', !_isEditing);

    // Hide Edit Buttons when editing
    document.querySelectorAll('.toggle-edit-btn').forEach(b => b.classList.toggle('d-none', _isEditing));
  }

  function cancelEdit() {
    _isEditing = false;
    render(); // Reset values
    updateFormState();
  }

  async function saveChanges() {
    if (!_ctx || !_ctx.currentUserProfile) return;

    // 1. Prepare Update Object (Flattened for Firestore)
    const updates = {};

    // Simple Fields
    updates['telefono'] = getVal('prof-phone');
    updates['domicilio'] = getVal('prof-address');
    updates['tipoSangre'] = getVal('prof-blood');
    updates['contactoEmergenciaName'] = getVal('prof-emergency-name');
    updates['contactoEmergenciaTel'] = getVal('prof-emergency-tel');

    // Nested Fields (Dot Notation for Firestore)
    updates['personalData.domicilio'] = getVal('prof-address');
    updates['personalData.estadoCivil'] = getVal('prof-civil');
    updates['healthData.alergia'] = getVal('prof-allergies');

    // 2. Optimistic Update (Local State)
    // We must safely update nested objects in memory
    const p = _ctx.currentUserProfile;
    if (!p.personalData) p.personalData = {};
    if (!p.healthData) p.healthData = {};

    p.telefono = updates['telefono'];
    p.domicilio = updates['domicilio'];
    p.tipoSangre = updates['tipoSangre'];
    p.contactoEmergenciaName = updates['contactoEmergenciaName'];
    p.contactoEmergenciaTel = updates['contactoEmergenciaTel'];

    p.personalData.domicilio = updates['personalData.domicilio'];
    p.personalData.estadoCivil = updates['personalData.estadoCivil'];
    p.healthData.alergia = updates['healthData.alergia'];

    try {
      // 3. Send to Firestore
      const btn = document.querySelector('#prof-save-actions button.btn-primary');
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...'; }

      await _ctx.db.collection('usuarios').doc(_ctx.auth.currentUser.uid).update(updates);

      if (typeof showToast === 'function') showToast('Perfil actualizado con éxito', 'success');

      _isEditing = false;
      updateFormState(); // UI Reset

    } catch (e) {
      console.error("Error saving profile:", e);
      alert('Error al guardar cambios: ' + e.message);
    } finally {
      const btn = document.querySelector('#prof-save-actions button.btn-primary');
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar Cambios'; }
    }
  }

  function setupListeners() {
    // Photo upload
    const fileInput = document.getElementById('prof-pic-input');
    if (fileInput) fileInput.addEventListener('change', uploadPhoto);

    // Tab switch listener to fix potential visibility issues
    const tabs = document.querySelectorAll('#profile-tabs button[data-bs-toggle="pill"]');
    tabs.forEach(tab => {
      tab.addEventListener('shown.bs.tab', (e) => {
        // If switching tabs while editing, maybe we should cancel edit?
        // Or at least reassure validation. For now, just logging.
      });
    });
  }

  async function uploadPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tamaño (Max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("La imagen es muy pesada. Máximo 2MB.");
      return;
    }

    try {
      const btn = document.querySelector('#prof-pic-input').previousElementSibling;
      const originalIcon = btn.innerHTML;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
      btn.disabled = true;

      console.log('Using context for storage:', _ctx);
      const storage = _ctx.storage || (window.SIA && window.SIA.storage);

      if (!storage) {
        throw new Error("Firebase Storage no está disponible en este contexto.");
      }

      const uid = _ctx.auth.currentUser.uid;
      const storageRef = storage.ref().child(`users/${uid}/profile_pic.jpg`);

      const snapshot = await storageRef.put(file);
      const downloadURL = await snapshot.ref.getDownloadURL();

      // Actualizar UI
      document.getElementById('prof-avatar-img').src = downloadURL;
      document.getElementById('prof-avatar-img').classList.remove('d-none');
      document.getElementById('prof-avatar-initials').classList.add('d-none');

      // Actualizar Auth y Firestore
      // 1. Auth
      await _ctx.auth.currentUser.updateProfile({ photoURL: downloadURL });

      // 2. Firestore
      await _ctx.db.collection('usuarios').doc(uid).update({ photoURL: downloadURL });

      // 3. Contexto Local
      _ctx.currentUserProfile.photoURL = downloadURL;

      if (typeof showToast === 'function') showToast('Foto actualizada', 'success');

      btn.innerHTML = originalIcon;
      btn.disabled = false;

    } catch (err) {
      console.error(err);
      alert('Error al subir foto: ' + err.message);
      const btn = document.querySelector('#prof-pic-input').previousElementSibling;
      if (btn) {
        btn.innerHTML = '<i class="bi bi-pencil-fill xs-icon"></i>';
        btn.disabled = false;
      }
    }
  }
  function openDigitalID() {
    const nav = document.querySelector('sia-navbar');
    if (nav && typeof nav.openRefactoredDigitalID === 'function') {
      nav.openRefactoredDigitalID();
    } else {
      console.warn("SiaNavbar not found, falling back to basic modal open");
      const modalEl = document.getElementById('modalDigitalID');
      if (modalEl) new bootstrap.Modal(modalEl).show();
    }
  }

  // Helpers
  function setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }
  function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
  function getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }

  return { init, toggleEditMode, cancelEdit, saveChanges, openDigitalID };

})();

window.Profile = Profile;