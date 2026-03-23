// admin.medi.chat.js
if (!window.AdminMedi) window.AdminMedi = {};
window.AdminMedi.Chat = (function () {
  // Sub-module chat
  let _convDocUnsub = null;   // Listener al doc de conversación activa (typing + read status)
  let _profTypingTimer = null; // Debounce para typing status del profesional
  let _prevAdminUnread = 0;    // Para detectar mensajes nuevos y notificar

  function getOperationalContext() {
    return AdminMedi.getOperationalContext ? AdminMedi.getOperationalContext() : {
      ownerUid: AdminMedi.State.myUid,
      profileId: AdminMedi.State.currentProfile ? AdminMedi.State.currentProfile.id : null,
      professionalName: AdminMedi.State.currentProfile
        ? AdminMedi.State.currentProfile.displayName
        : (AdminMedi.State.ctx?.profile?.displayName || AdminMedi.State.ctx?.auth?.currentUser?.email || 'Profesional')
    };
  }

  function setUnreadBadgeCount(count) {
    const badge = document.getElementById('badge-unread-msgs');
    const badgeMobile = document.getElementById('badge-unread-msgs-mobile');
    const badgeCard = document.getElementById('badge-unread-msgs-card');

    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('d-none', count === 0);
    }
    if (badgeMobile) {
      badgeMobile.textContent = count;
      badgeMobile.classList.toggle('d-none', count === 0);
    }
    if (badgeCard) badgeCard.textContent = count;
  }

  function syncAdminConversationHeader(convId, studentName, studentId = '') {
    const convMap = AdminMedi.State.adminConversationMap instanceof Map ? AdminMedi.State.adminConversationMap : new Map();
    const meta = convMap.get(convId) || {};
    const resolvedStudentId = studentId || meta.studentId || '';

    const header = document.getElementById('medi-chat-header-name');
    const headerMeta = document.getElementById('medi-chat-header-meta');
    const recordBtn = document.getElementById('medi-chat-record-btn');
    const bookingBtn = document.getElementById('medi-chat-book-btn');

    if (header) header.textContent = studentName || meta.studentName || 'Chat';
    if (headerMeta) {
      const matricula = meta.studentMatricula || '';
      const lastTime = meta.lastMessageAt
        ? (typeof meta.lastMessageAt.toDate === 'function' ? meta.lastMessageAt.toDate() : new Date(meta.lastMessageAt))
        : null;
      const parts = [];
      if (matricula) parts.push(matricula);
      if (resolvedStudentId) parts.push('Paciente con expediente');
      if (lastTime && !Number.isNaN(lastTime.getTime())) {
        parts.push(`Último mensaje ${lastTime.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`);
      }
      headerMeta.textContent = parts.join(' · ');
    }

    if (recordBtn) {
      recordBtn.disabled = !resolvedStudentId;
      recordBtn.onclick = resolvedStudentId ? () => AdminMedi.showFullRecord(resolvedStudentId) : null;
    }
    if (bookingBtn) {
      bookingBtn.disabled = !resolvedStudentId;
      bookingBtn.onclick = resolvedStudentId ? () => AdminMedi.openManualBooking(resolvedStudentId) : null;
    }
  }

  function isMessagesModalVisible() {
    const modalEl = document.getElementById('modalMessages');
    return !!modalEl && modalEl.classList.contains('show');
  }

  function isAdminConversationVisible() {
    const adminPanel = document.getElementById('medi-chat-conversation');
    const compactPanel = document.getElementById('chat-messages-list');
    const compactVisible = !!(compactPanel && compactPanel.offsetParent !== null);
    return !!((adminPanel && !adminPanel.classList.contains('d-none')) || compactVisible);
  }

  function initAdminChat() {
    if (!window.MediChatService) return;
    if (AdminMedi.State.chatUnsub) {
      AdminMedi.State.chatUnsub();
      AdminMedi.State.chatUnsub = null;
    }

    // Stream conversations list → renders to medi-chat-panel (static HTML)
    startAdminChatStream();

    // Stream unread badge + notificación toast
    if (AdminMedi.State.chatUnreadUnsub) AdminMedi.State.chatUnreadUnsub();
    const operational = getOperationalContext();
    AdminMedi.State.chatUnreadUnsub = MediChatService.streamUnreadCount(
      AdminMedi.State.ctx, operational.ownerUid, 'profesional',
      operational.profileId,
      (count) => {
        const badge = document.getElementById('badge-unread-msgs');
        const badgeMobile = document.getElementById('badge-unread-msgs-mobile');
        setUnreadBadgeCount(count);

        // [2F] Notificar cuando llegan mensajes nuevos y el panel no está visible
        const chatVisible = isMessagesModalVisible() && isAdminConversationVisible();
        if (count > _prevAdminUnread && !chatVisible && window.showToast) {
          showToast(`Nuevo mensaje de un estudiante`, 'info');
        }
        // Pulse animation on tab badge
        if (count > _prevAdminUnread) {
          badge?.classList.add('medi-chat-pulse');
          badgeMobile?.classList.add('medi-chat-pulse');
          setTimeout(() => {
              badge?.classList.remove('medi-chat-pulse');
              badgeMobile?.classList.remove('medi-chat-pulse');
          }, 3000);
        }
        _prevAdminUnread = count;
      }
    );
  }

  function startAdminChatStream() {
    if (AdminMedi.State.adminChatUnsub) AdminMedi.State.adminChatUnsub();

    const operational = getOperationalContext();

    AdminMedi.State.adminChatUnsub = MediChatService.streamConversations(
      AdminMedi.State.ctx,
      operational.ownerUid,
      'profesional',
      operational.profileId,
      (convs) => {
      AdminMedi.State.adminConversationMap = new Map(convs.map((c) => [c.id, c]));
      const list = document.getElementById('medi-chat-list');
      if (!list) return;

      if (convs.length === 0) {
        list.innerHTML = '<div class="text-center py-5 text-muted small"><i class="bi bi-chat-square-text opacity-25 d-block fs-1"></i>Sin mensajes recientes</div>';
        return;
      }

      list.innerHTML = convs.map(c => {
        const unread = (c.unreadByProfesional || 0);
        const date = c.lastMessageAt ? (c.lastMessageAt.toDate ? c.lastMessageAt.toDate() : new Date(c.lastMessageAt)) : new Date();
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
  <div class="p-2 border-bottom hover- cursor-pointer ${unread > 0 ? 'bg-primary bg-opacity-10' : ''}" onclick = "AdminMedi.openAdminConversation('${c.id}', '${escapeHtml(c.studentName)}', '${escapeHtml(c.studentId || '')}')" >
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-bold small text-truncate" style="max-width:120px;">${escapeHtml(c.studentName)}</span>
                        <span class="extra-small text-muted">${time}</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="text-muted small text-truncate d-block" style="max-width:140px; font-size:0.75rem;">${escapeHtml(c.lastMessage || '')}</span>
                        ${unread > 0 ? `<span class="badge bg-danger rounded-pill">${unread}</span>` : ''}
                    </div>
                </div>
  `;
      }).join('');
      }
    );
  }

  function openAdminConversation(convId, studentName, studentId = '') {
    AdminMedi.State.activeAdminConvId = convId;
    const panel = document.getElementById('medi-chat-conversation');
    const list = document.getElementById('medi-chat-list');

    if (list) list.classList.add('d-none'); // Hide list
    if (panel) panel.classList.remove('d-none'); // Show Conversation

    // No longer toggling medi-ctx-messages
    // [FIX] Ensure modal is shown if hidden
    const modalEl = document.getElementById('modalMessages');
    if (modalEl && !modalEl.classList.contains('show')) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    syncAdminConversationHeader(convId, studentName, studentId);

    if (AdminMedi.State.adminMsgsUnsub) AdminMedi.State.adminMsgsUnsub();
    AdminMedi.State.adminMsgsUnsub = MediChatService.streamMessages(AdminMedi.State.ctx, convId, (msgs) => {
      const container = document.getElementById('medi-chat-msgs-admin');
      if (!container) return;

      container.innerHTML = msgs.map(m => {
        const isMe = m.senderRole === 'profesional';
        const time = m.createdAt ? (m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt)) : null;

        return `
  <div class="d-flex ${isMe ? 'justify-content-end' : 'justify-content-start'}" >
    <div class="px-3 py-2 rounded-4 ${isMe ? 'bg-primary text-white rounded-bottom-end-0' : 'bg-white shadow-sm border rounded-bottom-start-0'}" style="max-width:85%; font-size:0.85rem;">
      <div>${escapeHtml(m.text)}</div>
      <div class="${isMe ? 'text-white-50' : 'text-muted'} text-end" style="font-size:0.6rem;">${time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
    </div>
                </div>
  `;
      }).join('');
      container.scrollTop = container.scrollHeight;

      if (isMessagesModalVisible() && AdminMedi.State.activeAdminConvId === convId) {
        MediChatService.markAsRead(AdminMedi.State.ctx, convId, 'profesional').catch(() => {});
      }
    });

    MediChatService.markAsRead(AdminMedi.State.ctx, convId, 'profesional');
  }

  function closeAdminConversation() {
    const list = document.getElementById('medi-chat-list');
    const panel = document.getElementById('medi-chat-conversation');

    if (panel) panel.classList.add('d-none');
    if (list) list.classList.remove('d-none');

    if (AdminMedi.State.adminMsgsUnsub) AdminMedi.State.adminMsgsUnsub();
    AdminMedi.State.adminMsgsUnsub = null;
    AdminMedi.State.activeAdminConvId = null;
  }

  async function sendAdminMessage() {
    const input = document.getElementById('medi-chat-input-admin');
    if (!input) return;
    const text = input.value.trim();
    if (!text || !AdminMedi.State.activeAdminConvId) return;

    input.value = '';
    const operational = getOperationalContext();

    try {
      await MediChatService.sendMessage(
        AdminMedi.State.ctx,
        AdminMedi.State.activeAdminConvId,
        operational.ownerUid,
        operational.professionalName,
        'profesional',
        text
      );
    } catch (e) { console.error(e); }
  }

  function _renderConversationList(convs) {
    const panel = document.getElementById('modal-chat-panel');
    AdminMedi.State.adminConversationMap = new Map(convs.map((c) => [c.id, c]));

    // Update unread badges across the UI
    let totalUnread = 0;
    convs.forEach(c => totalUnread += (c.unreadByProfesional || 0));
    setUnreadBadgeCount(totalUnread);

    if (!panel) return;

    if (convs.length === 0) {
      panel.innerHTML = `<div class="text-center py-4 text-muted small">
        <i class="bi bi-chat-square-dots display-6 d-block mb-2 opacity-25"></i>
        <p style="font-size:.75rem;">Sin conversaciones activas</p>
      </div>`;
      return;
    }

    // If we have an active conversation open, don't replace the chat view
    if (AdminMedi.State.activeConvId) return;
    // Extra safety: If DOM shows we are in chat view, abort list render
    if (document.getElementById('chat-messages-list')) return;

    panel.innerHTML = `
  <div class="list-group list-group-flush">
    ${convs.map(c => {
      const unread = c.unreadByProfesional || 0;
      const lastTime = c.lastMessageAt ? (typeof c.lastMessageAt.toDate === 'function' ? c.lastMessageAt.toDate() : new Date(c.lastMessageAt)) : null;
      const timeStr = lastTime ? lastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return `
            <div class="list-group-item border-0 border-bottom px-2 py-2 cursor-pointer" style="cursor:pointer;"
                 onclick="AdminMedi.openConversation('${c.id}', '${escapeHtml(c.studentName)}')">
              <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center gap-2" style="min-width:0;">
                  <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:28px;height:28px;">
                    <span class="fw-bold text-primary" style="font-size:.7rem;">${escapeHtml((c.studentName || 'E')[0])}</span>
                  </div>
                  <div style="min-width:0;">
                    <div class="fw-bold text-truncate" style="font-size:.8rem;">${escapeHtml(c.studentName || 'Estudiante')}</div>
                    <div class="text-muted text-truncate" style="font-size:.65rem;">${escapeHtml(c.lastMessage || '')}</div>
                  </div>
                </div>
                <div class="text-end flex-shrink-0">
                  <div class="text-muted" style="font-size:.6rem;">${timeStr}</div>
                  ${unread > 0 ? '<span class="badge bg-danger rounded-pill" style="font-size:.6rem;">' + unread + '</span>' : ''}
                </div>
              </div>
            </div>`;
    }).join('')
      }
      </div>`;
  }

  function openConversation(convId, studentName) {
    AdminMedi.State.activeConvId = convId;
    const panel = document.getElementById('modal-chat-panel');
    if (!panel) return;

    const initial = (studentName || 'E')[0].toUpperCase();

    panel.innerHTML = `
      <div class="d-flex flex-column" style="height:calc(min(65vh, 460px));">
        <!-- Header con avatar y nombre -->
        <div class="d-flex align-items-center gap-2 pb-2 border-bottom mb-1 flex-shrink-0">
          <button class="btn btn-sm btn-light rounded-circle p-1" onclick="AdminMedi.closeChatConversation()" style="width:28px;height:28px;">
            <i class="bi bi-arrow-left" style="font-size:.7rem;"></i>
          </button>
          <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center fw-bold text-primary flex-shrink-0"
               style="width:28px;height:28px;font-size:.72rem;">${escapeHtml(initial)}</div>
          <div class="fw-bold text-truncate flex-grow-1" style="font-size:.82rem;">${escapeHtml(studentName || 'Estudiante')}</div>
        </div>
        <!-- Lista de mensajes -->
        <div id="chat-messages-list" class="flex-grow-1 overflow-auto px-1" style="min-height:0;"></div>
        <!-- Typing indicator -->
        <div id="admin-typing-indicator" class="px-1 d-none" style="height:20px;">
          <span class="text-muted" style="font-size:.68rem;">Escribiendo</span>
          <span class="stu-typing-dot ms-1"></span><span class="stu-typing-dot"></span><span class="stu-typing-dot"></span>
        </div>
        <!-- Input -->
        <div class="d-flex gap-1 mt-1 flex-shrink-0">
          <input type="text" id="chat-input" class="form-control form-control-sm rounded-pill"
                 placeholder="Escribe un mensaje..."
                 oninput="AdminMedi._onProfTyping()"
                 onkeypress="if(event.key==='Enter')AdminMedi.sendChatMessage()">
          <button class="btn btn-sm btn-primary rounded-circle flex-shrink-0" onclick="AdminMedi.sendChatMessage()"
                  style="width:30px;height:30px;padding:0;">
            <i class="bi bi-send-fill" style="font-size:.65rem;"></i>
          </button>
        </div>
      </div>`;

    // [2A] Escuchar doc de conversación para typing del estudiante
    if (_convDocUnsub) _convDocUnsub();
    _convDocUnsub = AdminMedi.State.ctx.db.collection('medi-conversations').doc(convId).onSnapshot(snap => {
      const data = snap.data() || {};
      const typingEl = document.getElementById('admin-typing-indicator');
      if (typingEl) typingEl.classList.toggle('d-none', !data.isTypingStudent);
    });

    // Stream mensajes
    if (AdminMedi.State.chatMsgsUnsub) AdminMedi.State.chatMsgsUnsub();
    AdminMedi.State.chatMsgsUnsub = MediChatService.streamMessages(AdminMedi.State.ctx, convId, (msgs) => {
      _renderMessages(msgs);
      if (isMessagesModalVisible() && AdminMedi.State.activeConvId === convId) {
        MediChatService.markAsRead(AdminMedi.State.ctx, convId, 'profesional').catch(() => {});
      }
    });

    MediChatService.markAsRead(AdminMedi.State.ctx, convId, 'profesional');
  }

  // Helper: debounced typing update para el profesional
  function _onProfTyping() {
    const convId = AdminMedi.State.activeConvId;
    if (!convId || !window.MediChatService?.setTyping) return;
    MediChatService.setTyping(AdminMedi.State.ctx, convId, 'profesional', true);
    clearTimeout(_profTypingTimer);
    _profTypingTimer = setTimeout(() => {
      MediChatService.setTyping(AdminMedi.State.ctx, convId, 'profesional', false);
    }, 3000);
  }

  function _renderMessages(msgs) {
    const container = document.getElementById('chat-messages-list');
    if (!container) return;

    if (msgs.length === 0) {
      container.innerHTML = `<div class="text-center text-muted py-4" style="font-size:.75rem;">
        <i class="bi bi-chat-dots d-block fs-3 opacity-25 mb-2"></i>
        Inicia la conversación
      </div>`;
      return;
    }

    container.innerHTML = msgs.map(m => {
      const isMe = m.senderRole === 'profesional';
      const time = m.createdAt ? (typeof m.createdAt.toDate === 'function' ? m.createdAt.toDate() : new Date(m.createdAt)) : null;
      const timeStr = time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return `
      <div class="d-flex ${isMe ? 'justify-content-end' : 'justify-content-start'} mb-2">
        <div class="px-3 py-2 rounded-4 shadow-sm ${isMe ? 'bg-primary text-white rounded-bottom-end-0' : 'bg-white border rounded-bottom-start-0'}"
             style="max-width:82%;font-size:.78rem;">
          <div>${escapeHtml(m.text)}</div>
          <div class="${isMe ? 'text-white-50' : 'text-muted'} text-end" style="font-size:.58rem;">${timeStr}</div>
        </div>
      </div>`;
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!input || !input.value.trim() || !AdminMedi.State.activeConvId) return;

    const text = input.value.trim();
    input.value = '';

    // Limpiar typing status al enviar
    clearTimeout(_profTypingTimer);
    _profTypingTimer = null;
    if (window.MediChatService?.setTyping) {
      MediChatService.setTyping(AdminMedi.State.ctx, AdminMedi.State.activeConvId, 'profesional', false);
    }

    try {
      const operational = getOperationalContext();
      await MediChatService.sendMessage(
        AdminMedi.State.ctx, AdminMedi.State.activeConvId,
        operational.ownerUid,
        operational.professionalName,
        'profesional',
        text
      );
    } catch (e) {
      console.error('Send message error:', e);
      if (window.showToast) showToast('Error al enviar mensaje', 'danger');
    }
  }

  function closeChatConversation() {
    // Limpiar typing status del profesional al salir
    if (AdminMedi.State.activeConvId && window.MediChatService?.setTyping) {
      clearTimeout(_profTypingTimer);
      MediChatService.setTyping(AdminMedi.State.ctx, AdminMedi.State.activeConvId, 'profesional', false);
    }

    AdminMedi.State.activeConvId = null;
    if (AdminMedi.State.chatMsgsUnsub) { AdminMedi.State.chatMsgsUnsub(); AdminMedi.State.chatMsgsUnsub = null; }
    if (_convDocUnsub) { _convDocUnsub(); _convDocUnsub = null; }

    const panel = document.getElementById('modal-chat-panel');
    if (panel) panel.innerHTML = '<div class="text-center py-4"><span class="spinner-border spinner-border-sm text-primary"></span></div>';

    if (AdminMedi.State.chatUnsub) AdminMedi.State.chatUnsub();
    const operational = getOperationalContext();
    AdminMedi.State.chatUnsub = MediChatService.streamConversations(
      AdminMedi.State.ctx, operational.ownerUid, 'profesional',
      operational.profileId,
      (convs) => { _renderConversationList(convs); }
    );
  }

  async function startChatWith(studentId, studentName) {
    if (!window.MediChatService) { showToast('Chat no disponible', 'warning'); return; }

    try {
      const operational = getOperationalContext();
      const conv = await MediChatService.getOrCreateConversation(
        AdminMedi.State.ctx,
        operational.ownerUid,
        operational.professionalName,
        studentId,
        studentName,
        'profesional',
        operational.profileId
      );

      openMessagesModal();
      openAdminConversation(conv.id, studentName, studentId);
    } catch (e) {
      console.error(e);
      showToast('Error al iniciar chat', 'danger');
    }
  }

  function openMessagesModal() {
    const modalEl = document.getElementById('modalMessages');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
        setTimeout(() => {
          const input = document.getElementById('msg-search-input');
          const resultDiv = document.getElementById('msg-search-result');
          if (resultDiv) resultDiv.innerHTML = '';
          if (input) input.focus();
        }, 150);
    }
  }

  async function searchAndChat() {
    const input = document.getElementById('msg-search-input');
    const resultDiv = document.getElementById('msg-search-result');
    if (!input || !resultDiv) return;
    const query = input.value.trim();
    if (!query || query.length < 2) {
      resultDiv.innerHTML = '';
      return;
    }

    resultDiv.innerHTML = '<div class="text-center py-2"><span class="spinner-border spinner-border-sm"></span></div>';

    try {
      const found = await MediService.buscarPaciente(AdminMedi.State.ctx, query);
      if (found) {
        found.uid = found.id;
        resultDiv.innerHTML = `
  <div class="d-flex align-items-center gap-3 p-2 bg-white rounded-3 shadow-sm" >
            <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:38px;height:38px;">
              <span class="fw-bold text-primary">${(found.displayName || 'E')[0].toUpperCase()}</span>
            </div>
            <div class="flex-grow-1">
              <h6 class="fw-bold mb-0 small">${escapeHtml(found.displayName || found.email)}</h6>
              <small class="text-muted">${escapeHtml(found.matricula || '')}</small>
            </div>
            <button class="btn btn-sm btn-primary rounded-pill px-3 fw-bold" onclick="AdminMedi.startChatWithStudent('${found.id}', '${escapeHtml(found.displayName || found.email)}');">
              <i class="bi bi-chat-dots me-1"></i>Chatear
            </button>
          </div> `;
      } else {
        resultDiv.innerHTML = '<div class="text-muted small text-center py-1"><i class="bi bi-person-x me-1"></i>No encontrado</div>';
      }
    } catch (e) {
      console.error(e);
      resultDiv.innerHTML = '<div class="text-danger small">Error al buscar</div>';
    }
  }

  async function startChatWithStudent(studentUid, studentName) {
    if (!window.MediChatService) return;

    try {
      const operational = getOperationalContext();

      const conv = await MediChatService.getOrCreateConversation(
        AdminMedi.State.ctx,
        operational.ownerUid,
        operational.professionalName,
        studentUid,
        studentName,
        'profesional', // My Role
        operational.profileId
      );

      const modalEl = document.getElementById('modalMessages');
      if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          console.log(`[Medi] Opening admin conversation for ${studentName}(convId: ${conv.id})`);
          openAdminConversation(conv.id, studentName, studentId);
        });
      });

    } catch (e) {
      console.error("Error starting chat with student:", e);
      showToast("Error al iniciar chat", "danger");
    }
  }

  return {
    initAdminChat,
    startAdminChatStream,
    openAdminConversation,
    closeAdminConversation,
    sendAdminMessage,
    _renderConversationList,
    openConversation,
    _renderMessages,
    sendChatMessage,
    closeChatConversation,
    startChatWith,
    openMessagesModal,
    searchAndChat,
    startChatWithStudent,
    _onProfTyping,
  };
})();
