// public/modules/admin.system.js
const AdminSystem = {
  init(ctx) {
    this.ctx = ctx;
    this.setupListeners();
    this.loadActiveNotices();
    this.loadCurrentConfig();
  },

  setupListeners() {
    const formNotice = document.getElementById('form-global-notice');
    if (formNotice) {
      formNotice.onsubmit = async (e) => {
        e.preventDefault();
        const data = {
          tipo: document.getElementById('notice-type').value,
          texto: document.getElementById('notice-text').value,
          duration: parseInt(document.getElementById('notice-duration').value)
        };
        try {
          await AdminService.createGlobalNotice(this.ctx, data);
          showToast("Aviso publicado con éxito", "success");
          formNotice.reset();
        } catch (e) { showToast("Error al publicar", "danger"); }
      };
    }

    // Listeners para Kill Switches
    document.querySelectorAll('.switch-module').forEach(sw => {
      sw.onchange = (e) => this.toggleModule(e.target.dataset.module, e.target.checked);
    });
  },

  async toggleModule(moduleId, isEnabled) {
    try {
      await AdminService.setGlobalConfig(this.ctx, 'modules', { [moduleId]: isEnabled });
      showToast(`${moduleId.toUpperCase()} ${isEnabled ? 'Habilitado' : 'Deshabilitado'}`, isEnabled ? "success" : "warning");
    } catch (e) { showToast("Error al cambiar estado", "danger"); }
  },

  async saveMediConfig() {
    const slot = document.getElementById('config-medi-slot').value;
    try {
      await AdminService.setGlobalConfig(this.ctx, 'medi', { slotDuration: parseInt(slot) });
      showToast("Configuración médica guardada", "success");
    } catch (e) { showToast("Error al guardar", "danger"); }
  },

  loadActiveNotices() {
    const list = document.getElementById('active-global-notices');
    if (!list) return;

    this.ctx.ModuleManager.addSubscription(
      AdminService.streamGlobalNotices(this.ctx, (snap) => {
        list.innerHTML = snap.docs.map(doc => {
          const a = doc.data();
          const date = a.createdAt?.toDate().toLocaleString() || '---';
          return `
            <div class="list-group-item d-flex justify-content-between align-items-center px-0 bg-transparent border-0 border-bottom">
              <div class="small">
                <span class="badge ${a.tipo === 'emergencia' ? 'bg-danger' : 'bg-primary'} extra-small me-2">${a.tipo}</span>
                <span class="text-dark">${a.texto}</span>
                <div class="extra-small text-muted mt-1">${date}</div>
              </div>
              <button class="btn btn-link text-danger btn-sm p-0" onclick="AdminService.deleteNotice('${doc.id}')">
                <i class="bi bi-trash"></i>
              </button>
            </div>`;
        }).join('') || '<p class="text-center text-muted small py-3">No hay avisos recientes</p>';
      })
    );
  },

  async loadCurrentConfig() {
    // Aquí cargaríamos los estados de los switches desde Firestore para sincronizar la UI
  }
};
window.AdminSystem = AdminSystem;