// public/modules/admin.users.js
const AdminUsers = {
  init(ctx) {
    this.ctx = ctx;
    this.renderUsers();
    this.setupListeners();
    // Inicializar tooltips de Fase 1
    if (window.UI && UI.initTooltips) UI.initTooltips();
  },

  async renderUsers() {
    const tbody = document.getElementById('sa-users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>';

    try {
      const docs = await AdminService.getAllUsers(this.ctx);
      tbody.innerHTML = docs.map(doc => {
        const u = doc.data();
        const roleBadge = this.getRoleBadge(u.role);
        return `
          <tr>
            <td>
              <div class="fw-bold text-dark">${u.displayName || 'Sin nombre'}</div>
              <div class="extra-small text-muted">${u.email}</div>
            </td>
            <td class="font-monospace small">${u.matricula || '---'}</td>
            <td>${roleBadge}</td>
            <td><span class="badge ${u.status === 'active' ? 'bg-success' : 'bg-danger'} rounded-pill">${u.status || 'active'}</span></td>
            <td>
              <button class="btn btn-light btn-sm rounded-circle border shadow-sm" onclick="AdminUsers.openEditModal('${doc.id}', '${u.displayName}', '${u.role}', '${u.status}')">
                <i class="bi bi-pencil-square"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error al cargar usuarios.</td></tr>';
    }
  },

  getRoleBadge(role) {
    const map = {
      superadmin: 'bg-dark',
      medico: 'bg-danger',
      biblio: 'bg-warning text-dark',
      student: 'bg-light text-muted',
      aula: 'bg-success'
    };
    return `<span class="badge ${map[role] || 'bg-secondary'} rounded-pill">${role?.toUpperCase() || 'STUDENT'}</span>`;
  },

  openEditModal(uid, name, role, status) {
    document.getElementById('edit-user-uid').value = uid;
    document.getElementById('edit-user-name').textContent = name;
    document.getElementById('edit-user-role').value = role || 'student';
    document.getElementById('edit-user-status').value = status || 'active';
    const m = new bootstrap.Modal(document.getElementById('modalAdminEditUser'));
    m.show();
  },

  setupListeners() {
    const form = document.getElementById('form-admin-edit-user');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const uid = document.getElementById('edit-user-uid').value;
        const updates = {
          role: document.getElementById('edit-user-role').value,
          status: document.getElementById('edit-user-status').value
        };
        try {
          await AdminService.updateUserIdentity(this.ctx, uid, updates);
          showToast("Identidad actualizada correctamente", "success");
          bootstrap.Modal.getInstance(document.getElementById('modalAdminEditUser')).hide();
          this.renderUsers();
        } catch (e) {
          showToast("No se pudo actualizar el rol", "danger");
        }
      };
    }
  }
};
window.AdminUsers = AdminUsers;