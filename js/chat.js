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

    window.selectedChatImageFile = null;
    const chatImageBtn = document.getElementById('chatImageUploadBtn');
    const chatImageInput = document.getElementById('chatImageInput');
    const chatImagePreviewContainer = document.getElementById('chatImagePreviewContainer');
    const chatImagePreview = document.getElementById('chatImagePreview');
    const removeChatImageBtn = document.getElementById('removeChatImageBtn');

    if (chatImageBtn) chatImageBtn.addEventListener('click', () => chatImageInput.click());
    
    if (chatImageInput) {
        chatImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                window.selectedChatImageFile = file;
                chatImagePreview.src = URL.createObjectURL(file);
                chatImagePreviewContainer.style.display = 'block';
                chatImageBtn.style.color = 'var(--accent)';
            }
            e.target.value = '';
        });
    }

    if (removeChatImageBtn) {
        removeChatImageBtn.addEventListener('click', () => {
            window.selectedChatImageFile = null;
            chatImagePreviewContainer.style.display = 'none';
            chatImagePreview.src = '';
            chatImageBtn.style.color = 'var(--text-muted)';
        });
    }

    // 新增：动态注入私聊语音按钮及录音逻辑
    if (chatImageBtn && !document.getElementById('chatRecordBtn')) {
        const chatRecordBtn = document.createElement('button');
        chatRecordBtn.id = 'chatRecordBtn';
        chatRecordBtn.type = 'button';
        chatRecordBtn.innerHTML = '🎤';
        chatRecordBtn.title = '点击开始/停止录音';
        chatRecordBtn.style.cssText = 'background:none; border:none; font-size:18px; cursor:pointer; color:var(--text-muted); padding:0 8px; transition:color 0.2s; display:flex; align-items:center;';
        chatImageBtn.parentNode.insertBefore(chatRecordBtn, chatImageBtn.nextSibling);

        let chatMediaRecorder = null;
        let chatAudioChunks = [];
        let chatSpeechRecognition = null;
        let chatTranscript = '';
        let isChatRecording = false;

        chatRecordBtn.addEventListener('click', async () => {
            if (isChatRecording) {
                chatMediaRecorder.stop();
                if (chatSpeechRecognition) chatSpeechRecognition.stop();
                isChatRecording = false;
                chatRecordBtn.style.color = 'var(--text-muted)';
                chatRecordBtn.style.animation = 'none';
                document.getElementById('chatMessageInput').placeholder = '输入消息...';
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                chatMediaRecorder = new MediaRecorder(stream);
                chatAudioChunks = [];
                chatTranscript = '';

                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (SpeechRecognition) {
                    chatSpeechRecognition = new SpeechRecognition();
                    chatSpeechRecognition.continuous = true;
                    chatSpeechRecognition.interimResults = true;
                    chatSpeechRecognition.onresult = (e) => {
                        let final = '';
                        for (let i = e.resultIndex; i < e.results.length; ++i) {
                            if (e.results[i].isFinal) final += e.results[i][0].transcript;
                        }
                        chatTranscript += final;
                    };
                    chatSpeechRecognition.start();
                }

                chatMediaRecorder.ondataavailable = e => chatAudioChunks.push(e.data);
                chatMediaRecorder.onstop = async () => {
                    stream.getTracks().forEach(track => track.stop());
                    if (chatAudioChunks.length === 0) return;
                    
                    const audioBlob = new Blob(chatAudioChunks, { type: 'audio/webm' });
                    const sendBtn = document.getElementById('sendChatMessageBtn');
                    const origText = sendBtn.textContent;
                    sendBtn.textContent = '⬆️';
                    sendBtn.disabled = true;
                    
                    try {
                        const audioUrl = await uploadToCloudinary(audioBlob);
                        let finalMsgText = chatTranscript.trim() || '[语音消息]';
                        // 发送带有语音链接和识别文本的消息
                        await sendMessage(currentConversationId, finalMsgText, false, null, null, audioUrl, chatTranscript.trim());
                    } catch(e) { 
                        console.error(e); alert("语音发送失败"); 
                    } finally { 
                        sendBtn.textContent = origText; sendBtn.disabled = false; 
                        document.getElementById('chatMessageInput').placeholder = '输入消息...';
                    }
                };

                chatMediaRecorder.start();
                isChatRecording = true;
                chatRecordBtn.style.color = '#ff6b6b';
                chatRecordBtn.style.animation = 'pulse 1.5s infinite';
                document.getElementById('chatMessageInput').placeholder = '正在聆听... (点击麦克风停止)';
            } catch(e) { 
                alert("无法访问麦克风，请检查权限"); 
            }
        });
    }

    document.getElementById('chatInputForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('chatMessageInput');
        const text = input.value.trim();
        const imageFile = window.selectedChatImageFile;
        
        if ((text || imageFile) && currentConversationId) {
            const sendBtn = document.getElementById('sendChatMessageBtn');
            const origText = sendBtn.textContent;
            sendBtn.textContent = '...';
            sendBtn.disabled = true;
            
            try {
                let imageUrl = null;
                if (imageFile) {
                    imageUrl = await uploadToCloudinary(imageFile);
                }
                await sendMessage(currentConversationId, text, false, null, imageUrl);
                input.value = '';
                if (removeChatImageBtn) removeChatImageBtn.click();
            } catch(err) {
                console.error("发送失败:", err);
                alert("发送失败，请重试");
            } finally {
                sendBtn.textContent = origText;
                sendBtn.disabled = false;
            }
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

window.openNewChatModal = async function() {
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
            let chars = currentUserData.aiConfig.chars || [];
            if (chars.length === 0) chars = [{ id: typeof AI_COMPANION_USER_ID !== 'undefined' ? AI_COMPANION_USER_ID : 'char_ai', name: '神秘的ta', avatar: '🤖' }];
            chars.forEach(char => {
                let aiName = (char.name || '神秘的ta') + ' 🤖';
                let aiAvatar = char.avatar || '🤖';
                let item = document.createElement('div');
                item.style.cssText = 'display:flex;align-items:center;padding:12px;background:var(--bg-tertiary);border-radius:10px;cursor:pointer;transition:all 0.2s;border:1px solid var(--border);';
                item.innerHTML = (aiAvatar.startsWith('http') ? `<img src="${escapeHtml(aiAvatar)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;margin-right:12px;border:1px solid rgba(255,255,255,0.2);">` : `<span style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#8e44ad;font-size:20px;color:#fff;margin-right:12px;">${escapeHtml(aiAvatar)}</span>`) + `<span style="font-size:15px;color:var(--text-primary);font-weight:500;">${escapeHtml(aiName)}</span>`;
                item.onclick = () => { modal.classList.add('hidden'); openChat(char.id, aiName, aiAvatar); };
                listEl.appendChild(item);
            });
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

let currentConversationRenderToken = 0;

async function loadConversations() {
    if (!currentUser) return;
    const listEl = document.getElementById('conversationList');
    listEl.innerHTML = '<div class="empty-state">加载中...</div>';

    if (unsubscribeConversationsListener) unsubscribeConversationsListener();

    unsubscribeConversationsListener = db.collection('conversations')
        .where('participants', 'array-contains', currentUser.uid)
        .orderBy('updatedAt', 'desc')
        .onSnapshot(async (snapshot) => {
            const token = ++currentConversationRenderToken;

            if (snapshot.empty) {
                if (token === currentConversationRenderToken) {
                    listEl.innerHTML = '<div class="empty-state">还没有私信，快去和朋友或ta聊聊吧</div>';
                }
                return;
            }

            const userIdsToFetch = new Set();
            snapshot.docs.forEach(doc => {
                doc.data().participants.forEach(uid => {
                    if (uid !== currentUser.uid) userIdsToFetch.add(uid);
                });
            });

            const userInfos = await getBatchUserInfo(Array.from(userIdsToFetch));
            
            if (token !== currentConversationRenderToken) return;
            listEl.innerHTML = '';

            const userInfoMap = new Map(userInfos.map(u => [u.userId, u]));

            if (currentUserData.aiConfig && currentUserData.aiConfig.enabled) {
                 let chars = currentUserData.aiConfig.chars || [];
                 chars.forEach(char => {
                     userInfoMap.set(char.id, { userId: char.id, displayName: (char.name || '神秘的ta') + ' 🤖', avatarUrl: '', aiAvatar: char.avatar || '🤖' });
                 });
                 if (typeof AI_COMPANION_USER_ID !== 'undefined') {
                     let activeChar = chars.find(c => c.id === currentUserData.aiConfig.activeCharId) || chars[0] || {};
                     userInfoMap.set(AI_COMPANION_USER_ID, {
                         userId: AI_COMPANION_USER_ID,
                         displayName: (activeChar.name || '神秘的ta') + ' 🤖',
                         avatarUrl: '', aiAvatar: activeChar.avatar || '🤖'
                     });
                 }
            }

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const otherUserId = data.participants.find(p => p !== currentUser.uid);
                const otherUserInfo = userInfoMap.get(otherUserId) || { displayName: '未知用户', avatarUrl: '' };

                const item = document.createElement('div');
                item.className = 'conversation-item';
                item.onclick = () => openChat(otherUserId, otherUserInfo.displayName, otherUserInfo.aiAvatar || otherUserInfo.avatarUrl);

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
    const rawTextData = bubbleEl.dataset.rawText || '';
    
    const isWithin2Mins = (Date.now() - timestamp) < 2 * 60 * 1000;

    let html = '';

    if (rawTextData) {
        html += `<div class="menu-item" style="padding:12px 20px; cursor:pointer; font-size:14px; color:var(--text-primary);" onclick="editChatMessage('${conversationId}', '${msgId}', '${rawTextData}')">编辑</div>`;
        html += `<div class="menu-item" style="padding:12px 20px; cursor:pointer; font-size:14px; color:var(--text-primary);" onclick="copyChatMessage('${rawTextData}')">复制</div>`;
    }

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

window.copyChatMessage = function(encodedText) {
    document.querySelectorAll('.chat-msg-menu').forEach(m => m.remove());
    try {
        const text = decodeURIComponent(encodedText);
        navigator.clipboard.writeText(text).then(() => {
            const toast = document.createElement('div');
            toast.textContent = '已复制';
            toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.7);color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;z-index:9999;pointer-events:none;';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 1500);
        }).catch(err => {
            console.error("复制失败:", err);
            alert("复制失败");
        });
    } catch(e) {
        console.error("复制解析失败:", e);
    }
};

window.editChatMessage = function(convId, msgId, encodedText) {
    document.querySelectorAll('.chat-msg-menu').forEach(m => m.remove());
    try {
        const oldText = decodeURIComponent(encodedText);
        showInputModal('编辑消息', '修改消息内容', oldText, async function(newText) {
            if (newText && newText.trim() !== oldText) {
                try {
                    const docRef = db.collection('conversations').doc(convId).collection('messages').doc(msgId);
                    const docSnap = await docRef.get();
                    if (docSnap.exists) {
                        const data = docSnap.data();
                        if (data.audioUrl) {
                            await docRef.update({ audioText: newText.trim() });
                        } else {
                            await docRef.update({ text: newText.trim() });
                        }
                    }
                } catch(e) {
                    console.error('编辑失败:', e);
                    alert('编辑消息失败，请检查权限');
                }
            }
        });
    } catch(e) {
        console.error("编辑解析失败:", e);
    }
};

window.regenerateLastAIResponse = async function(convId) {
    document.querySelectorAll('.chat-msg-menu').forEach(m => m.remove());
    try {
        // 查找并删除此对话末尾所有 AI 发送的消息
        const msgsSnap = await db.collection('conversations').doc(convId).collection('messages').orderBy('createdAt', 'desc').limit(20).get();
        const batch = db.batch();
        let deletedCount = 0;
        for (let doc of msgsSnap.docs) {
            if (doc.data().senderId === AI_COMPANION_USER_ID || String(doc.data().senderId).startsWith('char_')) {
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

    if (askBtn) askBtn.style.display = (isAI || String(conversationId).includes('char_')) ? 'flex' : 'none';
    if (messagesEl) messagesEl.dataset.isAiChat = isAI ? 'true' : 'false';

    header.textContent = otherUserName;
    messagesEl.innerHTML = '<div class="empty-state">加载消息...</div>';
    modal.classList.remove('hidden');

    if (unsubscribeChatListener) unsubscribeChatListener();

    // 预渲染双方头像 HTML
    const myAvatarHtml = renderUserAvatar(currentUserData, 32, '0');
    const theOtherId = conversationId.replace(currentUser.uid, '').replace(/^_|_$/g, '');
    const theirAvatarHtml = renderUserAvatar({ userId: (isAI || String(theOtherId).startsWith('char_')) ? theOtherId : theOtherId, displayName: otherUserName, avatarUrl: otherUserAvatar, aiAvatar: otherUserAvatar }, 32, '0');

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
                const rawTextData = encodeURIComponent(msg.text || msg.audioText || '');
                const messageDiv = document.createElement('div');
                messageDiv.className = `chat-message ${isMine ? 'sent' : 'received'}`;

                messageDiv.innerHTML = `
                    ${isMine ? myAvatarHtml : theirAvatarHtml}
                    <div class="message-bubble" data-msg-id="${doc.id}" data-raw-text="${rawTextData}" data-is-mine="${isMine}" data-is-last-user="${doc.id === lastUserMsgId}" data-timestamp="${timeMillis}">
                        ${msg.imageUrl ? `<img src="${escapeHtml(msg.imageUrl)}" style="max-width:200px; max-height:200px; border-radius:8px; margin-bottom:${msg.text ? '8px' : '0'}; cursor:pointer; display:block;" onclick="openImageViewer('${escapeHtml(msg.imageUrl)}')">` : ''}
                        ${msg.audioUrl ? `<audio src="${escapeHtml(msg.audioUrl)}" controls style="max-width:100%; height:40px; border-radius:8px; margin-bottom:${msg.audioText ? '6px' : '0'};"></audio>` : ''}
                        ${msg.text && !msg.audioUrl ? escapeHtml(msg.text) : ''}
                        ${msg.audioUrl && msg.audioText ? `<div style="font-size:13px;color:var(--text-primary);padding-top:6px;border-top:1px dashed rgba(128,128,128,0.3);">${escapeHtml(msg.audioText)}</div>` : ''}
                    </div>
                `;
                messagesEl.appendChild(messageDiv);
            });
            messagesEl.scrollTop = messagesEl.scrollHeight;
        });
}

async function sendMessage(conversationId, text, isSilent = false, customSenderId = null, imageUrl = null, audioUrl = null, audioText = null) {
    if (!currentUser || (!text && !imageUrl && !audioUrl)) return;
    const otherUserId = conversationId.replace(currentUser.uid, '').replace(/^_|_$/g, '');
    const senderId = customSenderId || currentUser.uid;
    const isChatWithAI = otherUserId === AI_COMPANION_USER_ID || String(otherUserId).startsWith('char_');

    // 触发纯前端动态记忆提取引擎
    if (isChatWithAI && !isSilent && text && text.trim().length > 5 && senderId === currentUser.uid) { // 修复：仅在和AI私聊时提取记忆，保护真人社交隐私
        if (typeof extractAndSaveMemory === 'function') {
            extractAndSaveMemory(text);
        }
    }

    const message = { senderId: senderId, createdAt: firebase.firestore.FieldValue.serverTimestamp(), isAIDiary: senderId === AI_COMPANION_USER_ID || String(senderId).startsWith('char_') };
    if (text) message.text = text;
    if (imageUrl) message.imageUrl = imageUrl;
    if (audioUrl) {
        message.audioUrl = audioUrl;
        message.audioText = audioText;
    }
    
    const convRef = db.collection('conversations').doc(conversationId);
    await convRef.collection('messages').add(message);
    
    let lastMsgText = text;
    if (!text && imageUrl) lastMsgText = '[图片]';
    else if (text && imageUrl) lastMsgText = '[图片] ' + text;
    else if (audioUrl) lastMsgText = '[语音] ' + (audioText || '');

    await convRef.update({
        lastMessage: { text: lastMsgText, senderId: senderId, timestamp: firebase.firestore.FieldValue.serverTimestamp() },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}