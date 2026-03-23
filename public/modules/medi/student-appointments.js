// modules/medi/student-appointments.js
window.Medi = window.Medi || {};
window.Medi.Factories = window.Medi.Factories || {};

window.Medi.Factories.studentAppointments = function(scope) {
  with (scope) {
  function showConsultationDetails(jsonExp) {
    const exp = JSON.parse(decodeURIComponent(jsonExp));
    const dateObj = exp.safeDate ? new Date(exp.safeDate) : new Date();
    const professionalName = _getProfessionalDisplayName(exp);
    const specialty = _getStudentServiceLabel(exp.tipoServicio);
    const signs = exp.signos || {};
    const temp = exp.temp ?? signs.temp ?? null;
    const presion = exp.presion ?? signs.presion ?? null;
    const peso = exp.peso ?? signs.peso ?? null;
    const talla = exp.talla ?? signs.talla ?? null;

    document.getElementById('detail-date-header').innerHTML = `<i class="bi bi-calendar-event me-1"></i> ${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    document.getElementById('detail-doctor').textContent = `${professionalName} (${specialty})`;
    document.getElementById('detail-temp').textContent = temp ? `${temp}°C` : '--';
    document.getElementById('detail-presion').textContent = presion || '--';
    document.getElementById('detail-peso').textContent = peso ? `${peso} kg` : '--';

    const detailTalla = document.getElementById('detail-talla');
    if (detailTalla) detailTalla.textContent = talla ? `${talla} cm` : '--';

    document.getElementById('detail-subjetivo').textContent = exp.subjetivo || 'No registrado';
    document.getElementById('detail-diagnosis').textContent = exp.diagnostico || 'No registrado';
    document.getElementById('detail-plan').textContent = exp.plan || exp.meds || 'Seguir indicaciones generales.';

    const btnPrint = document.getElementById('btn-print-receta');
    if (btnPrint?.parentNode) {
      const newBtn = btnPrint.cloneNode(true);
      btnPrint.parentNode.replaceChild(newBtn, btnPrint);
      newBtn.onclick = () => {
        PDFGenerator.generateProfessionalPrescription(_buildConsultationPrescriptionPayload(exp));
      };
    }

    const detailModalEl = document.getElementById('modalDetalleConsulta');
    if (!detailModalEl) return;
    detailModalEl.style.zIndex = '1061';
    new bootstrap.Modal(detailModalEl).show();
  }

  function solicitarCancelacion(citaId) {
    const modalEl = document.getElementById('modalMediCancelParams');
    if (!modalEl) {
      const altModalEl = document.getElementById('modalCancelCita');
      if (altModalEl) {
        const altModal = new bootstrap.Modal(altModalEl);
        const confirmBtn = document.getElementById('btn-confirm-cancel');
        confirmBtn.onclick = async () => {
          const reason = document.getElementById('cancel-reason').value.trim() || 'Cancelado por el estudiante';
          const original = confirmBtn.innerHTML;
          confirmBtn.disabled = true;
          confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
          try {
            await MediService.cancelarCitaEstudiante(_ctx, citaId, reason);
            showToast('Cita cancelada', 'success');
            altModal.hide();
          } catch (error) {
            console.error(error);
            showToast('Error cancelando', 'danger');
          } finally {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = original;
          }
        };
        altModal.show();
        return;
      }
      showToast('Modal de cancelación no encontrado', 'danger');
      return;
    }

    const modal = new bootstrap.Modal(modalEl);
    document.getElementById('cancel-cita-id').value = citaId;
    document.getElementById('cancel-other').value = '';

    const form = document.getElementById('form-medi-cancel-reason');
    form.onsubmit = async (event) => {
      event.preventDefault();
      const reason = document.getElementById('cancel-other').value.trim();
      if (!reason) return showToast('Indica un motivo', 'warning');

      const btn = form.querySelector('button[type="submit"]');
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

      try {
        await MediService.cancelarCitaEstudiante(_ctx, citaId, reason);
        showToast('Cita cancelada', 'success');
        modal.hide();
      } catch (error) {
        console.error(error);
        showToast('Error cancelando', 'danger');
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    };

    modal.show();
  }

  function prepararEdicion(jsonCita) {
    const cita = JSON.parse(decodeURIComponent(jsonCita));
    const modalEl = document.getElementById('modalMediReschedule');
    if (!modalEl) return;
    const modal = new bootstrap.Modal(modalEl);

    document.getElementById('resched-cita-id').value = cita.id;
    document.getElementById('resched-old-slot').value = cita.slotId || '';
    document.getElementById('resched-tipo').value = _normalizeStudentServiceType(cita.tipoServicio || 'Médico');
    document.getElementById('resched-date').value = '';
    document.getElementById('resched-time').value = '';

    const btnConfirm = document.getElementById('btn-resched-confirm');
    if (btnConfirm) btnConfirm.disabled = true;
    document.getElementById('resched-summary')?.classList.add('d-none');

    const timeGrid = document.getElementById('resched-time-grid');
    if (timeGrid) {
      timeGrid.innerHTML = '';
      timeGrid.classList.add('d-none');
    }

    const timeMsg = document.getElementById('resched-time-msg');
    if (timeMsg) {
      timeMsg.classList.remove('d-none');
      timeMsg.innerHTML = '<i class="bi bi-calendar-check d-block mb-1"></i> Selecciona un día primero';
    }

    const dateSelector = document.getElementById('resched-date-selector');
    const days = [];
    let curr = new Date();
    while (days.length < 10) {
      if (isWeekday(curr) && _hasRemainingSlotsForDate(curr, cita.tipoServicio || 'Médico')) {
        days.push(new Date(curr));
      }
      curr.setDate(curr.getDate() + 1);
    }

    if (dateSelector) {
      dateSelector.innerHTML = days.map((day) => {
        const isoDate = MediService.toISO(day);
        const isToday = day.getDate() === new Date().getDate() && day.getMonth() === new Date().getMonth();
        const displayDay = isToday ? 'HOY' : day.toLocaleDateString('es-MX', { weekday: 'short' }).toUpperCase();
        return `
          <div class="date-option p-2 text-center border rounded-3 bg-white shadow-sm flex-shrink-0"
               style="min-width: 70px; cursor: pointer;" data-date="${isoDate}"
               onclick="Medi._reschedSelectDate(this, '${isoDate}')">
            <div class="small text-muted mb-0">${displayDay}</div>
            <div class="fw-bold fs-5">${day.getDate()}</div>
            <div class="small text-primary fw-bold">${day.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase()}</div>
          </div>`;
      }).join('');
    }

    const form = document.getElementById('form-medi-reschedule');
    form.onsubmit = async (event) => {
      event.preventDefault();
      const newDateStr = document.getElementById('resched-date').value;
      const newTimeStr = document.getElementById('resched-time').value;
      if (!newDateStr || !newTimeStr) return showToast('Selecciona fecha y hora', 'warning');

      const [year, month, day] = newDateStr.split('-').map(Number);
      const [hour, minute] = newTimeStr.split(':').map(Number);
      const newDate = new Date(year, month - 1, day, hour, minute);
      const tipo = _normalizeStudentServiceType(document.getElementById('resched-tipo').value || cita.tipoServicio);
      const nextSlotId = `${MediService.slotIdFromDate(newDate)}_${tipo}`;
      const btn = document.getElementById('btn-resched-confirm');
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

      try {
        const profData = await MediService.resolveProfessionalForBooking(_ctx, tipo, newDate);
        const result = await MediService.modificarCita(_ctx, cita.id, {
          date: newDate,
          slotId: nextSlotId,
          tipo,
          motivo: cita.motivo,
          profesionalId: profData?.id || null,
          profesionalName: profData?.displayName || null,
          profesionalProfileId: profData?.profileId || null
        });

        modal.hide();
        const dateText = newDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
        const timeText = newDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        _showBookingConfirmModal({
          tipo: _getStudentServiceLabel(tipo),
          dateText: dateText.charAt(0).toUpperCase() + dateText.slice(1),
          timeText,
          replaceId: cita.id,
          finalStatus: result?.finalStatus || 'confirmada',
          queuePosition: result?.queuePosition || 0,
          calendarCita: (result?.finalStatus || 'confirmada') === 'confirmada'
            ? _buildCalendarAppointmentPayload({
              id: cita.id,
              safeDate: newDate,
              tipoServicio: tipo,
              profesionalName: profData?.displayName || null,
              motivo: cita.motivo
            })
            : null
        });
      } catch (error) {
        console.error(error);
        showToast(error.message || 'Error al reagendar', 'danger');
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    };

    modal.show();
  }

  async function _reschedSelectDate(el, dateStr) {
    document.getElementById('resched-date').value = dateStr;
    document.getElementById('resched-time').value = '';
    document.getElementById('btn-resched-confirm').disabled = true;
    document.getElementById('resched-summary').classList.add('d-none');

    el.closest('.medi-resched-dates').querySelectorAll('.date-option').forEach((card) => {
      card.classList.remove('bg-primary', 'text-white', 'border-primary');
      card.classList.add('bg-white');
    });
    el.classList.remove('bg-white');
    el.classList.add('bg-primary', 'text-white', 'border-primary');

    const timeGrid = document.getElementById('resched-time-grid');
    const timeMsg = document.getElementById('resched-time-msg');
    const tipo = _normalizeStudentServiceType(document.getElementById('resched-tipo').value || 'Médico');
    const cfgMed = _ctx.config?.medi || {};
    const oldSlotId = document.getElementById('resched-old-slot').value || '';

    timeGrid.classList.add('d-none');
    timeMsg.classList.remove('d-none');
    timeMsg.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Buscando disponibilidad...';

    const targetDate = new Date(`${dateStr}T12:00:00`);
    const slots = _getStudentBookableSlotsForDate(targetDate, tipo, cfgMed);

    let occupied = [];
    try {
      occupied = await MediService.getOccupiedSlots(_ctx, dateStr, tipo);
    } catch (error) {
      console.error('Error fetching slots for reschedule:', error);
    }

    const slotCounts = occupied._slotCounts || {};
    timeGrid.innerHTML = '';

    slots.forEach((slot) => {
      const timeText = `${String(slot.getHours()).padStart(2, '0')}:${String(slot.getMinutes()).padStart(2, '0')}`;
      const slotId = `${MediService.slotIdFromDate(slot)}_${tipo}`;
      const baseCount = slotCounts[slotId] || 0;
      const adjustedCount = slotId === oldSlotId ? Math.max(0, baseCount - 1) : baseCount;
      const isTaken = occupied.includes(slotId) && slotId !== oldSlotId;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.time = timeText;
      btn.dataset.slotId = slotId;
      btn.className = `btn btn-sm rounded-pill fw-bold ${isTaken ? 'btn-light text-muted pe-none opacity-50' : 'btn-outline-primary'}`;
      btn.style.cssText = 'min-width: 74px;';
      btn.innerHTML = isTaken
        ? `<s>${timeText}</s>`
        : `${timeText}${slotId === oldSlotId ? ' • Actual' : adjustedCount > 0 ? ` • Cola ${adjustedCount}` : ''}`;

      if (!isTaken) {
        btn.onclick = () => {
          timeGrid.querySelectorAll('button').forEach((button) => {
            button.classList.remove('btn-primary', 'text-white');
            button.classList.add('btn-outline-primary');
          });
          btn.classList.remove('btn-outline-primary');
          btn.classList.add('btn-primary', 'text-white');

          document.getElementById('resched-time').value = timeText;
          document.getElementById('btn-resched-confirm').disabled = false;

          const dateObj = new Date(`${dateStr}T12:00:00`);
          const dateText = dateObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
          const sumText = document.getElementById('resched-summary-text');
          sumText.textContent = `${dateText.charAt(0).toUpperCase() + dateText.slice(1)} • ${timeText} hrs`;
          document.getElementById('resched-summary').classList.remove('d-none');
        };
      }

      timeGrid.appendChild(btn);
    });

    if (slots.length === 0) {
      timeGrid.innerHTML = '<div class="text-muted small w-100 text-center py-2">No hay horarios habilitados para ese día.</div>';
    }

    timeMsg.classList.add('d-none');
    timeGrid.classList.remove('d-none');
  }

  function saveState() {
    const state = {
      timestamp: Date.now(),
      formData: {},
      selectedValues: {},
      scrollPosition: window.pageYOffset || document.documentElement.scrollTop
    };

    ['form-medi-nueva-cita', 'form-medi-consulta', 'form-buscar-paciente'].forEach((formId) => {
      const form = document.getElementById(formId);
      if (!form) return;

      const formData = new FormData(form);
      state.formData[formId] = {};
      for (let [key, value] of formData.entries()) {
        state.formData[formId][key] = value;
      }
    });

    state.selectedValues.date = document.getElementById('medi-cita-fecha')?.value || '';
    state.selectedValues.time = document.getElementById('medi-cita-hora')?.value || '';
    state.selectedValues.serviceType = document.getElementById('medi-cita-tipo')?.value || '';
    state.selectedValues.category = document.getElementById('medi-cita-categoria')?.value || '';

    const activeTab = document.querySelector('#medi-citas-tabs .nav-link.active');
    if (activeTab) state.activeTab = activeTab.getAttribute('data-bs-target');
    const mainTab = document.querySelector('#medi-student-tabs .nav-link.active');
    if (mainTab) state.activeMainTab = mainTab.getAttribute('data-bs-target');

    return state;
  }

  function restoreState(state) {
    if (!state) return;

    if (state.formData) {
      Object.keys(state.formData).forEach((formId) => {
        const form = document.getElementById(formId);
        if (!form) return;

        Object.keys(state.formData[formId]).forEach((fieldName) => {
          const field = form.elements[fieldName];
          if (field) field.value = state.formData[formId][fieldName];
        });
      });
    }

    const selected = state.selectedValues || {};
    if (selected.serviceType || selected.category) {
      const serviceType = _normalizeStudentServiceType(selected.serviceType || selected.category);
      setTimeout(() => _selectStudentService(serviceType, null, { skipRefresh: true, skipFocus: true }), 40);
    }

    if (selected.date) {
      setTimeout(() => {
        const dateBtn = document.querySelector(`.date-option[data-date="${selected.date}"]`);
        if (dateBtn) dateBtn.click();
      }, 120);
    }

    if (selected.time) {
      setTimeout(() => {
        const timeBtn = document.querySelector(`.time-slot-card[data-time="${selected.time}"]`);
        if (timeBtn) timeBtn.click();
      }, 320);
    }

    if (state.activeMainTab) {
      setTimeout(() => _switchMediTab(state.activeMainTab.replace('#', '')), 200);
    }

    if (state.activeTab) {
      const tabButton = document.querySelector(`[data-bs-target="${state.activeTab}"]`);
      if (tabButton) {
        setTimeout(() => {
          const tab = new bootstrap.Tab(tabButton);
          tab.show();
        }, 300);
      }
    }

    if (state.scrollPosition) {
      requestAnimationFrame(() => window.scrollTo(0, state.scrollPosition));
      setTimeout(() => window.scrollTo(0, state.scrollPosition), 180);
    }
  }

    return {
      showConsultationDetails,
      solicitarCancelacion,
      prepararEdicion,
      _reschedSelectDate,
      saveState,
      restoreState
    };
  }
};
