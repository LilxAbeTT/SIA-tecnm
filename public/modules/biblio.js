// modules/biblio.js
// Catálogo, préstamos y flujo completo (aprobar → entregar → devolver)

const Biblio = (function () {
  const CAT_COLL = 'biblio-catalogo';
  const PRES_COLL = 'prestamos-biblio';

  let _ctx = null;
  let _currentStudentPrestamos = [];
  let _chFlow = null;
  let _chServ = null;
  let _biblopInterval = null;
let _chOccupancy = null; // Nueva gráfica
  // Configuración API Google Script
  const API_URL = "https://script.google.com/macros/s/AKfycbz4Wy-pzC7nCjnK6TLg5WgxWNEPEJ_lzOVlm1n-boQX49UQZQSB1WG3ITxChME6NIS9Wg/exec";
  // ---------- helpers ----------
  const norm = s => (s || '').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quita acentos

  // ========== STUDENT ==========
  async function initStudent(ctx) {
    _ctx = ctx;

    const searchForm = document.getElementById('biblio-stu-search-form');
    const searchInput = document.getElementById('biblio-stu-search-input');
    const searchResult = document.getElementById('biblio-stu-search-results');
    const misPrestamos = document.getElementById('biblio-stu-prestamos');

    const u1 = _ctx.db.collection(PRES_COLL)
      .where('studentId', '==', _ctx.auth.currentUser.uid)
      .orderBy('fechaSolicitud', 'desc')
      .onSnapshot(snap => {
        _currentStudentPrestamos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderMisPrestamos(misPrestamos, _currentStudentPrestamos);
      }, _ => {
        misPrestamos.innerHTML = '<p class="text-danger p-3">Error al cargar préstamos.</p>';
      });

    _ctx.db.collection(CAT_COLL).orderBy('titulo', 'asc').onSnapshot(snap => {
      renderCatalogo(searchResult, snap.docs);
    }, _ => {
      searchResult.innerHTML = '<p class="text-danger p-3">Error al cargar catálogo.</p>';
    });

    searchForm.addEventListener('submit', e => e.preventDefault());
    searchInput.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      const items = searchResult.querySelectorAll('.biblio-libro-item');
      items.forEach(it => {
        const ok = (it.dataset.title || '').includes(q) || (it.dataset.author || '').includes(q);
        it.classList.toggle('d-none', !ok);
      });
    });

    _ctx.activeUnsubs.push(u1);
  }

  function renderMisPrestamos(container, arr) {
    if (!arr || arr.length === 0) {
      container.innerHTML = '<p class="text-muted p-3">Aún no tienes préstamos.</p>'; return;
    }
    let html = `<table class="table table-hover align-middle"><thead class="table-light">
      <tr><th>Libro</th><th>Solicitado</th><th>Estado</th></tr></thead><tbody>`;
    arr.forEach(p => {
      const f = p.fechaSolicitud?.toDate().toLocaleDateString() ?? '—';
      const est = p.estado === 'pendiente' ? `<span class="badge" style="background-color:var(--biblio);color:#0A2540;">Pendiente</span>`
        : p.estado === 'aprobado' ? `<span class="badge bg-info text-dark">Aprobado</span>`
          : p.estado === 'entregado' ? `<span class="badge bg-success">En uso</span>`
            : p.estado === 'devuelto' ? `<span class="badge bg-secondary">Devuelto</span>`
              : p.estado === 'rechazado' ? `<span class="badge bg-danger">Rechazado</span>`
                : `<span class="badge bg-secondary">${p.estado}</span>`;
      html += `<tr><td>${p.tituloLibro}</td><td>${f}</td><td>${est}</td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function renderCatalogo(container, libros) {
    if (libros.length === 0) { container.innerHTML = '<p class="text-muted p-3">No hay libros.</p>'; return; }

    const solicitados = _currentStudentPrestamos
      .filter(p => ['pendiente', 'aprobado', 'entregado'].includes(p.estado))
      .map(p => p.libroId);

    container.innerHTML = libros.map(doc => {
      const l = doc.data(); const id = doc.id;
      const copias = Number(l.copiasDisponibles) || 0;
      const isSolic = solicitados.includes(id);
      const btn = copias > 0
        ? `<button class="btn btn-primary btn-sm" onclick="Biblio.solicitarLibro('${id}','${(l.titulo || '').replace(/'/g, "\\'")}')" ${isSolic ? 'disabled' : ''}>${isSolic ? 'Solicitado' : 'Solicitar'}</button>`
        : `<span class="badge bg-secondary">Agotado</span>`;
      return `<div class="list-group-item list-group-item-action d-flex flex-column biblio-libro-item" data-title="${norm(l.titulo)}" data-author="${norm(l.autor)}">
        <div class="d-flex w-100 justify-content-between"><h6 class="mb-1">${l.titulo}</h6><small class="text-muted">Copias: ${copias}</small></div>
        <p class="mb-2 small">${l.autor || 'Sin autor'}</p>${btn}</div>`;
    }).join('');
  }

  async function solicitarLibro(libroId, titulo) {
    const user = _ctx.auth.currentUser; if (!user) return;
    const activo = _currentStudentPrestamos.some(p => p.libroId === libroId && ['pendiente', 'aprobado', 'entregado'].includes(p.estado));
    if (activo) { showToast('Ya tienes una solicitud/uso activo de este libro', 'warning'); return; }

    const nuevo = {
      studentId: user.uid, studentEmail: user.email,
      libroId, tituloLibro: titulo,
      fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
      estado: 'pendiente'
    };
    try {
      await _ctx.db.collection(PRES_COLL).add(nuevo);
      showToast('¡Préstamo solicitado!', 'success');
    } catch { showToast('Error al solicitar', 'danger'); }
  }

  // ========== ADMIN ==========
  function initAdmin(ctx) {
    _ctx = ctx;

    const listPend = document.getElementById('biblio-adm-prestamos-pend');
    const listAprob = document.getElementById('biblio-adm-prestamos-aprob');
    const listEntr = document.getElementById('biblio-adm-prestamos-entreg');
    const formNew = document.getElementById('form-biblio-nuevo-libro');
    const invTable = document.getElementById('biblio-adm-inventario');

    // Suscripciones de préstamos por estado (sin orderBy para evitar índices extra)
    const uPend = _ctx.db.collection(PRES_COLL).where('estado', '==', 'pendiente')
      .onSnapshot(snap => { renderPrestamos(listPend, snap.docs, 'pend'); }, _ => { listPend.innerHTML = '<p class="text-danger p-3">Error</p>'; });

    const uAprob = _ctx.db.collection(PRES_COLL).where('estado', '==', 'aprobado')
      .onSnapshot(snap => { renderPrestamos(listAprob, snap.docs, 'aprob'); }, _ => { listAprob.innerHTML = '<p class="text-danger p-3">Error</p>'; });

    const uEntr = _ctx.db.collection(PRES_COLL).where('estado', '==', 'entregado')
      .onSnapshot(snap => { renderPrestamos(listEntr, snap.docs, 'entregado'); }, _ => { listEntr.innerHTML = '<p class="text-danger p-3">Error</p>'; });

    const uInv = _ctx.db.collection(CAT_COLL).orderBy('titulo', 'asc')
      .onSnapshot(snap => { renderInventario(invTable, snap.docs); }, _ => { invTable.innerHTML = '<p class="text-danger p-3">Error</p>'; });

    // Alta/actualización de stock sin duplicar registros
    formNew.addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const titulo = f.elements['biblio-titulo'].value;
      const autor = f.elements['biblio-autor'].value;
      const isbn = (f.elements['biblio-isbn'].value || '').trim();
      const add = Number(f.elements['biblio-copias'].value) || 0;

      const tituloSearch = norm(titulo);
      const autorSearch = norm(autor);

      try {
        // Buscar existente por ISBN o por título+autor
        let existing = null;
        if (isbn) {
          const q = await _ctx.db.collection(CAT_COLL).where('isbn', '==', isbn).limit(1).get();
          if (!q.empty) existing = { id: q.docs[0].id, data: q.docs[0].data() };
        }
        if (!existing) {
          const q2 = await _ctx.db.collection(CAT_COLL).where('tituloSearch', '==', tituloSearch).limit(20).get();
          q2.forEach(d => { if (!existing && norm(d.data().autor) === autorSearch) existing = { id: d.id, data: d.data() }; });
        }

        if (existing) {
          // Sumar stock
          const ref = _ctx.db.collection(CAT_COLL).doc(existing.id);
          await _ctx.db.runTransaction(async tx => {
            const snap = await tx.get(ref);
            const prev = Number(snap.data().copiasDisponibles) || 0;
            tx.update(ref, { copiasDisponibles: prev + add });
          });
          showToast('Stock actualizado', 'success');
        } else {
          // Crear nuevo
          await _ctx.db.collection(CAT_COLL).add({
            titulo, autor, isbn: isbn || null,
            tituloSearch, autorSearch,
            copiasDisponibles: add,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          showToast('Libro añadido', 'success');
        }
        f.reset();
      } catch (err) { console.error(err); showToast('Error al guardar', 'danger'); }
    });

    _ctx.activeUnsubs.push(uPend, uAprob, uEntr, uInv);
  }

  function renderPrestamos(container, docs, fase) {
    if (docs.length === 0) { container.innerHTML = '<p class="text-muted p-3">Sin resultados</p>'; return; }
    let html = `<table class="table table-hover align-middle"><thead class="table-light"><tr>
      <th>Estudiante</th><th>Libro</th><th>Solicitado</th><th class="text-end">Acciones</th></tr></thead><tbody>`;
    docs.forEach(d => {
      const p = d.data(); const id = d.id;
      const f = p.fechaSolicitud?.toDate().toLocaleDateString() ?? '—';
      let actions = '';
      if (fase === 'pend') {
        actions = `<button class="btn btn-success btn-sm" onclick="Biblio.aprobarPrestamo('${id}')"><i class="bi bi-check-lg"></i> Aprobar</button>
                   <button class="btn btn-danger btn-sm ms-2" onclick="Biblio.rechazarPrestamo('${id}')"><i class="bi bi-x-lg"></i> Rechazar</button>`;
      } else if (fase === 'aprob') {
        actions = `<button class="btn btn-primary btn-sm" onclick="Biblio.entregarPrestamo('${id}','${p.libroId}')"><i class="bi bi-box-arrow-down"></i> Entregar</button>`;
      } else {
        const venc = p.fechaVencimiento?.toDate().toLocaleDateString() ?? '—';
        actions = `<span class="me-3 small text-muted">Vence: ${venc}</span>
                   <button class="btn btn-outline-success btn-sm" onclick="Biblio.devolverPrestamo('${id}','${p.libroId}')"><i class="bi bi-box-arrow-in-down"></i> Devolver</button>`;
      }
      html += `<tr><td>${p.studentEmail}</td><td>${p.tituloLibro}</td><td>${f}</td><td class="text-end">${actions}</td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function renderInventario(container, docs) {
    if (docs.length === 0) { container.innerHTML = '<p class="text-muted p-3">No hay libros</p>'; return; }
    let html = `<table class="table table-hover align-middle"><thead class="table-light">
      <tr><th>Título</th><th>Autor</th><th>Copias</th><th class="text-end">Acciones</th></tr></thead><tbody>`;
    docs.forEach(doc => {
      const l = doc.data(); const id = doc.id;
      html += `<tr><td>${l.titulo}</td><td>${l.autor || '—'}</td><td>${l.copiasDisponibles || 0}</td>
        <td class="text-end"><button class="btn btn-outline-danger btn-sm" onclick="Biblio.eliminarLibro('${id}')"><i class="bi bi-trash"></i></button></td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ========== Acciones admin ==========
  async function aprobarPrestamo(prestamoId) {
    if (!confirm('¿Aprobar este préstamo?')) return;
    try {
      await _ctx.db.collection(PRES_COLL).doc(prestamoId).update({
        estado: 'aprobado', fechaAprobacion: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('Préstamo aprobado', 'success');
    } catch { showToast('Error', 'danger'); }
  }
  async function rechazarPrestamo(prestamoId) {
    if (!confirm('¿Rechazar este préstamo?')) return;
    try {
      await _ctx.db.collection(PRES_COLL).doc(prestamoId).update({ estado: 'rechazado' });
      showToast('Préstamo rechazado', 'info');
    } catch { showToast('Error', 'danger'); }
  }
  async function entregarPrestamo(prestamoId, libroId) {
    if (!confirm('Confirmar entrega al alumno?')) return;
    const catRef = _ctx.db.collection(CAT_COLL).doc(libroId);
    const presRef = _ctx.db.collection(PRES_COLL).doc(prestamoId);
    try {
      await _ctx.db.runTransaction(async tx => {
        const cat = await tx.get(catRef); if (!cat.exists) throw new Error('Libro inexistente');
        const disp = Number(cat.data().copiasDisponibles) || 0;
        if (disp <= 0) throw new Error('Sin copias disponibles');
        tx.update(catRef, { copiasDisponibles: disp - 1 });
        const venc = new Date(); venc.setDate(venc.getDate() + 14);
        tx.update(presRef, {
          estado: 'entregado',
          fechaEntrega: firebase.firestore.FieldValue.serverTimestamp(),
          fechaVencimiento: firebase.firestore.Timestamp.fromDate(venc)
        });
      });
      showToast('Entrega registrada', 'success');
    } catch (err) { showToast(err.message || 'Error', 'danger'); }
  }
  async function devolverPrestamo(prestamoId, libroId) {
    if (!confirm('Marcar como devuelto?')) return;
    const catRef = _ctx.db.collection(CAT_COLL).doc(libroId);
    const presRef = _ctx.db.collection(PRES_COLL).doc(prestamoId);
    try {
      await _ctx.db.runTransaction(async tx => {
        const cat = await tx.get(catRef); if (!cat.exists) throw new Error('Libro inexistente');
        const disp = Number(cat.data().copiasDisponibles) || 0;
        tx.update(catRef, { copiasDisponibles: disp + 1 });
        tx.update(presRef, { estado: 'devuelto', fechaDevolucion: firebase.firestore.FieldValue.serverTimestamp() });
      });
      showToast('Devuelto correctamente', 'success');
    } catch { showToast('Error', 'danger'); }
  }
  async function eliminarLibro(libroId) {
    if (!confirm('¿Eliminar libro del catálogo?')) return;
    try { await _ctx.db.collection(CAT_COLL).doc(libroId).delete(); showToast('Libro eliminado', 'success'); }
    catch { showToast('Error', 'danger'); }
  }

  async function initSuperAdmin(ctx) {
    _ctx = ctx;

    // 1. Cargar datos de Firebase (Inventario y Préstamos) - Mantenemos lo de la fase anterior
    loadFirebaseStats();

    // 2. Iniciar BiBlop (Dashboard IoT)
    setupBiblopControls();
    fetchBiblopData(); // Primera carga

    // Auto-refresh cada 15s
    if (_biblopInterval) clearInterval(_biblopInterval);
    _biblopInterval = setInterval(fetchBiblopData, 15000);
  }

  // --- Lógica Firebase (Fase anterior) ---
  async function loadFirebaseStats() {
    const listEl = document.getElementById('biblio-sa-list');
    const kpiTotal = document.getElementById('biblio-sa-total');
    const kpiActivos = document.getElementById('biblio-sa-activos');
    const kpiVencidos = document.getElementById('biblio-sa-vencidos');

    try {
      const catSnap = await _ctx.db.collection(CAT_COLL).get();
      let totalLibros = 0;
      catSnap.forEach(d => totalLibros += (Number(d.data().copiasDisponibles) || 0));
      if (kpiTotal) kpiTotal.textContent = totalLibros;

      // Suscripción a préstamos
      _ctx.db.collection(PRES_COLL).orderBy('fechaSolicitud', 'desc').limit(50).onSnapshot(snap => {
        let activos = 0;
        let vencidos = 0;
        let html = `<table class="table table-hover align-middle small"><thead class="table-light">
            <tr><th>Fecha</th><th>Alumno</th><th>Libro</th><th>Estado</th></tr></thead><tbody>`;

        snap.forEach(d => {
          const p = d.data();
          const fecha = p.fechaSolicitud?.toDate().toLocaleDateString() || '-';
          if (['pendiente', 'aprobado', 'entregado'].includes(p.estado)) activos++;
          if (p.estado === 'entregado' && p.fechaEntrega) {
            const diff = (new Date() - p.fechaEntrega.toDate()) / (1000 * 3600 * 24);
            if (diff > 15) vencidos++;
          }
          const badgeClass = p.estado === 'entregado' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary';
          html += `<tr><td>${fecha}</td><td>${p.studentEmail}</td><td class="fw-bold">${p.tituloLibro}</td><td><span class="badge ${badgeClass}">${p.estado}</span></td></tr>`;
        });
        html += '</tbody></table>';
        if (listEl) listEl.innerHTML = html;
        if (kpiActivos) kpiActivos.textContent = activos;
        if (kpiVencidos) kpiVencidos.textContent = vencidos;
      });
    } catch (e) { console.error("Error Firebase Stats", e); }
  }

  // --- Lógica BiBlop (IoT) ---

  function setupBiblopControls() {
    const rangeSel = document.getElementById('biblop-range');
    const refreshBtn = document.getElementById('biblop-refresh-btn');

    if (rangeSel) {
      // Clonamos para eliminar listeners viejos si se recarga la vista
      const newSel = rangeSel.cloneNode(true);
      rangeSel.parentNode.replaceChild(newSel, rangeSel);
      newSel.addEventListener('change', fetchBiblopData);
    }

    if (refreshBtn) {
      const newBtn = refreshBtn.cloneNode(true);
      refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);
      newBtn.addEventListener('click', fetchBiblopData);
    }
  }

  async function fetchBiblopData() {
    const rangeVal = document.getElementById('biblop-range')?.value || '24h';
    const updateLabel = document.getElementById('biblop-last-update');
    if (updateLabel) updateLabel.textContent = 'Actualizando...';

    try {
      const url = `${API_URL}?mode=list&limit=1000`;

      const response = await fetch(url);
      const text = await response.text();

      // --- CORRECCIÓN DE LIMPIEZA ROBUSTA ---
      // Buscamos la primera '{' y la última '}' para extraer solo el JSON válido
      // ignorando cualquier envoltorio (cb, paréntesis, punto y coma, etc.)
      let json;
      const firstOpen = text.indexOf('{');
      const lastClose = text.lastIndexOf('}');

      if (firstOpen !== -1 && lastClose !== -1) {
        const jsonString = text.substring(firstOpen, lastClose + 1);
        json = JSON.parse(jsonString);
      } else {
        throw new Error("La respuesta no contiene un JSON válido.");
      }
      // --------------------------------------

      const rawRows = (json.rows || json.data || []);
      const rows = rawRows.map(normalizeRow).filter(r => !isNaN(r.date));

      processAndRenderBiblop(rows, rangeVal);

      if (updateLabel) updateLabel.textContent = 'Act: ' + new Date().toLocaleTimeString();

    } catch (e) {
      console.error("BiBlop API Error:", e);
      if (updateLabel) updateLabel.textContent = 'Error de conexión';

      const tbody = document.getElementById('biblop-table-body');
      if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3"><i class="bi bi-exclamation-triangle me-2"></i>Error de formato en datos.</td></tr>`;
    }
  }

  function normalizeRow(r) {
    return {
      date: new Date(r.ts),
      entro: Number(r.entro) || 0,
      salio: Number(r.salio) || 0,
      cr: Number(r.cr) || 0,
      sala: Number(r.sala) || 0,
      info: Number(r.info) || 0,
      id: r.id || ''
    };
  }

  function processAndRenderBiblop(rows, rangeKey) {
      const now = Date.now();
      let ms = 0;
      // Filtros de tiempo (igual que antes)
      if(rangeKey==='1h') ms = 3600000;
      else if(rangeKey==='6h') ms = 6*3600000;
      else if(rangeKey==='24h') ms = 24*3600000;
      else if(rangeKey==='7d') ms = 7*86400000;
      else if(rangeKey==='30d') ms = 30*86400000;
      
      const cutoff = ms > 0 ? now - ms : 0;
      rows.sort((a,b) => a.date - b.date);
      const filtered = rows.filter(r => r.date.getTime() >= cutoff);

      // --- KPIs Generales ---
      const kEntro = filtered.reduce((s,r) => s+r.entro, 0);
      const kSalio = filtered.reduce((s,r) => s+r.salio, 0);
      const inside = Math.max(0, kEntro - kSalio);
      const ratio = kEntro ? Math.round((kSalio/kEntro)*100) : 0;
      
      const kCR = filtered.reduce((s,r) => s+r.cr, 0);
      const kSala = filtered.reduce((s,r) => s+r.sala, 0);
      const kInfo = filtered.reduce((s,r) => s+r.info, 0);

      setText('biblop-kpi-entro', kEntro);
      setText('biblop-kpi-salio', kSalio);
      setText('biblop-kpi-inside', inside);
      setText('biblop-kpi-ratio', ratio + '%');

      // --- PROCESAMIENTO PARA GRÁFICAS ---
      
      // Agrupación temporal (Minuto u Hora)
      const useHour = (rangeKey === '7d' || rangeKey === '30d');
      const grouped = new Map();
      
      // Array para la gráfica de ocupación (evolución paso a paso)
      // Calculamos el acumulado incremental
      let runningOccupancy = 0;
      const occupancyPoints = [];

      filtered.forEach(r => {
          // 1. Agrupar para Barras (Entradas/Salidas)
          const d = new Date(r.date);
          if(useHour) d.setMinutes(0,0,0);
          else d.setSeconds(0,0);
          const k = d.toISOString();
          
          if(!grouped.has(k)) grouped.set(k, {entro:0, salio:0});
          const g = grouped.get(k);
          g.entro += r.entro;
          g.salio += r.salio;

          // 2. Calcular Ocupación en este punto exacto
          // (Sumamos entradas, restamos salidas al acumulado)
          const netChange = r.entro - r.salio;
          runningOccupancy = Math.max(0, runningOccupancy + netChange);
          
          // Guardamos punto para la gráfica de línea (no agrupado, para mayor detalle o agrupado si son muchos)
          // Para no saturar, usaremos los mismos keys agrupados para la ocupación promedio o final de ese intervalo
      });

      // Preparar datos Gráfica 1 (Barras Agrupadas)
      const labels = Array.from(grouped.keys()).sort();
      const dataEntro = labels.map(k => grouped.get(k).entro);
      const dataSalio = labels.map(k => grouped.get(k).salio);

      // Preparar datos Gráfica 2 (Ocupación)
      // Recalculamos ocupación acumulada basada en los grupos para suavizar la gráfica
      let currentOcc = 0;
      const dataOccupancy = labels.map(k => {
          const g = grouped.get(k);
          currentOcc = Math.max(0, currentOcc + (g.entro - g.salio));
          return currentOcc;
      });

      // Renderizar
      renderFlowChart(labels, dataEntro, dataSalio, useHour);
      renderOccupancyChart(labels, dataOccupancy, useHour); // Nueva función
      renderServicesChart(kCR, kSala, kInfo);
      renderTable(filtered);
  }

  function renderOccupancyChart(labels, dataOcc, useHour) {
      const ctx = document.getElementById('chart-biblop-occupancy');
      if(!ctx) return;
      if(_chOccupancy) _chOccupancy.destroy();

      _chOccupancy = new Chart(ctx, {
          type: 'line',
          data: {
              labels: labels.map(l => new Date(l)),
              datasets: [{
                  label: 'Ocupación Estimada',
                  data: dataOcc,
                  borderColor: '#f59e0b', // warning color
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  fill: true,
                  tension: 0.4,
                  pointRadius: 0,
                  pointHoverRadius: 4
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: { legend: { display: false } },
              scales: {
                  x: { 
                      type: 'time', 
                      time: { unit: useHour ? 'day' : 'minute', displayFormats: { minute:'HH:mm', hour: 'HH:mm', day: 'MMM dd' } },
                      grid: { display: false },
                      ticks: { maxTicksLimit: 8 }
                  },
                  y: { beginAtZero: true, border: { display: false }, suggestedMax: 10 }
              }
          }
      });
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // --- Charts con Chart.js ---

  function renderFlowChart(labels, dataE, dataS, useHour) {
      const ctx = document.getElementById('chart-biblop-flow');
      if(!ctx) return;
      if(_chFlow) _chFlow.destroy();

      _chFlow = new Chart(ctx, {
          type: 'bar', // CAMBIO: Barras en lugar de línea
          data: {
              labels: labels.map(l => new Date(l)),
              datasets: [
                  {
                      label: 'Entradas',
                      data: dataE,
                      backgroundColor: '#2563eb',
                      borderRadius: 4,
                      barPercentage: 0.6,
                      categoryPercentage: 0.8
                  },
                  {
                      label: 'Salidas',
                      data: dataS,
                      backgroundColor: '#10b981',
                      borderRadius: 4,
                      barPercentage: 0.6,
                      categoryPercentage: 0.8
                  }
              ]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: { legend: { position: 'top', align: 'end' } },
              scales: {
                  x: { 
                      type: 'time', 
                      time: { unit: useHour ? 'day' : 'minute', displayFormats: { minute:'HH:mm', hour: 'HH:mm', day: 'MMM dd' } },
                      grid: { display: false }
                  },
                  y: { beginAtZero: true, border: { display: false }, grid: { color: '#f3f4f6' } }
              }
          }
      });
  }

  function renderServicesChart(cr, sala, info) {
      const ctx = document.getElementById('chart-biblop-services');
      if(!ctx) return;
      if(_chServ) _chServ.destroy();

      // Calculamos total para porcentajes
      const total = cr + sala + info || 1;

      // Actualizar leyenda HTML personalizada
      const legendEl = document.getElementById('biblop-services-legend');
      if(legendEl) {
         legendEl.innerHTML = `
            <li class="list-group-item d-flex justify-content-between align-items-center px-0">
               <span><i class="bi bi-circle-fill text-info me-2" style="font-size:8px;"></i>Consulta Rápida</span>
               <span class="fw-bold">${cr} <span class="text-muted fw-normal">(${Math.round(cr/total*100)}%)</span></span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center px-0">
               <span><i class="bi bi-circle-fill text-primary me-2" style="font-size:8px;"></i>Sala General</span>
               <span class="fw-bold">${sala} <span class="text-muted fw-normal">(${Math.round(sala/total*100)}%)</span></span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center px-0">
               <span><i class="bi bi-circle-fill text-orange me-2" style="font-size:8px; color:#f97316;"></i>Información</span>
               <span class="fw-bold">${info} <span class="text-muted fw-normal">(${Math.round(info/total*100)}%)</span></span>
            </li>
         `;
      }

      _chServ = new Chart(ctx, {
          type: 'doughnut',
          data: {
              labels: ['Consulta Rápida', 'Sala', 'Información'],
              datasets: [{
                  data: [cr, sala, info],
                  backgroundColor: ['#0ea5e9', '#8b5cf6', '#f97316'],
                  borderWidth: 0,
                  hoverOffset: 4
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              cutout: '75%',
              plugins: { legend: { display: false } } // Usamos leyenda HTML externa
          }
      });
  }

  function renderTable(rows) {
    const tbody = document.getElementById('biblop-table-body');
    if (!tbody) return;

    // Últimos 12 eventos (reverse)
    const recent = rows.slice(-12).reverse();

    tbody.innerHTML = recent.map(r => {
      const type = r.entro ? 'Entrada' : r.salio ? 'Salida' : '-';
      const badge = r.entro ? 'bg-primary-subtle text-primary' : 'bg-success-subtle text-success';

      let serv = '-';
      if (r.cr) serv = 'Consulta Rápida';
      else if (r.sala) serv = 'Sala';
      else if (r.info) serv = 'Información';

      const time = r.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const idMask = r.id ? `••• ${r.id.slice(-4)}` : 'N/A';

      return `
            <tr>
              <td><span class="font-monospace">${time}</span></td>
              <td><span class="badge ${badge}">${type}</span></td>
              <td>${serv}</td>
              <td class="text-muted small">${idMask}</td>
            </tr>
          `;
    }).join('');
  }

  return {
    initStudent, initAdmin, initSuperAdmin,
    solicitarLibro,
    aprobarPrestamo, rechazarPrestamo, entregarPrestamo, devolverPrestamo, eliminarLibro
  };
})();
