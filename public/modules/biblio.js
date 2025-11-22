// modules/biblio.js
// Controlador de UI para Biblioteca (Consume BiblioService)

const Biblio = (function () {
  let _ctx = null;
  let _currentStudentPrestamos = [];
  let _chFlow = null;
  let _chServ = null;
  let _chOccupancy = null;
  let _biblopInterval = null;
  let _selectedAssetId = null; // Para el admin panel
  let _allBooks = [];
  let _wishlistSet = new Set();
  let _bookModal = null; // Instancia de Bootstrap Modal
  // Check URL params for Kiosk Mode immediately
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mode') === 'kiosk') {
    const assetId = urlParams.get('id');
    if (assetId) {
      // Iniciamos modo kiosko y detenemos la carga normal de la app
      initKioskMode(assetId);
    }
  }

  function initKioskMode(assetId) {
    console.log("🔒 Iniciando Modo Kiosko para:", assetId);
    const overlay = document.getElementById('kiosk-overlay');
    const label = document.getElementById('kiosk-id-label');
    if (label) label.textContent = `ID: ${assetId}`;

    // Ocultar loader de app normal si existe
    const appLoader = document.getElementById('app-loader');
    if (appLoader) appLoader.classList.add('d-none');

    // Escuchar cambios
    BiblioAssetsService.listenToAssetLock({ db: SIA.db }, assetId, (data) => {
      if (!data) {
        overlay.classList.remove('d-none');
        label.textContent = "Error: Activo no encontrado";
        return;
      }

      // Lógica de bloqueo
      const isLocked = data.estado === 'locked';
      const isExpired = data.isExpired; // Calculado en el servicio

      if (isLocked || isExpired) {
        overlay.classList.remove('d-none'); // BLOQUEAR
        // Si expiró pero seguía 'active', forzamos update en DB (opcional)
      } else {
        overlay.classList.add('d-none'); // DESBLOQUEAR
      }
    });

    // --- BLINDAJE DE UI PARA KIOSKO ---
    document.addEventListener('contextmenu', event => event.preventDefault());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F12' || e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
      }
    });

    const enterFullScreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(e => { });
      }
    };

    BiblioAssetsService.listenToAssetLock({ db: SIA.db }, assetId, (data) => {
      const isLocked = data && (data.estado === 'locked' || data.isExpired);
      if (isLocked) {
        overlay.classList.remove('d-none');
        enterFullScreen();
      }
    });
  }

  // ========== STUDENT ==========
  async function initStudent(ctx) {
    _ctx = ctx;
    const user = _ctx.auth.currentUser;

    renderStudentTabs();
    initCatalogView(user);
    initServicesView(user);
    initDigitalView();
    initProfileView(user);
  }

  function renderStudentTabs() {
    const container = document.getElementById('biblio-student');
    if (!container) return;

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="h4 fw-bold text-primary mb-0">Biblioteca</h2>
                <p class="text-muted small mb-0">Explora nuestro acervo físico y digital</p>
            </div>
            <span class="badge bg-warning text-dark rounded-pill shadow-sm px-3 py-2" id="biblio-user-level">
                <i class="bi bi-star-fill me-1"></i> Nivel 1
            </span>
        </div>

        <ul class="nav nav-pills mb-4 gap-2 overflow-x-auto flex-nowrap pb-2" id="biblio-stu-tabs" role="tablist">
            <li class="nav-item"><button class="nav-link active rounded-pill white-space-nowrap" data-bs-toggle="pill" data-bs-target="#tab-catalogo"><i class="bi bi-collection-play me-2"></i>Explorar</button></li>
            <li class="nav-item"><button class="nav-link rounded-pill white-space-nowrap" data-bs-toggle="pill" data-bs-target="#tab-servicios"><i class="bi bi-pc-display me-2"></i>Servicios</button></li>
            <li class="nav-item"><button class="nav-link rounded-pill white-space-nowrap" data-bs-toggle="pill" data-bs-target="#tab-digital"><i class="bi bi-tablet me-2"></i>Digital</button></li>
            <li class="nav-item"><button class="nav-link rounded-pill white-space-nowrap" data-bs-toggle="pill" data-bs-target="#tab-perfil"><i class="bi bi-person-badge me-2"></i>Mi Perfil</button></li>
        </ul>

        <div class="tab-content">
            <div class="tab-pane fade show active" id="tab-catalogo">
                <div class="row g-4">
                    <div class="col-lg-8">
                        <div class="input-group shadow-sm rounded-pill mb-4 bg-white">
                            <span class="input-group-text bg-white border-0 ps-4"><i class="bi bi-search fs-5 text-muted"></i></span>
                            <input type="search" id="biblio-search" class="form-control border-0 shadow-none" placeholder="Buscar por título, autor, materia..." style="height: 50px; font-size: 1.1rem;">
                            <button class="btn btn-white border-0 pe-4 text-muted" type="button" id="btn-clear-search" style="display:none">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        </div>

                        <div id="biblio-discovery-view" class="fade-in">
                            <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
                        </div>

                        <div id="biblio-search-view" class="d-none fade-in">
                            <h5 class="fw-bold mb-3 text-muted">Resultados de la búsqueda</h5>
                            <div id="biblio-search-grid" class="row g-4"></div>
                        </div>
                    </div>

                    <div class="col-lg-4">
                        <div id="biblio-digital-id-container"></div> 
                        
                        <div class="card border-0 shadow-sm rounded-4 mt-3 overflow-hidden">
                            <div class="card-header bg-white border-0 pt-4 px-4">
                                <h6 class="fw-bold mb-0"><i class="bi bi-bag-check-fill me-2 text-primary"></i>Mi Mochila</h6>
                            </div>
                            <div class="card-body p-0">
                                <div id="biblio-prestamos-list" class="list-group list-group-flush p-2" style="min-height: 100px;">
                                    <div class="text-center text-muted py-4 small">Tu mochila está vacía.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="tab-pane fade" id="tab-servicios"></div>
            <div class="tab-pane fade" id="tab-digital"></div>
            <div class="tab-pane fade" id="tab-perfil"></div>
        </div>

        <div class="modal fade" id="modalBookDetail" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                    <div class="modal-body p-0">
                        <button type="button" class="btn-close position-absolute top-0 end-0 m-3 z-3 bg-white p-2 rounded-circle shadow-sm" data-bs-dismiss="modal" aria-label="Close"></button>
                        <div class="row g-0">
                            <div class="col-md-5 position-relative bg-light d-flex align-items-center justify-content-center p-4" 
                                 id="modal-book-cover-container" style="min-height: 400px;">
                                 </div>
                            <div class="col-md-7 p-4 p-lg-5 d-flex flex-column">
                                <div class="mb-auto">
                                    <span class="badge bg-primary-subtle text-primary mb-2" id="modal-book-cat">General</span>
                                    <h2 class="fw-bold mb-1" id="modal-book-title">Título</h2>
                                    <p class="text-muted fs-5 mb-4" id="modal-book-author">Autor</p>
                                    
                                    <p class="text-body-secondary mb-4 small" style="line-height: 1.6;">
                                        Sinopsis no disponible.
                                    </p>

                                    <div class="d-flex gap-4 mb-4">
                                        <div>
                                            <div class="small text-muted text-uppercase fw-bold">Disponibles</div>
                                            <div class="fs-4 fw-bold text-success" id="modal-book-stock">0</div>
                                        </div>
                                        <div>
                                            <div class="small text-muted text-uppercase fw-bold">Ubicación</div>
                                            <div class="fs-4 fw-bold text-dark">Pasillo A2</div>
                                        </div>
                                    </div>
                                </div>

                                <div class="d-grid gap-2 d-sm-flex mt-3">
                                    <button type="button" class="btn btn-primary btn-lg rounded-pill px-5 flex-grow-1" id="btn-modal-apartar">
                                        Apartar Ahora
                                    </button>
                                    <button type="button" class="btn btn-outline-secondary btn-lg rounded-pill px-4" id="btn-modal-wishlist">
                                        <i class="bi bi-heart"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
  }

  function initCatalogView(user) {
    const discoveryView = document.getElementById('biblio-discovery-view');
    const searchView = document.getElementById('biblio-search-view');
    const searchGrid = document.getElementById('biblio-search-grid');
    const searchInput = document.getElementById('biblio-search');
    const btnClear = document.getElementById('btn-clear-search');

    // 1. Cargar Wishlist (Para marcar los corazones)
    BiblioService.streamWishlist(_ctx, user.uid, (ids) => {
      _wishlistSet = ids;
      // Refrescar UI si ya está cargada (re-render simple o toggle clases)
      updateHeartIcons();
    });

    // 2. Cargar Libros
    BiblioService.streamCatalogo(_ctx, docs => {
      _allBooks = docs.map(d => ({ id: d.id, ...d.data() }));
      renderDiscovery(_allBooks);
    }, console.error);

    // 3. Lógica de Búsqueda
    searchInput?.addEventListener('input', (e) => {
      const term = e.target.value.trim().toLowerCase();

      if (term.length > 0) {
        discoveryView.classList.add('d-none');
        searchView.classList.remove('d-none');
        btnClear.style.display = 'block';

        const results = _allBooks.filter(b =>
          (b.titulo || '').toLowerCase().includes(term) ||
          (b.autor || '').toLowerCase().includes(term)
        );
        renderGrid(searchGrid, results);
      } else {
        discoveryView.classList.remove('d-none');
        searchView.classList.add('d-none');
        btnClear.style.display = 'none';
      }
    });

    btnClear?.addEventListener('click', () => {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
    });
  }

  function renderDiscovery(books) {
    const container = document.getElementById('biblio-discovery-view');
    if (!container) return;

    const cats = BiblioService.categorizeBooks(books);

    container.innerHTML = `
        ${renderCarouselSection('🔥 Tendencias', cats.trending)}
        ${renderCarouselSection('✨ Recién Llegados', cats.new)}
        ${renderCarouselSection('📐 Ingeniería y Ciencias', cats.tech)}
        ${renderCarouselSection('📚 Colección General', cats.general)}
      `;
  }

  function renderCarouselSection(title, books) {
    if (!books || books.length === 0) return '';

    // Generamos las cards
    const cardsHtml = books.map(b => createBookCard(b)).join('');

    return `
        <div class="mb-5">
            <h5 class="fw-bold mb-3 px-2">${title}</h5>
            <div class="d-flex gap-3 overflow-x-auto pb-4 px-2 scrollbar-hide" style="scroll-snap-type: x mandatory;">
                ${cardsHtml}
            </div>
        </div>
      `;
  }

  function renderGrid(container, books) {
    if (books.length === 0) {
      container.innerHTML = `
            <div class="col-12 text-center py-5 text-muted">
                <i class="bi bi-search display-1 opacity-25 mb-3"></i>
                <p>No encontramos libros con esa búsqueda.</p>
            </div>`;
      return;
    }
    container.innerHTML = books.map(b => `
        <div class="col-6 col-md-4 col-lg-3 col-xl-2">
            ${createBookCard(b, true)}
        </div>
      `).join('');
  }

  // Crea la tarjeta HTML (Poster vertical)
  function createBookCard(book, isGrid = false) {
      const coverStyle = getCoverGradient(book.titulo); 
      const stockClass = book.copiasDisponibles > 0 ? 'border-success' : 'border-danger opacity-75';
      const widthStyle = isGrid ? 'width: 100%;' : 'width: 160px; flex: 0 0 160px; scroll-snap-align: start;';
      const safeBook = encodeURIComponent(JSON.stringify(book));

      // Lógica de imagen segura: Si hay URL, intenta cargarla. Si falla (onerror), oculta la img y muestra el div de fondo.
      let imageHtml = '';
      if (book.portadaUrl) {
          // Truco: La imagen está encima. Si falla, se oculta (display:none) y se ve el fondo gradiente.
          imageHtml = `<img src="${book.portadaUrl}" class="position-absolute top-0 start-0 w-100 h-100 object-fit-cover rounded-3" 
                            onerror="this.style.display='none'" alt="${book.titulo}">`;
      }

      return `
        <div class="book-card position-relative group" style="${widthStyle} cursor: pointer;" onclick="Biblio.openBookDetail('${safeBook}')">
            <div class="ratio ratio-2x3 rounded-3 shadow-sm overflow-hidden position-relative mb-2 book-cover-hover" 
                 style="${coverStyle}">
                 
                 <div class="d-flex align-items-center justify-content-center h-100 text-center p-2">
                    <span class="text-white fw-bold small text-shadow-sm" style="z-index:0">${book.titulo}</span>
                 </div>

                 ${imageHtml}

                 <div class="position-absolute bottom-0 start-0 w-100 p-2 bg-gradient-to-t from-black-75" 
                      style="background: linear-gradient(to top, rgba(0,0,0,0.9), transparent); z-index: 2;">
                     <div class="text-white small fw-bold text-truncate">${book.titulo}</div>
                     <div class="text-white-50 extra-small text-truncate">${book.autor}</div>
                 </div>

                 <div class="position-absolute top-0 end-0 m-2" style="z-index: 3;">
                    ${book.copiasDisponibles > 0 
                        ? '<span class="badge bg-success rounded-circle p-1" title="Disponible"><span class="visually-hidden">OK</span></span>' 
                        : '<span class="badge bg-danger rounded-circle p-1" title="Agotado"><span class="visually-hidden">NO</span></span>'}
                 </div>
            </div>
        </div>
      `;
  }

  // --- MODAL & ACCIONES ---

  function openBookDetail(jsonBook) {
      const book = JSON.parse(decodeURIComponent(jsonBook));
      const modalEl = document.getElementById('modalBookDetail');
      _bookModal = new bootstrap.Modal(modalEl);

      // 1. Datos Básicos
      document.getElementById('modal-book-title').textContent = book.titulo;
      document.getElementById('modal-book-author').textContent = book.autor;
      
      // Sinopsis (usar la del libro o generica)
      const sinopsis = book.sinopsis || "Sinopsis no disponible. Este libro es una excelente adición a tu lista de lectura académica. Consulta su disponibilidad y apártalo antes de que se agote.";
      document.querySelector('#modalBookDetail .text-body-secondary').textContent = sinopsis;

      // Stock Visual
      const stockEl = document.getElementById('modal-book-stock');
      if(book.copiasDisponibles > 0) {
          stockEl.className = 'fs-4 fw-bold text-success';
          stockEl.textContent = `${book.copiasDisponibles} disponibles`;
      } else {
          stockEl.className = 'fs-4 fw-bold text-danger';
          stockEl.textContent = 'Agotado';
      }

      // Portada (Imagen real o Generada)
      const coverContainer = document.getElementById('modal-book-cover-container');
      if (book.portadaUrl) {
          coverContainer.innerHTML = `<img src="${book.portadaUrl}" class="img-fluid shadow-lg rounded-3" style="max-height: 400px; width: auto;">`;
      } else {
          coverContainer.innerHTML = `
            <div class="ratio ratio-2x3 shadow-lg rounded-3" style="${getCoverGradient(book.titulo)}; max-width: 240px;">
                <div class="d-flex align-items-center justify-content-center h-100 text-white text-center p-3">
                    <div><i class="bi bi-book display-1 opacity-50"></i></div>
                </div>
            </div>`;
      }

      // 2. Lógica de Estado (Apartado / Wishlist)
      const btnApartar = document.getElementById('btn-modal-apartar');
      const btnWish = document.getElementById('btn-modal-wishlist');

      // a) Verificar si YA está apartado/prestado
      const isApartado = _currentStudentPrestamos.some(p => 
          p.libroId === book.id && ['pendiente', 'aprobado', 'entregado'].includes(p.estado)
      );

      // Limpiar listeners anteriores (clonando)
      const newBtnApartar = btnApartar.cloneNode(true);
      btnApartar.parentNode.replaceChild(newBtnApartar, btnApartar);
      
      const newBtnWish = btnWish.cloneNode(true);
      btnWish.parentNode.replaceChild(newBtnWish, btnWish);

      if (isApartado) {
          newBtnApartar.disabled = true;
          newBtnApartar.className = 'btn btn-secondary btn-lg rounded-pill px-5 flex-grow-1';
          newBtnApartar.innerHTML = '<i class="bi bi-check2-circle me-2"></i>Ya en tu mochila';
      } else if (book.copiasDisponibles <= 0) {
          newBtnApartar.disabled = true;
          newBtnApartar.className = 'btn btn-outline-danger btn-lg rounded-pill px-5 flex-grow-1';
          newBtnApartar.textContent = 'Agotado';
      } else {
          newBtnApartar.disabled = false;
          newBtnApartar.className = 'btn btn-primary btn-lg rounded-pill px-5 flex-grow-1';
          newBtnApartar.textContent = 'Apartar Ahora';
          
          newBtnApartar.onclick = async () => {
              // Feedback visual inmediato (Loading)
              newBtnApartar.disabled = true;
              newBtnApartar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';
              
              try {
                  await Biblio.solicitarLibro(book.id, book.titulo); // Llamada al servicio wrapper
                  _bookModal.hide();
                  // El listener de _currentStudentPrestamos actualizará la UI automáticamente
              } catch (e) {
                  newBtnApartar.disabled = false;
                  newBtnApartar.textContent = 'Reintentar';
              }
          };
      }

      // b) Verificar Wishlist
      const updateHeart = () => {
          if(_wishlistSet.has(book.id)) {
              newBtnWish.innerHTML = '<i class="bi bi-heart-fill text-danger"></i>';
              newBtnWish.classList.add('border-danger', 'text-danger');
          } else {
              newBtnWish.innerHTML = '<i class="bi bi-heart"></i>';
              newBtnWish.classList.remove('border-danger', 'text-danger');
          }
      };
      updateHeart();

      newBtnWish.onclick = async () => {
          const uid = _ctx.auth.currentUser.uid;
          // Toggle local optimista
          if (_wishlistSet.has(book.id)) _wishlistSet.delete(book.id);
          else _wishlistSet.add(book.id);
          updateHeart();

          try {
              await BiblioService.toggleWishlist(_ctx, uid, book.id);
          } catch (e) {
              console.error(e); // Revertir si falla (opcional)
          }
      };

      _bookModal.show();
  }

  function updateWishlistButton(btn, bookId) {
    if (_wishlistSet.has(bookId)) {
      btn.innerHTML = '<i class="bi bi-heart-fill text-danger"></i>';
      btn.classList.add('border-danger', 'text-danger');
    } else {
      btn.innerHTML = '<i class="bi bi-heart"></i>';
      btn.classList.remove('border-danger', 'text-danger');
    }
  }

  // Actualizar iconos en tiempo real si cambia la wishlist
  function updateHeartIcons() {
    // Si el modal está abierto, refrescar su botón
    // (Esto es complejo sin estado global del modal, lo omitimos por ahora para MVP)
  }

  // --- UTILS ---
  // Genera un gradiente bonito basado en el título (siempre el mismo para el mismo libro)
  function getCoverGradient(title) {
    const colors = [
      ['#ff9a9e', '#fecfef'], ['#a18cd1', '#fbc2eb'], ['#84fab0', '#8fd3f4'],
      ['#cfd9df', '#e2ebf0'], ['#fccb90', '#d57eeb'], ['#e0c3fc', '#8ec5fc'],
      ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'], ['#43e97b', '#38f9d7']
    ];

    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    const [c1, c2] = colors[idx];

    return `background: linear-gradient(135deg, ${c1} 0%, ${c2} 100%);`;
  }

  function initServicesView(user) {
    const select = document.getElementById('res-asset-sel');
    const form = document.getElementById('form-reserva-asset');
    const list = document.getElementById('biblio-reservas-list');

    BiblioAssetsService.streamAssets(_ctx, assets => {
      if (!select) return;
      select.innerHTML = '<option value="" selected disabled>Selecciona...</option>' +
        assets.filter(a => a.tipo !== 'mesa')
          .map(a => `<option value="${a.id}">${a.nombre} (${a.tipo.toUpperCase()})</option>`).join('');
    });

    BiblioAssetsService.streamMyReservations(_ctx, user.uid, reservas => {
      if (!list) return;
      if (reservas.length === 0) { list.innerHTML = '<div class="p-4 text-center text-muted small">No tienes reservas próximas.</div>'; return; }

      list.innerHTML = reservas.map(r => `
            <div class="list-group-item d-flex justify-content-between align-items-center p-3">
                <div>
                    <div class="fw-bold text-dark">${r.assetName}</div>
                    <div class="small text-muted"><i class="bi bi-calendar me-1"></i>${r.date} <i class="bi bi-clock ms-2 me-1"></i>${r.hourBlock}</div>
                </div>
                <button class="btn btn-sm btn-outline-danger" onclick="Biblio.cancelReserva('${r.id}')">Cancelar</button>
            </div>
          `).join('');
    });

    form?.addEventListener('submit', async e => {
      e.preventDefault();
      const assetId = select.value;
      const date = document.getElementById('res-date').value;
      const hour = document.getElementById('res-hour').value;
      if (!assetId || !date) return showToast('Completa los campos', 'warning');

      try {
        await BiblioAssetsService.reserveAsset(_ctx, {
          assetId, date, hourBlock: hour,
          studentId: user.uid,
          studentName: _ctx.currentUserProfile.displayName || user.email
        });
        showToast('Reserva confirmada', 'success');
        select.value = '';
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }

  async function initDigitalView() {
    const grid = document.getElementById('biblio-digital-grid');
    if (!grid) return;
    const books = await BiblioService.getDigitalBooks();

    grid.innerHTML = books.map(b => `
        <div class="col-sm-6 col-md-4 col-lg-3">
            <div class="card h-100 border-0 shadow-sm hover-lift">
                <div class="card-body text-center">
                    <div class="mb-3 rounded-3 bg-light d-flex align-items-center justify-content-center" style="height:120px;">
                        <i class="bi bi-file-earmark-pdf display-4 text-danger opacity-50"></i>
                    </div>
                    <h6 class="fw-bold text-truncate mb-1" title="${b.titulo}">${b.titulo}</h6>
                    <p class="small text-muted mb-3">${b.autor}</p>
                    <a href="${b.url}" class="btn btn-sm btn-outline-primary w-100 stretched-link"><i class="bi bi-download me-1"></i> Descargar</a>
                </div>
            </div>
        </div>
      `).join('');
  }

  async function initProfileView(user) {
    const list = document.getElementById('biblio-logros-list');
    const statRead = document.getElementById('stat-books-read');
    const badgeLevel = document.getElementById('biblio-user-level');

    if (!list) return;

    const { totalLeidos, logros } = await BiblioService.checkAchievements(_ctx, user.uid);

    if (statRead) statRead.textContent = totalLeidos;

    const nivel = Math.floor(totalLeidos / 3) + 1;
    if (badgeLevel) badgeLevel.textContent = `Nivel ${nivel} - Lector`;

    if (logros.length === 0) {
      list.innerHTML = '<div class="col-12 text-center text-muted py-4">Devuelve tu primer libro para desbloquear logros.</div>';
    } else {
      list.innerHTML = logros.map(l => `
            <div class="col-md-6">
                <div class="d-flex align-items-center p-3 border rounded-3 bg-light h-100">
                    <div class="text-warning fs-3 me-3"><i class="bi ${l.icon}"></i></div>
                    <div>
                        <div class="fw-bold text-dark">${l.title}</div>
                        <div class="small text-muted">${l.desc}</div>
                    </div>
                </div>
            </div>
          `).join('');
    }
  }

  // Helper público para cancelar
  function cancelReserva(id) {
    if (!confirm('¿Cancelar reserva?')) return;
    BiblioAssetsService.cancelReservation(_ctx, id)
      .then(() => showToast('Reserva cancelada', 'info'))
      .catch(() => showToast('Error', 'danger'));
  }

  // --- Renders Student Helpers ---
  function renderMisPrestamos(container, arr) {
    if (!arr || arr.length === 0) {
      container.innerHTML = '<p class="text-muted p-3 small text-center">No tienes préstamos activos.</p>'; return;
    }
    let html = `<table class="table table-hover align-middle small mb-0"><thead class="table-light">
      <tr><th>Libro</th><th>Estado</th></tr></thead><tbody>`;
    arr.forEach(p => {
      const f = p.fechaSolicitud?.toDate().toLocaleDateString() ?? '—';
      let badge = 'bg-secondary', label = p.estado;
      if (p.estado === 'pendiente') { badge = 'bg-warning text-dark'; label = 'Solicitado'; }
      else if (p.estado === 'aprobado') { badge = 'bg-info text-dark'; label = 'Por recoger'; }
      else if (p.estado === 'entregado') { badge = 'bg-success'; label = 'En uso'; }
      else if (p.estado === 'rechazado') { badge = 'bg-danger'; }

      html += `<tr>
        <td><div class="fw-bold text-truncate" style="max-width: 140px;">${p.tituloLibro}</div><div class="text-muted extra-small">${f}</div></td>
        <td><span class="badge ${badge}">${label}</span></td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function renderCatalogo(container, docs) {
    if (docs.length === 0) { container.innerHTML = '<p class="text-muted p-3 text-center">Catálogo vacío.</p>'; return; }

    const solicitados = _currentStudentPrestamos
      .filter(p => ['pendiente', 'aprobado', 'entregado'].includes(p.estado))
      .map(p => p.libroId);

    container.innerHTML = docs.map(doc => {
      const l = doc.data(); const id = doc.id;
      const copias = Number(l.copiasDisponibles) || 0;
      const isSolic = solicitados.includes(id);

      let btn = '';
      if (isSolic) btn = `<button class="btn btn-light btn-sm border text-muted" disabled><i class="bi bi-check2 me-1"></i>Solicitado</button>`;
      else if (copias > 0) btn = `<button class="btn btn-outline-primary btn-sm fw-bold" onclick="Biblio.solicitarLibro('${id}','${(l.titulo || '').replace(/'/g, "\\'")}')"><i class="bi bi-bag-plus me-1"></i>Apartar</button>`;
      else btn = `<span class="badge bg-secondary-subtle text-secondary">Agotado</span>`;

      return `
        <div class="list-group-item list-group-item-action d-flex flex-column biblio-libro-item p-3" data-title="${BiblioService.norm(l.titulo)}" data-author="${BiblioService.norm(l.autor)}">
            <div class="d-flex w-100 justify-content-between align-items-start mb-2">
                <div><h6 class="mb-1 fw-bold text-dark">${l.titulo}</h6><p class="mb-0 small text-muted"><i class="bi bi-person me-1"></i>${l.autor || 'Autor desconocido'}</p></div>
                <div class="text-end">${copias > 0 ? `<span class="badge bg-success-subtle text-success border border-success-subtle">${copias} disp.</span>` : `<span class="badge bg-danger-subtle text-danger">0 disp.</span>`}</div>
            </div>
            <div class="mt-2 d-flex justify-content-end">${btn}</div>
        </div>`;
    }).join('');
  }

  async function solicitarLibro(libroId, titulo) {
    const user = _ctx.auth.currentUser;
    
    // Validación robusta contra la lista en memoria
    // Busca si YA existe un préstamo activo (pendiente, aprobado, entregado) para este libro
    const activo = _currentStudentPrestamos.find(p => 
        p.libroId === libroId && 
        ['pendiente', 'aprobado', 'entregado'].includes(p.estado)
    );

    if (activo) { 
        showToast(`Ya tienes una solicitud activa para: ${titulo}`, 'warning'); 
        return; 
    }

    try {
      await BiblioService.solicitarLibro(_ctx, { user, libroId, titulo });
      showToast('¡Libro apartado! Tienes 24h para recogerlo.', 'success');
      
      // Cerrar modal si está abierto
      if(_bookModal) _bookModal.hide();

      if (window.Notify) {
        window.Notify.send(user.uid, { title: 'Apartado Confirmado', message: `Has apartado "${titulo}".`, type: 'biblio', link: '/biblio' });
      }
    } catch (e) { 
        console.error(e); 
        showToast('Error al solicitar. Verifica tu conexión.', 'danger'); 
    }
  }

  // ========== ADMIN ==========
  function initAdmin(ctx) {
    _ctx = ctx;
    const listPend = document.getElementById('biblio-adm-prestamos-pend');
    const listAprob = document.getElementById('biblio-adm-prestamos-aprob');
    const listEntr = document.getElementById('biblio-adm-prestamos-entreg');
    const formNew = document.getElementById('form-biblio-nuevo-libro');
    const invTable = document.getElementById('biblio-adm-inventario');

    const uPend = BiblioService.streamPrestamosByState(_ctx, 'pendiente', docs => renderPrestamos(listPend, docs, 'pend'));
    const uAprob = BiblioService.streamPrestamosByState(_ctx, 'aprobado', docs => renderPrestamos(listAprob, docs, 'aprob'));
    const uEntr = BiblioService.streamPrestamosByState(_ctx, 'entregado', docs => renderPrestamos(listEntr, docs, 'entregado'));

    const uInv = BiblioService.streamCatalogo(_ctx,
      docs => renderInventario(invTable, docs),
      err => console.error(err)
    );

    formNew?.addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const data = {
        titulo: f.elements['biblio-titulo'].value,
        autor: f.elements['biblio-autor'].value,
        isbn: (f.elements['biblio-isbn'].value || '').trim(),
        add: Number(f.elements['biblio-copias'].value) || 0
      };
      try {
        const res = await BiblioService.addOrUpdateLibro(_ctx, data);
        showToast(res.action === 'updated' ? 'Stock actualizado' : 'Libro añadido', 'success');
        f.reset();
      } catch (e) { showToast('Error al guardar', 'danger'); }
    });

    _ctx.activeUnsubs.push(uPend, uAprob, uEntr, uInv);
    initServicesAdmin(ctx);
  }

  function initServicesAdmin(ctx) {
    const grid = document.getElementById('biblio-assets-grid');
    const panel = document.getElementById('asset-control-panel');
    const form = document.getElementById('form-biblio-asset');

    BiblioAssetsService.streamAssets(ctx, (assets) => {
      if (!grid) return;
      if (assets.length === 0) {
        grid.innerHTML = '<div class="p-5 text-center text-muted w-100">No hay activos registrados.</div>';
        return;
      }

      grid.innerHTML = assets.map(a => {
        const isLocked = a.estado === 'locked';
        const statusColor = isLocked ? 'bg-danger' : 'bg-success';
        const icon = a.tipo === 'pc' ? 'bi-pc-display' : a.tipo === 'sala' ? 'bi-people-fill' : 'bi-square-fill';
        const statusText = isLocked ? 'Bloqueado' : `En uso: ${a.currentUser || 'Anon'}`;

        let timeInfo = '';
        if (!isLocked && a.unlockUntil) {
          const left = Math.ceil((a.unlockUntil.toDate() - new Date()) / 60000);
          timeInfo = `<span class="badge bg-light text-dark border mt-1">${left} min restantes</span>`;
        }

        return `
                  <div class="col-md-4 col-lg-3 p-2">
                      <div class="card h-100 border ${isLocked ? 'border-danger-subtle' : 'border-success-subtle'} shadow-sm asset-card" 
                           style="cursor:pointer;" onclick="Biblio.selectAsset('${a.id}', '${a.nombre}', '${a.estado}')">
                          <div class="card-body text-center p-3">
                              <div class="position-absolute top-0 end-0 p-2">
                                  <span class="badge ${statusColor} rounded-circle p-1"><span class="visually-hidden">Status</span></span>
                              </div>
                              <i class="bi ${icon} fs-1 ${isLocked ? 'text-secondary opacity-50' : 'text-primary'}"></i>
                              <h6 class="fw-bold mt-2 mb-1 text-truncate">${a.nombre}</h6>
                              <div class="small text-muted font-monospace">${a.id}</div>
                              <div class="small ${isLocked ? 'text-danger' : 'text-success'} fw-bold mt-1">${statusText}</div>
                              ${timeInfo}
                          </div>
                      </div>
                  </div>
              `;
      }).join('');
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('asset-id').value.trim().toUpperCase();
      const tipo = document.getElementById('asset-type').value;
      const nombre = document.getElementById('asset-name').value.trim();

      try {
        await BiblioAssetsService.createAsset(ctx, { id, tipo, nombre });
        showToast('Activo creado', 'success');
        form.reset();
      } catch (e) { showToast('Error al crear', 'danger'); }
    });

    document.getElementById('btn-force-lock')?.addEventListener('click', () => {
      if (_selectedAssetId) BiblioAssetsService.lockAsset(ctx, _selectedAssetId);
    });

    document.getElementById('btn-delete-asset')?.addEventListener('click', () => {
      if (_selectedAssetId && confirm('¿Eliminar activo?')) {
        BiblioAssetsService.deleteAsset(ctx, _selectedAssetId);
        panel.classList.add('d-none');
      }
    });

    document.getElementById('btn-unlock-custom')?.addEventListener('click', () => {
      if (!_selectedAssetId) return;
      const user = document.getElementById('ctrl-user-label').value || 'Manual';
      BiblioAssetsService.unlockAsset(ctx, _selectedAssetId, 60, user);
    });
  }

  function selectAsset(id, name, status) {
    _selectedAssetId = id;
    const panel = document.getElementById('asset-control-panel');
    if (panel) {
      panel.classList.remove('d-none');
      document.getElementById('ctrl-asset-name').textContent = name;
      document.getElementById('ctrl-asset-status').textContent = `ID: ${id} • Estado: ${status}`;
    }
  }

  function quickUnlock(mins) {
    if (!_selectedAssetId || !_ctx) return;
    const user = document.getElementById('ctrl-user-label')?.value || 'Quick Access';
    BiblioAssetsService.unlockAsset(_ctx, _selectedAssetId, mins, user);
  }

  function renderPrestamos(container, docs, fase) {
    if (docs.length === 0) { 
        container.innerHTML = '<div class="p-5 text-center text-muted bg-light rounded-3"><i class="bi bi-inbox fs-1 d-block mb-3 opacity-25"></i>Sin registros en esta etapa.</div>'; 
        return; 
    }

    let html = `<div class="table-responsive"><table class="table table-hover align-middle"><thead class="table-light"><tr>
      <th>Usuario</th><th>Libro</th><th>Fecha</th><th class="text-end">Acción</th></tr></thead><tbody>`;
    
    docs.forEach(d => {
      const p = d.data(); 
      const id = d.id;
      const fecha = p.fechaSolicitud ? p.fechaSolicitud.toDate().toLocaleString() : '—';
      
      let actions = '';
      if (fase === 'pend') {
        actions = `<button class="btn btn-success btn-sm" onclick="Biblio.aprobarPrestamo('${id}')" title="Aprobar"><i class="bi bi-check-lg"></i></button>
                   <button class="btn btn-danger btn-sm ms-1" onclick="Biblio.rechazarPrestamo('${id}')" title="Rechazar"><i class="bi bi-x-lg"></i></button>`;
      } else if (fase === 'aprob') {
        actions = `<button class="btn btn-primary btn-sm" onclick="Biblio.entregarPrestamo('${id}','${p.libroId}')"><i class="bi bi-box-arrow-right me-1"></i>Entregar</button>`;
      } else {
        actions = `<button class="btn btn-outline-success btn-sm" onclick="Biblio.devolverPrestamo('${id}','${p.libroId}')"><i class="bi bi-box-arrow-in-left me-1"></i>Recibir</button>`;
      }

      html += `<tr>
        <td>
            <div class="fw-bold text-dark">${p.studentEmail.split('@')[0]}</div>
            <div class="small text-muted">${p.studentEmail}</div>
        </td>
        <td class="fw-semibold text-primary">${p.tituloLibro}</td>
        <td class="small text-muted">${fecha}</td>
        <td class="text-end">${actions}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
  }

  function renderInventario(container, docs) {
    if (docs.length === 0) { container.innerHTML = ''; return; }
    let html = `<table class="table table-sm table-hover align-middle"><thead class="table-light">
      <tr><th>Título</th><th>Stock</th><th></th></tr></thead><tbody>`;
    docs.forEach(doc => {
      const l = doc.data();
      html += `<tr><td>${l.titulo}</td><td>${l.copiasDisponibles}</td>
          <td class="text-end"><button class="btn btn-link text-danger btn-sm p-0" onclick="Biblio.eliminarLibro('${doc.id}')"><i class="bi bi-trash"></i></button></td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // --- Acciones Admin Wrappers ---
  async function aprobarPrestamo(id) { try { await BiblioService.aprobarPrestamo(_ctx, id); showToast('Aprobado', 'success'); } catch (e) { showToast('Error', 'danger'); } }
  async function rechazarPrestamo(id) { if (!confirm('¿Rechazar?')) return; try { await BiblioService.rechazarPrestamo(_ctx, id); showToast('Rechazado', 'info'); } catch (e) { showToast('Error', 'danger'); } }
  async function entregarPrestamo(pid, lid) { try { await BiblioService.entregarPrestamo(_ctx, pid, lid); showToast('Entregado', 'success'); } catch (e) { showToast(e.message, 'danger'); } }
  async function devolverPrestamo(pid, lid) { try { await BiblioService.devolverPrestamo(_ctx, pid, lid); showToast('Devuelto', 'success'); } catch (e) { showToast('Error', 'danger'); } }
  async function eliminarLibro(id) { if (!confirm('¿Borrar?')) return; try { await BiblioService.eliminarLibro(_ctx, id); showToast('Eliminado', 'info'); } catch (e) { showToast('Error', 'danger'); } }

  // ========== SUPER ADMIN (IoT Dashboard) ==========
  async function initSuperAdmin(ctx) {
    _ctx = ctx;
    try {
      const stats = await BiblioService.getFirebaseStats(_ctx);
      const kpiTotal = document.getElementById('biblio-sa-total');
      if (kpiTotal) kpiTotal.textContent = stats.totalLibros;

      const uAll = BiblioService.streamAllPrestamos(_ctx, 50, snap => {
        renderSuperAdminList(snap);
      });
      _ctx.activeUnsubs.push(uAll);
    } catch (e) { console.error(e); }

    setupBiblopControls();
    updateBiblopData();
    if (_biblopInterval) clearInterval(_biblopInterval);
    _biblopInterval = setInterval(updateBiblopData, 15000);
  }

  function renderSuperAdminList(snap) {
    const listEl = document.getElementById('biblio-sa-list');
    const kpiActivos = document.getElementById('biblio-sa-activos');
    const kpiVencidos = document.getElementById('biblio-sa-vencidos');
    let activos = 0, vencidos = 0;

    let html = `<table class="table table-hover align-middle small"><thead class="table-light">
          <tr><th>Fecha</th><th>Alumno</th><th>Libro</th><th>Estado</th></tr></thead><tbody>`;

    snap.forEach(d => {
      const p = d.data();
      if (['pendiente', 'aprobado', 'entregado'].includes(p.estado)) activos++;
      if (p.estado === 'entregado' && p.fechaEntrega) {
        const diff = (new Date() - p.fechaEntrega.toDate()) / (86400000);
        if (diff > 15) vencidos++;
      }
      const badge = p.estado === 'entregado' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary';
      html += `<tr><td>${p.fechaSolicitud?.toDate().toLocaleDateString() || '-'}</td><td>${p.studentEmail}</td><td class="fw-bold">${p.tituloLibro}</td><td><span class="badge ${badge}">${p.estado}</span></td></tr>`;
    });
    html += '</tbody></table>';
    if (listEl) listEl.innerHTML = html;
    if (kpiActivos) kpiActivos.textContent = activos;
    if (kpiVencidos) kpiVencidos.textContent = vencidos;
  }

  function setupBiblopControls() {
    const rangeSel = document.getElementById('biblop-range');
    const refreshBtn = document.getElementById('biblop-refresh-btn');
    if (rangeSel) {
      const newSel = rangeSel.cloneNode(true);
      rangeSel.parentNode.replaceChild(newSel, rangeSel);
      newSel.addEventListener('change', updateBiblopData);
    }
    if (refreshBtn) {
      const newBtn = refreshBtn.cloneNode(true);
      refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);
      newBtn.addEventListener('click', updateBiblopData);
    }
  }

  async function updateBiblopData() {
    const rangeVal = document.getElementById('biblop-range')?.value || '24h';
    const updateLabel = document.getElementById('biblop-last-update');
    if (updateLabel) updateLabel.textContent = 'Actualizando...';

    try {
      const json = await BiblioService.fetchBiblopData();
      const rawRows = (json.rows || json.data || []);
      const rows = rawRows.map(r => ({
        date: new Date(r.ts),
        entro: Number(r.entro) || 0, salio: Number(r.salio) || 0,
        cr: Number(r.cr) || 0, sala: Number(r.sala) || 0, info: Number(r.info) || 0,
        id: r.id || ''
      })).filter(r => !isNaN(r.date));

      processAndRenderBiblop(rows, rangeVal);
      if (updateLabel) updateLabel.textContent = 'Act: ' + new Date().toLocaleTimeString();
    } catch (e) {
      console.error("BiBlop Error:", e);
      if (updateLabel) updateLabel.textContent = 'Error de conexión';
    }
  }

  function processAndRenderBiblop(rows, rangeKey) {
    const now = Date.now();
    let ms = 0;
    if (rangeKey === '1h') ms = 3600000;
    else if (rangeKey === '6h') ms = 6 * 3600000;
    else if (rangeKey === '24h') ms = 24 * 3600000;
    else if (rangeKey === '7d') ms = 7 * 86400000;
    else if (rangeKey === '30d') ms = 30 * 86400000;
    const cutoff = ms > 0 ? now - ms : 0;
    rows.sort((a, b) => a.date - b.date);
    const filtered = rows.filter(r => r.date.getTime() >= cutoff);

    const kEntro = filtered.reduce((s, r) => s + r.entro, 0);
    const kSalio = filtered.reduce((s, r) => s + r.salio, 0);
    const inside = Math.max(0, kEntro - kSalio);
    const ratio = kEntro ? Math.round((kSalio / kEntro) * 100) : 0;
    setText('biblop-kpi-entro', kEntro);
    setText('biblop-kpi-salio', kSalio);
    setText('biblop-kpi-inside', inside);
    setText('biblop-kpi-ratio', ratio + '%');
  }

  function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

  return {
    initStudent,
    initAdmin,
    initSuperAdmin,
    selectAsset,
    quickUnlock,
    cancelReserva,
    aprobarPrestamo,  // Local function directly
    solicitarLibro,   // Local function directly
    rechazarPrestamo,
    entregarPrestamo,
    devolverPrestamo,
    eliminarLibro,
    openBookDetail,
  };
})();