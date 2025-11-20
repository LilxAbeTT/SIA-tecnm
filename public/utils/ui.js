// utils/ui.js
// Toast 2.0 + modal de detalle de consulta

(function(global){

  function showToast(message, variant='info'){
    const container = document.getElementById('toast-container'); 
    if(!container) return;

    // Iconos según variante
    const icons = {
      success: 'bi-check-lg',
      danger:  'bi-x-octagon-fill',
      warning: 'bi-exclamation-triangle-fill',
      info:    'bi-info-circle-fill',
      primary: 'bi-bell-fill'
    };
    const iconClass = icons[variant] || icons.info;

    // Mapeo de colores Bootstrap (text-bg-*)
    // Ajuste para variantes personalizadas si fuera necesario
    const bgClass = `text-bg-${variant}`;

    const el = document.createElement('div');
    // Agregamos 'toast-custom' y 'toast-animate-enter'
    el.className = `toast toast-custom align-items-center ${bgClass} border-0 show toast-animate-enter`;
    el.role = 'alert'; 
    el.ariaLive = 'assertive'; 
    el.ariaAtomic = 'true';
    
    // Estructura interna flexible (Pill shape)
    el.innerHTML = `
      <div class="d-flex w-100 py-2 px-3 align-items-center justify-content-between">
        <div class="d-flex align-items-center">
          <div class="toast-icon-box">
            <i class="bi ${iconClass}"></i>
          </div>
          <div>${message}</div>
        </div>
        <button type="button" class="btn-close btn-close-white ms-3" aria-label="Close"></button>
      </div>
    `;

    container.appendChild(el);

    // Lógica de cierre manual y automático con animación de salida
    const closeBtn = el.querySelector('.btn-close');
    
    const removeToast = () => {
      el.classList.remove('toast-animate-enter');
      el.classList.add('toast-animate-exit');
      // Esperar a que termine la animación CSS (0.4s)
      el.addEventListener('animationend', () => el.remove());
    };

    closeBtn.addEventListener('click', removeToast);

    // Auto-cierre a los 3.5 segundos
    setTimeout(() => {
      if(document.body.contains(el)) {
        removeToast();
      }
    }, 3500);
  }

  function openConsultaModal(html){
    const body = document.getElementById('modal-consulta-body'); if(!body) return;
    body.innerHTML = html;
    const mdl = new bootstrap.Modal(document.getElementById('modal-consulta'));
    mdl.show();
  }

  global.showToast = showToast;
  global.openConsultaModal = openConsultaModal;

})(window);