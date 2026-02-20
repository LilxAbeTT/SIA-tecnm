window.MediChatService = (function () {
  const C_CONVS = 'medi-conversations';
  const C_MSGS = 'messages';

  // 1. Create or Get existing conversation
  async function getOrCreateConversation(ctx, myUid, myName, otherUid, otherName, myRole, profileId = null) {
    // Construct a unique ID for the pair? Or Query?
    // Query is safer to avoid race conditions or ID guessing.
    // Rule: 1 Conversation per Student-Professional Pair.
    // For Psychologists with Profiles, the pair is Student-Profile.

    let query = ctx.db.collection(C_CONVS)
      .where('studentId', '==', myRole === 'student' ? myUid : otherUid);

    if (myRole === 'student') {
      // Student looking for conversation with professional
      // We need to know if we are looking for a specific professional (uid) or profile?
      // Usually student clicks "Chat" on a specific appointment or doctor card.
      // If otherUid is passed, use it.
      if (profileId) query = query.where('profesionalProfileId', '==', profileId);
      else query = query.where('profesionalId', '==', otherUid);
    } else {
      // Professional looking for student
      if (profileId) {
        query = query.where('profesionalProfileId', '==', profileId);
      } else {
        query = query.where('profesionalId', '==', myUid);
      }
    }

    const snap = await query.limit(1).get();
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    }

    // Create new
    const docRef = ctx.db.collection(C_CONVS).doc();
    const now = firebase.firestore.FieldValue.serverTimestamp();

    const data = {
      createdAt: now,
      updatedAt: now,
      studentId: myRole === 'student' ? myUid : otherUid,
      studentName: myRole === 'student' ? myName : otherName,
      profesionalId: myRole === 'student' ? otherUid : myUid,
      profesionalName: myRole === 'student' ? otherName : myName,
      profesionalProfileId: profileId || null,
      participants: [myUid, otherUid], // Basic UID array for security rules
      lastMessage: '',
      lastMessageAt: now,
      unreadByStudent: 0,
      unreadByProfesional: 0
    };

    if (profileId) data.participants.push(profileId); // Add profile ID to participants for rules if needed

    await docRef.set(data);
    return { id: docRef.id, ...data };
  }

  // 2. Send Message
  async function sendMessage(ctx, convId, senderUid, senderName, senderRole, text) {
    const convRef = ctx.db.collection(C_CONVS).doc(convId);
    const msgRef = convRef.collection(C_MSGS).doc();
    const now = firebase.firestore.FieldValue.serverTimestamp();

    const batch = ctx.db.batch();

    // Add Message
    batch.set(msgRef, {
      text,
      senderId: senderUid,
      senderName,
      senderRole, // 'profesional' | 'student'
      createdAt: now,
      read: false
    });

    // Update Conversation Metadata
    const updateData = {
      lastMessage: text,
      lastMessageAt: now,
      updatedAt: now
    };

    // Increment counter for the OTHER party
    if (senderRole === 'profesional') {
      updateData.unreadByStudent = firebase.firestore.FieldValue.increment(1);
    } else {
      updateData.unreadByProfesional = firebase.firestore.FieldValue.increment(1);
    }

    batch.update(convRef, updateData);

    await batch.commit();

    // Notify? (Handled by Cloud Functions triggers usually, or client side logic if needed)
    // We can return the message data
    return { id: msgRef.id, text, createdAt: new Date() };
  }

  // 3. Mark as Read
  async function markAsRead(ctx, convId, readerRole) {
    const ref = ctx.db.collection(C_CONVS).doc(convId);
    const field = readerRole === 'profesional' ? 'unreadByProfesional' : 'unreadByStudent';
    await ref.update({ [field]: 0 });
  }

  // 4. Stream Conversations
  function streamConversations(ctx, myUid, myRole, profileId, callback) {
    let q = ctx.db.collection(C_CONVS);

    if (myRole === 'student') {
      q = q.where('studentId', '==', myUid);
    } else {
      // Professional
      if (profileId) {
        q = q.where('profesionalProfileId', '==', profileId);
      } else {
        q = q.where('profesionalId', '==', myUid);
      }
    }

    q = q.orderBy('updatedAt', 'desc');

    return q.onSnapshot(snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(docs);
    }, err => console.error("Stream Convs Error:", err));
  }

  // 5. Stream Messages
  function streamMessages(ctx, convId, callback) {
    const q = ctx.db.collection(C_CONVS).doc(convId).collection(C_MSGS)
      .orderBy('createdAt', 'asc')
      .limit(50); // Valid limit

    return q.onSnapshot(snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(docs);
    }, err => console.error("Stream Msgs Error:", err));
  }

  // 6. Stream Unread Count (Global Badge)
  function streamUnreadCount(ctx, myUid, myRole, profileId, callback) {
    let q = ctx.db.collection(C_CONVS);

    if (myRole === 'student') {
      q = q.where('studentId', '==', myUid);
    } else {
      if (profileId) q = q.where('profesionalProfileId', '==', profileId);
      else q = q.where('profesionalId', '==', myUid);
    }

    // We can't easily sum in Firestore without aggregation queries.
    // For now, client-side sum of the active conversations stream is cheaper/easier 
    // if we are already streaming conversations.
    // BUT if we want just the number without loading all conv data...
    // Let's just reuse streamConversations logic in the UI to count.
    // Or create a simplified stream here.

    return q.onSnapshot(snap => {
      let total = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        if (myRole === 'student') total += (data.unreadByStudent || 0);
        else total += (data.unreadByProfesional || 0);
      });
      callback(total);
    });
  }

  return {
    getOrCreateConversation,
    sendMessage,
    markAsRead,
    streamConversations,
    streamMessages,
    streamUnreadCount
  };
})();
