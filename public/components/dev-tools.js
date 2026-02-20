import { Store } from '../core/state.js';

export class DevTools extends HTMLElement {
  constructor() {
    super();
    this.isVisible = false;

    // --- DEPARTMENT CONFIGURATION ---
    this.DEPARTMENTS = {
      'estudiante': {
        label: "Estudiante (General)",
        icon: "bi-person",
        color: "#fff",
        profile: { role: 'student' },
        home: '/'
      },
      'Jefe de división': {
        label: "Jefe de división",
        icon: "bi-person",
        color: "#ffffff70",
        profile: {
          role: 'department_admin',
          permissions: { aula: 'admin', foro: 'admin' },
          allowedViews: ['view-foro', 'view-aula'],
          displayName: "Jefe de división"
        }, home: '/'
      },
      'medico_oficial': {
        label: "Servicio Médico (Doctor)",
        icon: "bi-hospital",
        color: "#dc3545",
        profile: {
          role: 'medico',
          permissions: { medi: 'admin' },
          allowedViews: ['view-medi'],
          displayName: "Médico General"
        },
        home: '/medi'
      },
      'calidad': {
        label: "Calidad (ISO/Lactario/Quejas/Encuestas)",
        icon: "bi-award",
        color: "#d63384",
        profile: {
          role: 'admin_calidad',
          permissions: { lactario: 'admin', audit: 'admin', quejas: 'admin', encuestas: 'admin' },
          allowedViews: ['view-dashboard', 'view-lactario', 'view-quejas', 'view-encuestas'],
          displayName: "Jefe de Calidad"
        },
        home: '/lactario'
      },
      'difusion': {
        label: "Difusión escolar",
        icon: "bi-megaphone",
        color: "#33d67fff",
        profile: {
          role: 'department_admin',
          permissions: { foro: 'superadmin', avisos: 'admin' },
          allowedViews: ['view-dashboard', 'view-foro'],
          displayName: "Difusión escolar"
        },
        home: '/'
      },
      'desarrollo': {
        label: "Desarrollo Académico",
        icon: "bi-mortarboard",
        color: "#0d6efd",
        profile: {
          role: 'department_admin',
          permissions: { reportes: 'admin' },
          allowedViews: ['view-reportes'],
          displayName: "Coord. Desarrollo Acad."
        },
        home: '/reportes'
      },
      'psicopedagogico': {
        label: "Atención Psicopedagógica",
        icon: "bi-heart-pulse",
        color: "#6f42c1",
        profile: {
          role: 'Psicologo',
          especialidad: 'Psicologo',
          permissions: { medi: 'admin' },
          allowedViews: ['view-medi'],
          displayName: "Psicólogo en Turno"
        },
        home: '/'
      },
      'biblioteca': {
        label: "Centro de Información (Biblio)",
        icon: "bi-book",
        color: "#ffc107",
        profile: {
          role: 'biblio_admin',
          permissions: { biblio: 'admin' },
          allowedViews: ['view-biblio'],
          displayName: "Jefe de Biblioteca"
        },
        home: '/biblio'
      }
    };
  }

  connectedCallback() {
    // Check for dev_mode flag
    const isDevMode = localStorage.getItem('sia_dev_mode') === 'true' || window.SIA_DEV_MODE === true;
    if (!isDevMode) { this.style.display = 'none'; return; }

    this.render();
    this.addListeners();
  }

  render() {
    // Generate Buttons from Config
    const buttonsHtml = Object.entries(this.DEPARTMENTS).map(([key, dept]) => `
       <div class="dev-dept-item" data-dept="${key}" style="border-left: 3px solid ${dept.color}">
          <i class="bi ${dept.icon} me-2" style="color:${dept.color}"></i>
          <span>${dept.label}</span>
       </div>
    `).join('');

    this.innerHTML = `
      <style>
        .dev-tools-fab {
          position: fixed; bottom: 20px; right: 20px; z-index: 10000;
          background-color: #111; color: #0f0; border: 1px solid #0f0;
          border-radius: 50%; width: 50px; height: 50px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
          transition: transform 0.2s;
        }
        .dev-tools-fab:hover { transform: scale(1.1); }
        
        .dev-tools-menu {
          position: fixed; bottom: 80px; right: 20px; width: 280px;
          background: rgba(10, 10, 10, 0.95); border: 1px solid #333;
          border-radius: 12px; padding: 0; z-index: 10000;
          display: none; color: #eee; font-family: system-ui, -apple-system, sans-serif;
          box-shadow: 0 10px 30px rgba(0,0,0,0.8); overflow: hidden;
        }
        .dev-tools-menu.active { display: block; animation: fadeIn 0.1s ease-out; }
        
        .dev-header {
          padding: 12px 16px; background: #000; border-bottom: 1px solid #333;
          display: flex; justify-content: between; align-items: center;
        }
        .dev-label { font-size: 0.75rem; letter-spacing: 1px; color: #0f0; font-weight: bold; text-transform: uppercase; }
        
        .dev-list { padding: 8px; }
        .dev-dept-item {
          padding: 10px 12px; margin-bottom: 4px; border-radius: 6px;
          cursor: pointer; display: flex; align-items: center; font-size: 0.9rem;
          background: #1a1a1a; transition: all 0.2s;
        }
        .dev-dept-item:hover { background: #2a2a2a; padding-left: 16px; }
        .dev-dept-item.active { background: #333; border-left-width: 5px; }
        
        .dev-footer {
           padding: 8px 16px; background: #000; border-top: 1px solid #333;
           font-size: 0.7rem; color: #666; text-align: right;
        }
      </style>

      <div class="dev-tools-fab" id="dev-fab" title="Developer Tools">
        <i class="bi bi-terminal-fill"></i>
      </div>

      <div class="dev-tools-menu" id="dev-menu">
        <div class="dev-header">
           <span class="dev-label">⚡ SIA DEV MODE</span>
           <i class="bi bi-x-lg" id="dev-close" style="cursor:pointer; font-size:0.8rem"></i>
        </div>
        
        <div class="dev-list">
           ${buttonsHtml}
        </div>

        <div class="dev-footer">
           Current: <span id="dev-current-role" class="text-white">--</span>
        </div>
      </div>
    `;
  }

  addListeners() {
    const fab = this.querySelector('#dev-fab');
    const menu = this.querySelector('#dev-menu');
    const close = this.querySelector('#dev-close');
    const items = this.querySelectorAll('.dev-dept-item');

    const toggle = () => {
      menu.classList.toggle('active');
      this.updateUI();
    };

    fab.addEventListener('click', toggle);
    close.addEventListener('click', () => menu.classList.remove('active'));

    items.forEach(item => {
      item.addEventListener('click', () => {
        const deptKey = item.dataset.dept;
        this.simulateDepartment(deptKey);
      });
    });

    Store.on('user-changed', () => this.updateUI());
  }

  updateUI() {
    const currentLabel = this.querySelector('#dev-current-role');
    const items = this.querySelectorAll('.dev-dept-item');
    const effectiveRole = Store.userProfile ? Store.userProfile.role : 'guest';

    if (currentLabel) currentLabel.textContent = effectiveRole;

    // Simple active check driven by role name matching basic profile
    // This is imperfect for complex depts but good visual feedback
    items.forEach(item => {
      const dept = this.DEPARTMENTS[item.dataset.dept];
      if (dept.profile.role === effectiveRole) item.classList.add('active');
      else item.classList.remove('active');
    });
  }

  simulateDepartment(deptKey) {
    if (!Store.userProfile) {
      alert("Debes iniciar sesión primero para simular departamentos.");
      return;
    }

    const dept = this.DEPARTMENTS[deptKey];
    if (!dept) return;

    // 1. Clone & Clean
    const newProfile = { ...Store.userProfile };

    // Remove old sensitive props
    delete newProfile.especialidad;
    delete newProfile.permissions;
    delete newProfile.allowedViews;

    // 2. Inject New Props
    Object.assign(newProfile, dept.profile);

    console.log(`[DevTools] ⚡ Simulating Department: ${dept.label}`, newProfile);

    // 3. PERSIST & Update Store
    localStorage.setItem('sia_simulated_profile', JSON.stringify(newProfile));
    Store.setUser(Store.user, newProfile);
    showToast(`Modo: ${dept.label}`, 'success');

    // 4. Redirect / Refresh
    // If we have a preferred home for this department, go there
    if (dept.home && dept.home !== '/') {
      window.location.hash = '#' + dept.home;
      window.location.reload(); // Hard reload to force init scripts to re-run with new permissions
    } else {
      window.location.reload();
    }
  }
}

customElements.define('sia-dev-tools', DevTools);
