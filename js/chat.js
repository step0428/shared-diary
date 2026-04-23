let currentConversationId = null;
let unsubscribeChatListener = null;
let unsubscribeConversationsListener = null;

function setupChat() {
    const chatModal = document.getElementById('chatInterfaceModal');
    if (!chatModal) return;

    document.getElementById('closeChatInterfaceModal').addEventListener('click', () => {
        chatModal.classList.add('hidden');
        if (unsubscribeChatListener) {
            unsubscribeChatListener();
            unsubscribeChatListener = null;
        }
        currentConversationId = null;
    });

    document.getElementById('chatInputForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('chatMessageInput');
        const text = input.value.trim();
        if (text && currentConversationId) {
            sendMessage(currentConversationId, text);
            input.value = '';
        }
    });

    // 绑定“让ta回复”按钮 (仅AI私聊时有效)
    document.getElementById('askAIReplyBtn').addEventListener('click', function() {
        if (currentConversationId && typeof getAIChatResponse === 'function') {
            getAIChatResponse(currentConversationId, this);
        }
    });

    // 绑定“发起新聊天”入口
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', openNewChatModal);
    }
    
    const closeNewChatModalBtn = document.getElementById('closeNewChatModal');
    if (closeNewChatModalBtn) {
        closeNewChatModalBtn.addEventListener('click', () => {
            document.getElementById('newChatModal').classList.add('hidden');
        });
    }

    // 绑定右上角菜单（删除对话）
    const chatMenuBtn = document.getElementById('chatMenuBtn');
    if (chatMenuBtn) {
        chatMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const existingMenu = document.getElementById('chatHeaderMenu');
            if (existingMenu) { existingMenu.remove(); return; }

            const menu = document.createElement('div');
            menu.id = 'chatHeaderMenu';
            menu.style.cssText = 'position:absolute; right:20px; top:50px; background:var(--bg-secondary); border:1px solid var(--border); border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.2); z-index: 3000; overflow:hidden; min-width:120px;';
            menu.innerHTML = `<div style="padding:12px 16px; cursor:pointer; font-size:14px; color:#ff6b6b; display:flex; align-items:center; gap:8px;" onclick="deleteConversation('${currentConversationId}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> 清空对话</div>`;
            
            document.getElementById('chatInterfaceModal').querySelector('.modal-content').appendChild(menu);

            setTimeout(() => {
                const closeHeaderMenu = (ev) => {
                    if (!menu.contains(ev.target)) {
                        menu.remove();
                        document.removeEventListener('click', closeHeaderMenu);
                    }
                };
                document.addEventListener('click', closeHeaderMenu);
            }, 0);
        });
    }

    // 绑定长按/右键菜单
    document.getElementById('chatMessages').addEventListener('contextmenu', (e) => {
        const bubble = e.target.closest('.message-bubble');
        if (bubble && currentConversationId) {
            e.preventDefault(); // 阻止浏览器默认右键菜单
            showChatMessageMenu(bubble, currentConversationId, e);
        }
    });
}

async function openNewChatModal() {
    const modal = document.getElementById('newChatModal');
    const listEl = document.getElementById('newChatContactList');
    listEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);"><div class="loading-ring" style="width:20px;height:20px;margin:0 auto 10px;"></div>加载联系人...</div>';
    modal.classList.remove('hidden');

    try {
        let linkedIds = await getLinkedUserIds();
        let userInfos = await getBatchUserInfo(linkedIds);

        listEl.innerHTML = '';

        // 1. 添加 AI 伴侣
        if (currentUserData && currentUserData.aiConfig && currentUserData.aiConfig.enabled) {
            let activeChar = (currentUserData.aiConfig.chars || []).find(c => c.id === currentUserData.aiConfig.activeCharId) || (currentUserData.aiConfig.chars || [])[0] || {};
            let aiName = (activeChar.name || '神秘的ta') + ' 🤖';
            let aiAvatar = activeChar.avatar || '🤖';
            
            let item = document.createElement('div');
            item.style.cssText = 'display:flex;align-items:center;padding:12px;background:var(--bg-tertiary);border-radius:10px;cursor:pointer;transition:all 0.2s;border:1px solid var(--border);';
            item.innerHTML = (aiAvatar.startsWith('http') ? `<img src="${escapeHtml(aiAvatar)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;margin-right:12px;border:1px solid rgba(255,255,255,0.2);">` : `<span style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#8e44ad;font-size:20px;color:#fff;margin-right:12px;">${escapeHtml(aiAvatar)}</span>`) + `<span style="font-size:15px;color:var(--text-primary);font-weight:500;">${escapeHtml(aiName)}</span>`;
            item.onclick = () => { modal.classList.add('hidden'); openChat(AI_COMPANION_USER_ID, aiName, aiAvatar); };
            listEl.appendChild(item);
        }

        // 2. 添加真人好友
        userInfos.forEach(u => {
            let item = document.createElement('div');
            item.style.cssText = 'display:flex;align-items:center;padding:12px;background:var(--bg-tertiary);border-radius:10px;cursor:pointer;transition:all 0.2s;border:1px solid var(--border);';
            item.innerHTML = renderUserAvatar({userId: u.userId, displayName: u.displayName, avatarUrl: u.avatarUrl}, 40, '12px') + `<span style="font-size:15px;color:var(--text-primary);font-weight:500;">${escapeHtml(u.displayName)}</span>`;
            item.onclick = () => { modal.classList.add('hidden'); openChat(u.userId, u.displayName, u.avatarUrl); };
            listEl.appendChild(item);
        });

        if (listEl.children.length === 0) {
            listEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">暂无联系人</div>';
        }
    } catch (e) {
        console.error("加载联系人失败:", e);
        listEl.innerHTML = '<div style="text-align:center;padding:30px;color:#ff6b6b;">加载失败，请重试</div>';
    }
}

async function loadConversations() {
    if (!currentUser) return;
    const listEl = document.getElementById('conversationList');
    listEl.innerHTML = '<div class="empty-state">加载中...</div>';

    if (unsubscribeConversationsListener) unsubscribeConversationsListener();

    unsubscribeConversationsListener = db.collection('conversations')
        .where('participants', 'array-contains', currentUser.uid)
        .orderBy('updatedAt', 'desc')
        .onSnapshot(async (snapshot) => {
            if (snapshot.empty) {
                listEl.innerHTML = '<div class="empty-state">还没有私信，快去和朋友或ta聊聊吧</div>';
                return;
            }

            listEl.innerHTML = '';
            const userIdsToFetch = new Set();
            snapshot.docs.forEach(doc => {
                doc.data().participants.forEach(uid => {
                    if (uid !== currentUser.uid) userIdsToFetch.add(uid);
                });
            });

            const userInfos = await getBatchUserInfo(Array.from(userIdsToFetch));
            const userInfoMap = new Map(userInfos.map(u => [u.userId, u]));

            if (currentUserData.aiConfig && currentUserData.aiConfig.enabled) {
                 let activeChar = (currentUserData.aiConfig.chars || []).find(c => c.id === currentUserData.aiConfig.activeCharId) || (currentUserData.aiConfig.chars || [])[0] || {};
                 userInfoMap.set(AI_COMPANION_USER_ID, {
                     userId: AI_COMPANION_USER_ID,
                     displayName: (activeChar.name || '神秘的ta') + ' 🤖',
                     avatarUrl: activeChar.avatar || '🤖'
                 });
            }

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const otherUserId = data.participants.find(p => p !== currentUser.uid);
                const otherUserInfo = userInfoMap.get(otherUserId) || { displayName: '未知用户', avatarUrl: '' };

                const item = document.createElement('div');
                item.className = 'conversation-item';
                item.onclick = () => openChat(otherUserId, otherUserInfo.displayName, otherUserInfo.avatarUrl);

                const avatar = renderUserAvatar(otherUserInfo, 48);
                const lastMessage = data.lastMessage ? escapeHtml(data.lastMessage.text) : '...';
                const time = data.updatedAt ? new Date(data.updatedAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                
                item.innerHTML = `
                    ${avatar}
                    <div class="conversation-details">
                        <div class="conversation-header">
                            <span class="conversation-name">${escapeHtml(otherUserInfo.displayName)}</span>
                            <span class="conversation-time">${time}</span>
                        </div>
                        <div class="conversation-preview">${lastMessage}</div>
                    </div>
                `;
                listEl.appendChild(item);
            });
        });
}

async function openChat(otherUserId, otherUserName, otherUserAvatar) {
    if (!currentUser) return;
    
    const conversationId = [currentUser.uid, otherUserId].sort().join('_');
    currentConversationId = conversationId;

    const convRef = db.collection('conversations').doc(conversationId);
    const convSnap = await convRef.get();

    if (!convSnap.exists) {
        await convRef.set({
            participants: [currentUser.uid, otherUserId].sort(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessage: { text: '我们现在是好友了，开始聊天吧！', senderId: 'system', timestamp: firebase.firestore.FieldValue.serverTimestamp() }
        });
    }

    renderChatInterface(conversationId, otherUserName, otherUserAvatar, otherUserId === AI_COMPANION_USER_ID);
}

// --- 私聊高级操作 (删对话、撤回、重roll) ---

window.deleteConversation = async function(convId) {
    if (!confirm('危险操作：确定要彻底清空此对话的所有聊天记录吗？清空后无法恢复！')) return;
    const menu = document.getElementById('chatHeaderMenu');
    if (menu) menu.remove();
    
    document.getElementById('chatInterfaceModal').classList.add('hidden');
    currentConversationId = null;

    try {
        const msgs = await db.collection('conversations').doc(convId).collection('messages').get();
        const batch = db.batch();
        msgs.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        await db.collection('conversations').doc(convId).delete();
    } catch (e) {
        console.error("清空对话失败:", e);
    }
};

function showChatMessageMenu(bubbleEl, conversationId, e) {
    document.querySelectorAll('.chat-msg-menu').forEach(m => m.remove());

    const msgId = bubbleEl.dataset.msgId;
    const isMine = bubbleEl.dataset.isMine === 'true';
    const timestamp = parseInt(bubbleEl.dataset.timestamp);
    const isAI = document.getElementById('chatMessages').dataset.isAiChat === 'true';
    
    const isWithin2Mins = (Date.now() - timestamp) < 2 * 60 * 1000;

    let html = '';
    if (isMine) {
        if (isWithin2Mins) html += `<div class="menu-item" style="padding:12px 20px; cursor:pointer; font-size:14px; color:var(--text-primary);" onclick="recallChatMessage('${conversationId}', '${msgId}')">撤回</div>`;
        if (isAI && bubbleEl.dataset.isLastUser === 'true') html += `<div class="menu-item" style="padding:12px 20px; cursor:pointer; font-size:14px; color:var(--accent);" onclick="regenerateLastAIResponse('${conversationId}')">🎲 重新生成回答</div>`;
        html += `<div class="menu-item" style="padding:12px 20px; cursor:pointer; font-size:14px; color:#ff6b6b;" onclick="deleteChatMessage('${conversationId}', '${msgId}')">删除</div>`;
    } else {
        html += `<div class="menu-item" style="padding:12px 20px; cursor:pointer; font-size:14px; color:#ff6b6b;" onclick="deleteChatMessage('${conversationId}', '${msgId}')">删除</div>`;
    }

    if (!html) return;

    const menu = document.createElement('div');
    menu.className = 'chat-msg-menu';
    menu.style.cssText = `position:fixed; background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; box-shadow:0 6px 16px rgba(0,0,0,0.3); z-index: 3100; display:flex; flex-direction:column; overflow:hidden; min-width:120px; left:${e.clientX}px; top:${e.clientY}px;`;
    menu.innerHTML = html;
    document.body.appendChild(menu);

    setTimeout(() => {
        const closeMenu = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', closeMenu); } };
        document.addEventListener('click', closeMenu);
    }, 0);
}

window.deleteChatMessage = async function(convId, msgId) { document.querySelectorAll('.chat-msg-menu').forEach(m => m.remove()); await db.collection('conversations').doc(convId).collection('messages').doc(msgId).delete(); };

window.recallChatMessage = async function(convId, msgId) { document.querySelectorAll('.chat-msg-menu').forEach(m => m.remove()); await db.collection('conversations').doc(convId).collection('messages').doc(msgId).delete(); };

window.regenerateLastAIResponse = async function(convId) {
    document.querySelectorAll('.chat-msg-menu').forEach(m => m.remove());
    try {
        // 查找并删除此对话末尾所有 AI 发送的消息
        const msgsSnap = await db.collection('conversations').doc(convId).collection('messages').orderBy('createdAt', 'desc').limit(20).get();
        const batch = db.batch();
        let deletedCount = 0;
        for (let doc of msgsSnap.docs) {
            if (doc.data().senderId === AI_COMPANION_USER_ID) {
                batch.delete(doc.ref);
                deletedCount++;
            } else {
                break; // 遇到用户发出的消息即停止删除
            }
        }
        if (deletedCount > 0) {
            await batch.commit();
        }
        // 重新请求 AI 回复
        if (typeof getAIChatResponse === 'function') {
            getAIChatResponse(convId, document.getElementById('askAIReplyBtn'));
        }
    } catch(e) {
        console.error("重新生成失败:", e);
    }
};

async function renderChatInterface(conversationId, otherUserName, otherUserAvatar, isAI) {
    const modal = document.getElementById('chatInterfaceModal');
    const header = document.getElementById('chatWithUserName');
    const messagesEl = document.getElementById('chatMessages');
    const askBtn = document.getElementById('askAIReplyBtn');

    if (askBtn) askBtn.style.display = isAI ? 'flex' : 'none';
    if (messagesEl) messagesEl.dataset.isAiChat = isAI ? 'true' : 'false';

    header.textContent = otherUserName;
    messagesEl.innerHTML = '<div class="empty-state">加载消息...</div>';
    modal.classList.remove('hidden');

    if (unsubscribeChatListener) unsubscribeChatListener();

    // 预渲染双方头像 HTML
    const myAvatarHtml = renderUserAvatar(currentUserData, 32, '0');
    const theirAvatarHtml = renderUserAvatar({ userId: isAI ? AI_COMPANION_USER_ID : conversationId.replace(currentUser.uid, '').replace('_', ''), displayName: otherUserName, avatarUrl: otherUserAvatar, aiAvatar: otherUserAvatar }, 32, '0');

    unsubscribeChatListener = db.collection('conversations').doc(conversationId).collection('messages')
        .orderBy('createdAt', 'asc')
        .limitToLast(100)
        .onSnapshot(snapshot => {
            messagesEl.innerHTML = '';
            const docs = snapshot.docs;
            
            // 寻找最后一条由用户发出的消息ID
            let lastUserMsgId = null;
            docs.forEach(doc => {
                if (doc.data().senderId === currentUser.uid) lastUserMsgId = doc.id;
            });

            docs.forEach((doc, index) => {
                const msg = doc.data();
                const isMine = msg.senderId === currentUser.uid;
                const timeMillis = msg.createdAt ? msg.createdAt.toMillis() : Date.now();
                const messageDiv = document.createElement('div');
                messageDiv.className = `chat-message ${isMine ? 'sent' : 'received'}`;

                messageDiv.innerHTML = `
                    ${isMine ? myAvatarHtml : theirAvatarHtml}
                    <div class="message-bubble" data-msg-id="${doc.id}" data-is-mine="${isMine}" data-is-last-user="${doc.id === lastUserMsgId}" data-timestamp="${timeMillis}">${escapeHtml(msg.text)}</div>
                `;
                messagesEl.appendChild(messageDiv);
            });
            messagesEl.scrollTop = messagesEl.scrollHeight;
        });
}

async function sendMessage(conversationId, text, isSilent = false, customSenderId = null) {
    if (!currentUser || !text) return;
    const otherUserId = conversationId.replace(currentUser.uid, '').replace('_', '');
    const senderId = customSenderId || currentUser.uid;

    // 触发纯前端动态记忆提取引擎 (后台静默运行，不阻塞 UI)
    if (!isSilent && text && text.trim().length > 5 && senderId === currentUser.uid) { // 只提取用户自己发的消息
        if (typeof extractAndSaveMemory === 'function') {
            extractAndSaveMemory(text);
        }
    }

    const message = { senderId: senderId, text: text, createdAt: firebase.firestore.FieldValue.serverTimestamp(), isAIDiary: senderId === AI_COMPANION_USER_ID };
    const convRef = db.collection('conversations').doc(conversationId);
    await convRef.collection('messages').add(message);
    await convRef.update({
        lastMessage: { text, senderId: senderId, timestamp: firebase.firestore.FieldValue.serverTimestamp() },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}