// modules/medi/student-chat.js
window.Medi = window.Medi || {};
window.Medi.Factories = window.Medi.Factories || {};

window.Medi.Factories.studentChat = function(scope) {
  with (scope) {
  // --- E1: STUDENT CHAT UI ---
  function renderStudentChat(uid, name) {
    if (!window.MediChatService) return;

    // Verify view is still active before injecting (prevents race condition if user navigated away quickly)
    const viewMedi = document.getElementById('view-medi');
    if (viewMedi && viewMedi.classList.contains('d-none')) return;

    // 1. Inject Floating Button
    if (!document.getElementById('medi-chat-float-btn')) {
      const btn = document.createElement('div');
      btn.id = 'medi-chat-float-btn';
      // [FIX] Increased bottom margin/position to avoid Mobile Navbar overlap (approx 60-80px)
      // Was: bottom-0 m-4 (~24px). Now: bottom-0 style="bottom: 80px; right: 20px;"
      btn.className = 'position-fixed';
      btn.style.bottom = '90px'; // Clear standard navbar
      btn.style.right = '16px';
      btn.style.zIndex = '2000';
      btn.innerHTML = `
        <button class="btn btn-primary rounded-circle shadow-lg d-flex align-items-center justify-content-center position-relative" style="width: 60px; height: 60px;" onclick="Medi.toggleStudentChat()">
            <i class="bi bi-chat-dots-fill fs-4"></i>
            <span id="stu-chat-badge" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-light d-none">
                0
            </span>
        </button>
      `;
      document.body.appendChild(btn);
    }

    // 2. Inject Chat Modal/Panel
    if (!document.getElementById('medi-student-chat-panel')) {
      const panel = document.createElement('div');
      panel.id = 'medi-student-chat-panel';
      // [FIX] Adjusted position to match button and ensure height fits viewport
      panel.className = 'position-fixed bg-white shadow-lg rounded-4 d-none overflow-hidden d-flex flex-column';
      panel.style.bottom = '100px'; // Above the button slightly or same level
      panel.style.right = '16px';
      panel.style.width = 'min(92vw, 350px)';
      panel.style.maxWidth = '92vw';
      panel.style.height = 'min(65vh, 520px)';
      panel.style.maxHeight = '65vh';
      panel.style.minHeight = '320px';
      panel.style.zIndex = '2001'; // Above detail modal and everything

      panel.innerHTML = `
        <div class="text-white p-3 d-flex justify-content-between align-items-center flex-shrink-0" style="background: linear-gradient(135deg, #1B396A 0%, #0d6efd 100%); border-radius: 1rem 1rem 0 0;">
            <div class="fw-bold"><i class="bi bi-chat-dots me-2"></i>Mis mensajes</div>
            <button class="btn btn-sm btn-link text-white p-0" onclick="Medi.toggleStudentChat()"><i class="bi bi-x-lg"></i></button>
        </div>
            
            <!-- List View -->
            <div id="stu-chat-list" class="flex-grow-1 overflow-auto p-2">
                <div class="text-center py-5 text-muted small"><span class="spinner-border spinner-border-sm"></span></div>
            </div>

            <!-- Thread View (Hidden by default) -->
  <div id="stu-chat-thread" class="flex-grow-1 d-none d-flex flex-column h-100 bg-white position-absolute top-0 start-0 w-100" style="z-index:2;">
    <div class="border-bottom p-2 d-flex align-items-center gap-2 flex-shrink-0">
      <button class="btn btn-sm btn-light rounded-circle" onclick="document.getElementById('stu-chat-thread').classList.add('d-none');Medi._closeChatThread()"><i class="bi bi-arrow-left"></i></button>
      <div class="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden">
        <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold flex-shrink-0" style="width:32px;height:32px;font-size:0.8rem;" id="stu-chat-pro-avatar">P</div>
        <div class="overflow-hidden">
          <div class="fw-bold text-truncate" style="font-size:0.85rem;" id="stu-chat-pro-name">Profesional</div>
          <div class="text-muted" style="font-size:0.65rem;" id="stu-chat-pro-specialty">Servicio médico</div>
        </div>
      </div>
    </div>
    <div id="stu-chat-msgs" class="flex-grow-1 overflow-auto p-2"></div>
    <!-- Typing indicator -->
    <div id="stu-typing-indicator" class="px-3 d-none" style="height:22px;">
      <span class="text-muted" style="font-size:0.7rem;" id="stu-typing-label">Escribiendo</span>
      <span class="stu-typing-dot ms-1"></span><span class="stu-typing-dot"></span><span class="stu-typing-dot"></span>
    </div>
    <div class="p-2 border-top bg-white flex-shrink-0">
      <div class="d-flex flex-wrap gap-1 mb-2 px-1" id="stu-chat-shortcuts">
        <button class="btn btn-sm btn-light rounded-pill border" style="font-size:0.68rem;" onclick="Medi._insertQuickReply(this)" data-text="Hola, tengo una duda sobre mi cita.">Mi cita</button>
        <button class="btn btn-sm btn-light rounded-pill border" style="font-size:0.68rem;" onclick="Medi._insertQuickReply(this)" data-text="Quiero confirmar un dato de mi receta.">Mi receta</button>
        <button class="btn btn-sm btn-light rounded-pill border" style="font-size:0.68rem;" onclick="Medi._insertQuickReply(this)" data-text="Necesito reagendar mi cita.">Reagendar</button>
        <button class="btn btn-sm btn-light rounded-pill border" style="font-size:0.68rem;" onclick="Medi._insertQuickReply(this)" data-text="Gracias por el seguimiento.">Gracias</button>
      </div>
      <div class="input-group input-group-sm">
        <input type="text" id="stu-chat-input" class="form-control rounded-pill"
          placeholder="Escribe tu mensaje..."
          oninput="Medi._onChatInputChange()"
          onkeypress="if(event.key==='Enter')Medi.sendStudentMessage()">
        <button class="btn btn-primary rounded-circle ms-1" onclick="Medi.sendStudentMessage()" style="width:30px;height:30px;padding:0;"><i class="bi bi-send-fill" style="font-size:0.7rem"></i></button>
      </div>
    </div>
  </div>
`;
      document.body.appendChild(panel);
    }

    // 3. Subscription for Unread & List
    if (_unsubs.studentChatStream) {
      _unsubs.studentChatStream();
    }
    _unsubs.studentChatStream = MediChatService.streamConversations(_ctx, uid, 'student', null, (convs) => {
      _renderStudentConvList(convs);

      // Update total unread
      const total = convs.reduce((acc, c) => acc + (c.unreadByStudent || 0), 0);
      const badge = document.getElementById('stu-chat-badge');
      if (badge) {
        badge.textContent = total;
        badge.classList.toggle('d-none', total === 0);
      }
      _updateChatBadgeOnTab(total);

      // [2F] Notificación prominente cuando llegan mensajes nuevos con panel cerrado
      const panel = document.getElementById('medi-student-chat-panel');
      const panelHidden = !panel || panel.classList.contains('d-none');
      if (total > _prevUnreadTotal && panelHidden) {
        const floatBtn = document.querySelector('#medi-chat-float-btn button');
        if (floatBtn) floatBtn.classList.add('medi-chat-pulse');
        const newConv = convs.find(c => (c.unreadByStudent || 0) > 0);
        if (newConv && window.showToast) {
          const preview = newConv.lastMessage ? newConv.lastMessage.substring(0, 60) : 'Nuevo mensaje';
          showToast(`${escapeHtml(newConv.profesionalName)}: ${escapeHtml(preview)}`, 'info');
        }
      } else if (total === 0) {
        document.querySelector('#medi-chat-float-btn button')?.classList.remove('medi-chat-pulse');
      }
      _prevUnreadTotal = total;
    });
  }

  function _renderStudentConvList(convs) {
    const list = document.getElementById('stu-chat-list');
    if (!list) return;

    if (convs.length === 0) {
      list.innerHTML = `<div class="text-center py-5 text-muted small px-3">
          <i class="bi bi-chat-square-text display-4 opacity-25 mb-3 d-block"></i>
          <div class="fw-bold text-dark mb-2">Tu bandeja está lista</div>
          <div class="mb-3">Cuando tengas una cita confirmada podrás contactar al profesional desde tus citas o desde la tarjeta de próxima cita.</div>
          <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="Medi._switchMediTab('medi-tab-citas'); Medi.toggleStudentChat();">
            <i class="bi bi-calendar-week me-1"></i>Ir a mis citas
          </button>
        </div>`;
      return;
    }

    list.innerHTML = convs.map(c => {
      const unread = c.unreadByStudent || 0;
      const time = c.lastMessageAt ? (typeof c.lastMessageAt.toDate === 'function' ? c.lastMessageAt.toDate() : new Date(c.lastMessageAt)) : null;
      const timeStr = time ? _relativeTime(time) : '';
      const serviceLabel = _resolveStudentChatServiceLabel(c.profesionalId, c.profesionalProfileId || null);
      const preview = escapeHtml(c.lastMessage || 'Sin mensajes todavía.');

      return `
        <div class="medi-chat-card card border-0 shadow-sm mb-2 cursor-pointer" onclick="Medi.openStudentThread('${c.id}', '${escapeHtml(c.profesionalName)}', '${c.profesionalId}', '${c.profesionalProfileId || ''}')">
            <div class="card-body p-2 d-flex align-items-center gap-2">
            <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold flex-shrink-0" style="width:40px;height:40px;">
                ${(c.profesionalName || 'P')[0]}
            </div>
            <div class="flex-grow-1" style="min-width:0;">
                <div class="d-flex justify-content-between align-items-start">
                <h6 class="mb-0 fw-bold small text-truncate">${escapeHtml(c.profesionalName)}</h6>
                <small class="text-muted" style="font-size:0.6rem;">${timeStr}</small>
                </div>
                <div class="d-flex justify-content-between align-items-center gap-2 mt-1 mb-1">
                <span class="medi-chat-chip"><i class="bi bi-shield-check"></i>${escapeHtml(serviceLabel)}</span>
                ${unread > 0 ? `<span class="badge bg-danger rounded-pill" style="font-size:0.6rem;">${unread}</span>` : ''}
                </div>
                <div class="text-muted text-truncate small" style="font-size: 0.75rem;">${preview}</div>
                <div class="text-muted mt-1" style="font-size:0.65rem;">Toca para abrir la conversación</div>
            </div>
            </div>
        </div>
  `;
    }).join('');
  }


  function toggleStudentChat() {
    const panel = document.getElementById('medi-student-chat-panel');
    if (!panel) return;
    const willHide = !panel.classList.contains('d-none');
    panel.classList.toggle('d-none');
    if (willHide) {
      document.getElementById('stu-chat-thread')?.classList.add('d-none');
      _closeChatThread();
    }
  }

  function openStudentChat(preferRelevantThread = false) {
    const panel = document.getElementById('medi-student-chat-panel');
    if (panel) panel.classList.remove('d-none');

    if (preferRelevantThread) {
      const relevantAppointment = (_lastCitasFull || [])
        .filter((cita) => ['pendiente', 'confirmada'].includes(cita.estado))
        .filter((cita) => !!cita.profesionalId)
        .sort((a, b) => (a.safeDate || 0) - (b.safeDate || 0))[0];

      if (relevantAppointment?.profesionalId) {
        startChatWithProfessional(
          relevantAppointment.profesionalId,
          relevantAppointment.profesionalName || 'Profesional',
          relevantAppointment.profesionalProfileId || null,
          `Conversación desde cita · ${_getStudentServiceLabel(relevantAppointment.tipoServicio)}`
        );
      }
    }
  }

  function openStudentThread(convId, proName, proId, profileId = null, appointmentContext = null) {
    _activeStudentConvId = convId;
    _activeConvData = {};

    // Update header
    const proNameEl = document.getElementById('stu-chat-pro-name');
    if (proNameEl) proNameEl.textContent = proName;
    const avatarEl = document.getElementById('stu-chat-pro-avatar');
    if (avatarEl) avatarEl.textContent = (proName || 'P')[0].toUpperCase();
    const specialtyEl = document.getElementById('stu-chat-pro-specialty');
    if (specialtyEl) specialtyEl.textContent = _resolveStudentChatServiceLabel(proId, profileId, appointmentContext);
    document.getElementById('stu-chat-thread')?.classList.remove('d-none');

    // Remove pulse animation when opening
    document.querySelector('#medi-chat-float-btn button')?.classList.remove('medi-chat-pulse');

    // [2A] Listen to conversation doc: typing indicator + read receipts
    if (_stuConvUnsub) _stuConvUnsub();
    _stuConvUnsub = _ctx.db.collection('medi-conversations').doc(convId).onSnapshot(snap => {
      _activeConvData = snap.data() || {};
      const typingEl = document.getElementById('stu-typing-indicator');
      const typingLabel = document.getElementById('stu-typing-label');
      if (typingEl) {
        const isTyping = !!_activeConvData.isTypingProfesional;
        typingEl.classList.toggle('d-none', !isTyping);
        if (typingLabel && isTyping) {
          const proFirst = (proName || 'El profesional').split(' ')[0];
          typingLabel.textContent = `${proFirst} está escribiendo...`;
        }
      }
    });

    // Subscribe to messages
    if (_stuMsgsUnsub) _stuMsgsUnsub();
    _stuMsgsUnsub = MediChatService.streamMessages(_ctx, convId, (msgs) => {
      const container = document.getElementById('stu-chat-msgs');
      if (!container) return;

      // [2B] Find last student message index for read receipt
      const lastStudentIdx = msgs.map(m => m.senderRole).lastIndexOf('student');
      const isReadByPro = (_activeConvData.unreadByProfesional || 0) === 0 && lastStudentIdx >= 0;

      let html = '';
      const resolvedService = _resolveStudentChatServiceLabel(proId, profileId, appointmentContext);

      // [2E] System message for appointment context
      if (appointmentContext) {
        html += `<div class="text-center my-3">
          <span class="badge bg-light text-muted border" style="font-size:0.65rem;font-weight:normal;white-space:normal;max-width:90%;">
            <i class="bi bi-calendar-event me-1"></i>${escapeHtml(appointmentContext)}
          </span>
        </div>`;
      }

      if (msgs.length === 0) {
        html += `
          <div class="medi-chat-thread-intro rounded-4 p-3 mb-3">
            <div class="fw-bold text-dark small mb-1">Puedes escribir con confianza</div>
            <div class="text-muted" style="font-size:0.74rem;">Usa este chat para dudas breves sobre tu cita, receta, seguimiento o indicaciones de ${escapeHtml(resolvedService)}.</div>
          </div>`;
      }

      html += msgs.map((m, idx) => {
        const isMe = m.senderRole === 'student';
        const time = m.createdAt ? (typeof m.createdAt.toDate === 'function' ? m.createdAt.toDate() : new Date(m.createdAt)) : null;
        const timeStr = time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        // [2B] Check mark for last student message
        let checkHtml = '';
        if (isMe && idx === lastStudentIdx) {
          checkHtml = isReadByPro
            ? '<i class="bi bi-check2-all ms-1" style="color:#90cdf4;font-size:0.65rem;"></i>'
            : '<i class="bi bi-check2 ms-1" style="color:rgba(255,255,255,0.55);font-size:0.65rem;"></i>';
        }

        return `
        <div class="d-flex ${isMe ? 'justify-content-end' : 'justify-content-start'} mb-2">
          <div class="px-3 py-2 rounded-4 ${isMe ? 'bg-primary text-white rounded-bottom-end-0' : 'bg-white shadow-sm border rounded-bottom-start-0'}"
            style="max-width:85%; font-size: 0.85rem;">
            <div>${escapeHtml(m.text)}</div>
            <div class="${isMe ? 'text-white-50' : 'text-muted'} text-end d-flex align-items-center justify-content-end gap-1" style="font-size:0.6rem;">
              ${timeStr}${checkHtml}
            </div>
          </div>
        </div>`;
      }).join('');

      // [2D] Quick replies when conversation is new/empty
      if (msgs.length <= 1) {
        const quickReplies = [
          'Tengo una duda sobre mi receta',
          'Quiero confirmar un dato de mi cita',
          'Necesito reagendar mi cita',
          'Tengo una duda sobre mis indicaciones'
        ];
        html += `<div id="stu-quick-replies" class="d-flex flex-wrap gap-1 justify-content-center my-3 px-2">
          ${quickReplies.map(q => `<button class="btn btn-sm btn-outline-secondary rounded-pill px-2 py-1" style="font-size:0.7rem;" onclick="Medi._insertQuickReply(this)" data-text="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join('')}
        </div>`;
      }

      container.innerHTML = html;
      container.scrollTop = container.scrollHeight;
      const threadVisible = !document.getElementById('stu-chat-thread')?.classList.contains('d-none');
      if (threadVisible) {
        MediChatService.markAsRead(_ctx, convId, 'student').catch(() => {});
      }
    });

    MediChatService.markAsRead(_ctx, convId, 'student');
  }

  async function sendStudentMessage() {
    const input = document.getElementById('stu-chat-input');
    const text = input?.value?.trim();
    if (!text || !_activeStudentConvId) return;

    input.value = '';
    clearTimeout(_chatTypingTimer);
    _chatTypingTimer = null;

    if (window.MediChatService?.setTyping) {
      MediChatService.setTyping(_ctx, _activeStudentConvId, 'student', false);
    }

    const name = _ctx.profile?.displayName || _ctx.user?.email;
    try {
      await MediChatService.sendMessage(_ctx, _activeStudentConvId, _ctx.user.uid, name, 'student', text);
    } catch (error) {
      console.error(error);
      showToast('Error al enviar', 'danger');
    }
  }

  async function startChatWithProfessional(profId, profName, profileIdOverride = null, appointmentContext = null) {
    if (!window.MediChatService) return;

    openStudentChat(false);

    try {
      const student = _ctx.user;
      const targetProfileId = profileIdOverride || null;

      const conv = await MediChatService.getOrCreateConversation(
        _ctx,
        student.uid,
        student.displayName || student.email,
        profId,
        profName,
        'student',
        targetProfileId
      );

      openStudentThread(conv.id, profName, profId, targetProfileId, appointmentContext);
    } catch (error) {
      console.error('Error starting chat:', error);
      showToast('Error al iniciar chat', 'danger');
    }
  }

  async function startChatWithStudent(studentUid, studentName) {
    if (!window.MediChatService) return;

    try {
      let profId = _currentProfile ? _currentProfile.id : _myUid;
      const profName = _currentProfile
        ? _currentProfile.displayName
        : (_ctx.user.displayName || 'Profesional');
      let profileContextId = _currentProfile ? _currentProfile.id : null;

      if (!profileContextId && (_myRole === 'Médico' || _myRole === 'Psicologo')) {
        profileContextId = `${_myUid}_${_myRole}`;
        profId = _myUid;
      }

      const conv = await MediChatService.getOrCreateConversation(
        _ctx,
        profId,
        profName,
        studentUid,
        studentName,
        'profesional',
        profileContextId
      );

      const tab = document.getElementById('medi-tab-messages');
      if (tab) tab.classList.remove('d-none');
      if (typeof _switchContextTab === 'function') {
        _switchContextTab('messages');
      }

      const list = document.getElementById('medi-chat-list');
      const panel = document.getElementById('medi-chat-conversation');
      if (list) list.classList.remove('d-none');
      if (panel) panel.classList.add('d-none');

      const openAdminConversation = window.AdminMedi?.openConversation || window.Medi?.openConversation;
      if (typeof openAdminConversation === 'function') {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            openAdminConversation(conv.id, studentName);
          });
        });
      }

      return conv;
    } catch (error) {
      console.error('Error starting chat with student:', error);
      showToast('Error al iniciar chat', 'danger');
      return null;
    }
  }

  // [2D] Helper: insert quick reply into input
  /**
   * Inserta un texto de respuesta rápida en el input del chat.
   * Acepta un string directo (para emojis) o un elemento botón con data-text.
   * @param {string|HTMLElement} btnOrText - Emoji/texto o elemento botón con data-text
   */
  function _insertQuickReply(btnOrText) {
    const input = document.getElementById('stu-chat-input');
    if (!input) return;
    const text = typeof btnOrText === 'string' ? btnOrText : (btnOrText.dataset?.text || '');
    // Insertar en la posición del cursor si el input tiene foco, o append
    const pos = input.selectionStart || input.value.length;
    input.value = input.value.slice(0, pos) + text + input.value.slice(pos);
    input.focus();
    input.selectionStart = input.selectionEnd = pos + text.length;
    document.getElementById('stu-quick-replies')?.remove();
  }

  // [2A] Helper: typing debounce when student types
  function _onChatInputChange() {
    if (!_activeStudentConvId || !window.MediChatService?.setTyping) return;
    MediChatService.setTyping(_ctx, _activeStudentConvId, 'student', true);
    clearTimeout(_chatTypingTimer);
    _chatTypingTimer = setTimeout(() => {
      MediChatService.setTyping(_ctx, _activeStudentConvId, 'student', false);
    }, 3000);
  }

  // Helper: cleanup conv listener when closing thread
  function _closeChatThread() {
    if (_stuConvUnsub) { _stuConvUnsub(); _stuConvUnsub = null; }
    if (_stuMsgsUnsub) { _stuMsgsUnsub(); _stuMsgsUnsub = null; }
    if (_chatTypingTimer) { clearTimeout(_chatTypingTimer); _chatTypingTimer = null; }
    if (_activeStudentConvId && window.MediChatService?.setTyping) {
      MediChatService.setTyping(_ctx, _activeStudentConvId, 'student', false);
    }
    _activeStudentConvId = null;
    _activeConvData = {};
  }



    return {
      renderStudentChat,
      _renderStudentConvList,
      toggleStudentChat,
      openStudentChat,
      openStudentThread,
      _insertQuickReply,
      _onChatInputChange,
      _closeChatThread,
      sendStudentMessage,
      startChatWithProfessional,
      startChatWithStudent
    };
  }
};

