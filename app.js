// --- 核心应用逻辑 (最终完整版) ---

// 全局状态
let db = {
    characters: [],
    groups: [],
    apiSettings: {},
    wallpaper: 'https://i.postimg.cc/W4Z9R9x4/ins-1.jpg',
    myStickers: [],
    homeScreenMode: 'night',
    worldBooks: [],
    fontUrl: '',
    customIcons: {}
};

// 运行时变量
let currentChatId = null;
let currentChatType = null;
let isGenerating = false;
let longPressTimer = null;
let isInMultiSelectMode = false;
let editingMessageId = null;
let currentTransferMessageId = null;
let currentGroupAction = { type: null, recipients: [] };
let currentStickerActionTarget = null;
let selectedMessageIds = new Set();

// 存储实例
let storage;
try {
    storage = new DataStorage();
} catch (e) {
    console.error("数据库启动失败");
}
const STORAGE_KEY = 'app_data';

// --- 初始化与生命周期 ---

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    try {
        await loadData();
        injectDynamicHTML();
        setupEventListeners();
        
        updateClock();
        setInterval(updateClock, 30000);
        
        applyGlobalFont(db.fontUrl);
        setupHomeScreen(); // 这里调用 renderCustomizeForm
        setupChatListScreen();
        applyHomeScreenMode(db.homeScreenMode);
        
        renderChatList();
        
        // 初始化成功，显示主屏幕
        switchScreen('home-screen');
        console.log("初始化完成");
        
    } catch (e) {
        console.error("初始化崩溃:", e);
        alert("初始化出错: " + e.message);
    }
}

async function loadData() {
    if (!storage) return;
    const data = await storage.getData(STORAGE_KEY);
    if (data) {
        db = { ...db, ...data };
    }
    // 数据补全
    if (!db.apiSettings) db.apiSettings = {};
    if (!db.characters) db.characters = [];
    if (!db.groups) db.groups = [];
    if (!db.customIcons) db.customIcons = {};
    if (!db.myStickers) db.myStickers = [];
    
    db.characters.forEach(c => {
        if (!c.history) c.history = [];
        if (c.isPinned === undefined) c.isPinned = false;
    });
}

async function saveData() {
    if (storage) await storage.saveData(STORAGE_KEY, db);
}

// --- 界面管理 ---

function switchScreen(targetId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(targetId)?.classList.add('active');
    document.querySelectorAll('.modal-overlay, .action-sheet-overlay, .settings-sidebar').forEach(el => {
        el.classList.remove('visible', 'open');
    });
}

function injectDynamicHTML() {
    const apiHTML = `<header class="app-header"><button class="back-btn" data-target="home-screen">‹</button><div class="title-container"><h1 class="title">API 设置</h1></div><div class="placeholder"></div></header><main class="content"><form id="api-form"><div class="form-group"><label>服务商</label><select id="api-provider" name="provider"><option value="newapi">自定义 (OpenAI格式)</option><option value="deepseek">DeepSeek</option><option value="claude">Claude</option><option value="gemini">Gemini</option></select></div><div class="form-group"><label>API 地址</label><input type="url" id="api-url" name="url" placeholder="https://..." required></div><div class="form-group"><label>密钥 (Key)</label><input type="password" id="api-key" name="key" required></div><button type="button" class="btn btn-secondary" id="fetch-models-btn"><span class="btn-text">拉取模型列表</span><div class="spinner"></div></button><div class="form-group"><label>模型</label><select id="api-model" name="model" required><option value="">请先拉取...</option></select></div><button type="submit" class="btn btn-primary">保存设置</button></form></main>`;
    const wallpaperHTML = `<header class="app-header"><button class="back-btn" data-target="home-screen">‹</button><div class="title-container"><h1 class="title">壁纸</h1></div><div class="placeholder"></div></header><main class="content"><div class="wallpaper-preview" id="wallpaper-preview" style="border:3px dashed #ccc;height:300px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;background-size:cover;background-position:center;">当前预览</div><input type="file" id="wallpaper-upload" accept="image/*" style="display: none;"><label for="wallpaper-upload" class="btn btn-primary">更换壁纸</label></main>`;
    const customizeHTML = `<header class="app-header"><button class="back-btn" data-target="home-screen">‹</button><div class="title-container"><h1 class="title">自定义图标</h1></div><div class="placeholder"></div></header><main class="content"><form id="customize-form"></form></main>`;
    const tutorialHTML = `<header class="app-header"><button class="back-btn" data-target="home-screen">‹</button><div class="title-container"><h1 class="title">使用说明</h1></div><div class="placeholder"></div></header><main class="content" id="tutorial-content-area"></main>`;
    const fontHTML = `<header class="app-header"><button class="back-btn" data-target="home-screen">‹</button><div class="title-container"><h1 class="title">字体</h1></div><div class="placeholder"></div></header><main class="content"><form id="font-settings-form"><div class="form-group"><label>字体链接 (WOFF2/TTF)</label><input type="url" id="font-url" placeholder="https://..." required></div><button type="submit" class="btn btn-primary">应用</button><button type="button" class="btn btn-neutral" id="restore-default-font-btn" style="margin-top:15px;">恢复默认</button></form></main>`;

    const setHTML = (id, html) => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = html;
    };

    setHTML('api-settings-screen', apiHTML);
    setHTML('wallpaper-screen', wallpaperHTML);
    setHTML('customize-screen', customizeHTML);
    setHTML('tutorial-screen', tutorialHTML);
    setHTML('font-settings-screen', fontHTML);
}

function setupEventListeners() {
    document.body.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu')) removeContextMenu();
        const backBtn = e.target.closest('.back-btn');
        if (backBtn) {
            e.preventDefault();
            switchScreen(backBtn.dataset.target);
        }
        const overlay = e.target.closest('.modal-overlay.visible, .action-sheet-overlay.visible');
        if (overlay && e.target === overlay) {
            overlay.classList.remove('visible');
        }
    });

    document.body.addEventListener('click', e => {
        const navLink = e.target.closest('.app-icon[data-target]');
        if (navLink) {
            e.preventDefault();
            switchScreen(navLink.dataset.target);
        }
    });

    setupApiLogic();
    setupWallpaperLogic();
    setupChatLogic();
    setupStickerLogic();
    setupToolLogic();
    setupGroupLogic();
    setupTutorialLogic();
    setupFontLogic();
}

// --- 主屏幕 ---
function setupHomeScreen() {
    const getIcon = (id) => db.customIcons[id] || (DEFAULT_ICONS[id] ? DEFAULT_ICONS[id].url : '');
    const homeHTML = `
        <div class="time-widget"><div class="time" id="time-display">00:00</div><div class="date" id="date-display">...</div></div>
        <div class="app-grid">
            <a href="#" class="app-icon" data-target="chat-list-screen"><img src="${getIcon('chat-list-screen')}" class="icon-img"><span class="app-name">${DEFAULT_ICONS['chat-list-screen'].name}</span></a>
            <a href="#" class="app-icon" data-target="api-settings-screen"><img src="${getIcon('api-settings-screen')}" class="icon-img"><span class="app-name">${DEFAULT_ICONS['api-settings-screen'].name}</span></a>
            <a href="#" class="app-icon" data-target="world-book-screen"><img src="${getIcon('world-book-screen')}" class="icon-img"><span class="app-name">${DEFAULT_ICONS['world-book-screen'].name}</span></a>
            <a href="#" class="app-icon" data-target="wallpaper-screen"><img src="${getIcon('wallpaper-screen')}" class="icon-img"><span class="app-name">${DEFAULT_ICONS['wallpaper-screen'].name}</span></a>
            <a href="#" class="app-icon" data-target="customize-screen"><img src="${getIcon('customize-screen')}" class="icon-img"><span class="app-name">${DEFAULT_ICONS['customize-screen'].name}</span></a>
            <a href="#" class="app-icon" data-target="tutorial-screen"><img src="${getIcon('tutorial-screen')}" class="icon-img"><span class="app-name">${DEFAULT_ICONS['tutorial-screen'].name}</span></a>
        </div>
        <div class="dock">
            <a href="#" class="app-icon" id="day-mode-btn"><img src="${getIcon('day-mode-btn')}" class="icon-img"></a>
            <a href="#" class="app-icon" id="night-mode-btn"><img src="${getIcon('night-mode-btn')}" class="icon-img"></a>
            <a href="#" class="app-icon" data-target="font-settings-screen"><img src="${getIcon('font-settings-screen')}" class="icon-img"></a>
        </div>
    `;
    const homeEl = document.getElementById('home-screen');
    if(homeEl) homeEl.innerHTML = homeHTML;
    
    document.getElementById('day-mode-btn').onclick = () => applyHomeScreenMode('day');
    document.getElementById('night-mode-btn').onclick = () => applyHomeScreenMode('night');
    
    // 关键调用：这里会渲染自定义图标表单
    renderCustomizeForm();
    applyWallpaper(db.wallpaper);
}

function updateClock() {
    const now = new Date();
    const t = document.getElementById('time-display');
    const d = document.getElementById('date-display');
    if (t) t.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (d) d.textContent = `${now.getFullYear()}年${pad(now.getMonth()+1)}月${pad(now.getDate())}日`;
}

function applyHomeScreenMode(mode) {
    const screen = document.getElementById('home-screen');
    mode === 'day' ? screen.classList.add('day-mode') : screen.classList.remove('day-mode');
    db.homeScreenMode = mode;
    saveData();
}

function applyWallpaper(url) {
    if(url) {
        document.getElementById('home-screen').style.backgroundImage = `url(${url})`;
        const preview = document.getElementById('wallpaper-preview');
        if(preview) {
            preview.style.backgroundImage = `url(${url})`;
            preview.textContent = '';
        }
    }
}

function applyGlobalFont(url) {
    if(!url) return;
    let style = document.getElementById('global-font-style');
    if(!style) {
        style = document.createElement('style');
        style.id = 'global-font-style';
        document.head.appendChild(style);
    }
    style.innerHTML = `@font-face { font-family: 'CustomFont'; src: url('${url}'); } :root { --font-family: 'CustomFont', sans-serif; }`;
}

// --- 缺失函数补全：自定义图标表单渲染 ---
function renderCustomizeForm() {
    const form = document.getElementById('customize-form');
    if(!form) return;
    form.innerHTML = '';
    // DEFAULT_ICONS 来自 config.js
    Object.entries(DEFAULT_ICONS).forEach(([key, val]) => {
        const current = db.customIcons[key] || val.url;
        const div = document.createElement('div');
        div.className = 'icon-custom-item';
        // 注意：这里 onclick 使用了 window.xxx，因为是 innerHTML 注入的
        div.innerHTML = `
            <img src="${current}" class="icon-preview">
            <div style="flex:1">
                <div>${val.name || '图标'}</div>
                <input type="url" value="${db.customIcons[key]||''}" placeholder="输入图片URL" onchange="window.updateCustomIcon('${key}', this.value)">
            </div>
            <button type="button" onclick="window.resetCustomIcon('${key}')" class="reset-icon-btn">重置</button>
        `;
        form.appendChild(div);
    });
}

// 暴露给 HTML 调用的全局函数
window.updateCustomIcon = async (key, url) => {
    if(url) db.customIcons[key] = url;
    await saveData();
    setupHomeScreen(); // 刷新主屏
};

window.resetCustomIcon = async (key) => {
    delete db.customIcons[key];
    await saveData();
    setupHomeScreen(); // 刷新主屏
};

// --- 聊天列表 ---
function setupChatListScreen() {
    const container = document.getElementById('chat-list-container');
    document.getElementById('add-chat-btn').onclick = () => {
        document.getElementById('add-char-form').reset();
        document.getElementById('add-char-modal').classList.add('visible');
    };
    document.getElementById('add-char-form').onsubmit = async (e) => {
        e.preventDefault();
        const newChar = {
            id: `char_${Date.now()}`,
            realName: document.getElementById('char-real-name').value,
            remarkName: document.getElementById('char-remark-name').value,
            myName: document.getElementById('my-name-for-char').value,
            avatar: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg',
            myAvatar: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg',
            history: [],
            isPinned: false,
            theme: 'white_pink',
            maxMemory: 20
        };
        db.characters.push(newChar);
        await saveData();
        renderChatList();
        document.getElementById('add-char-modal').classList.remove('visible');
    };
    container.addEventListener('click', (e) => {
        const item = e.target.closest('.chat-item');
        if (item) openChatRoom(item.dataset.id, item.dataset.type);
    });
    container.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const item = e.target.closest('.chat-item');
        if (item) showChatContextMenu(item.dataset.id, item.dataset.type, e.clientX, e.clientY);
    });
}

function renderChatList() {
    const list = document.getElementById('chat-list-container');
    if(!list) return;
    list.innerHTML = '';
    const allChats = [
        ...db.characters.map(c => ({...c, type: 'private'})), 
        ...db.groups.map(g => ({...g, type: 'group'}))
    ];
    document.getElementById('no-chats-placeholder').style.display = allChats.length === 0 ? 'block' : 'none';
    
    allChats.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const timeA = a.history.length ? a.history[a.history.length-1].timestamp : 0;
        const timeB = b.history.length ? b.history[b.history.length-1].timestamp : 0;
        return timeB - timeA;
    });

    allChats.forEach(chat => {
        const name = chat.type === 'private' ? chat.remarkName : chat.name;
        let lastMsg = '暂无消息';
        if (chat.history.length > 0) {
            const msg = chat.history[chat.history.length-1];
            lastMsg = msg.content.replace(/\[.*?\]/g, '[消息]').substring(0, 20);
            if(msg.content.includes('表情包')) lastMsg = '[表情包]';
            if(msg.content.includes('语音')) lastMsg = '[语音]';
            if(msg.content.includes('图片')) lastMsg = '[图片]';
            if(msg.content.includes('转账')) lastMsg = '[转账]';
        }
        const li = document.createElement('li');
        li.className = `list-item chat-item ${chat.isPinned ? 'pinned' : ''}`;
        li.dataset.id = chat.id;
        li.dataset.type = chat.type;
        li.innerHTML = `
            <img src="${chat.avatar}" class="chat-avatar ${chat.type === 'group' ? 'group-avatar' : ''}">
            <div class="item-details">
                <div class="item-details-row"><div class="item-name">${name}</div></div>
                <div class="item-preview-wrapper"><div class="item-preview">${lastMsg}</div>${chat.isPinned ? '<span class="pin-badge">置顶</span>' : ''}</div>
            </div>
        `;
        list.appendChild(li);
    });
}

function showChatContextMenu(id, type, x, y) {
    const chat = type === 'private' ? db.characters.find(c=>c.id===id) : db.groups.find(g=>g.id===id);
    if (!chat) return;
    createContextMenu([
        {
            label: chat.isPinned ? '取消置顶' : '置顶聊天',
            action: async () => {
                chat.isPinned = !chat.isPinned;
                await saveData();
                renderChatList();
            }
        },
        {
            label: '删除聊天',
            danger: true,
            action: async () => {
                if(confirm('确定要删除吗？不可恢复。')) {
                    if(type === 'private') db.characters = db.characters.filter(c=>c.id!==id);
                    else db.groups = db.groups.filter(g=>g.id!==id);
                    await saveData();
                    renderChatList();
                }
            }
        }
    ], x, y);
}

// --- 聊天室 ---
function setupChatLogic() {
    document.getElementById('send-message-btn').onclick = sendMessage;
    document.getElementById('get-reply-btn').onclick = getAiReply;
    document.getElementById('chat-settings-btn').onclick = () => {
        const sidebar = currentChatType === 'group' ? 'group-settings-sidebar' : 'chat-settings-sidebar';
        loadSettingsToSidebar(currentChatType);
        document.getElementById(sidebar).classList.add('open');
    };
    document.querySelectorAll('#clear-chat-history-btn, #clear-group-chat-history-btn').forEach(btn => {
        btn.onclick = async () => {
            if(confirm('确定清空记录？')) {
                const chat = getChatById(currentChatId, currentChatType);
                chat.history = [];
                await saveData();
                renderMessages();
                showToast('已清空');
            }
        }
    });
    // 关键修正：确保函数存在后再绑定
    const settingsForm = document.getElementById('chat-settings-form');
    if(settingsForm) {
        settingsForm.addEventListener('change', savePrivateSettings);
    }
    
    document.getElementById('message-area').addEventListener('click', (e) => {
        const voiceBubble = e.target.closest('.voice-bubble');
        if(voiceBubble) {
            const transcript = voiceBubble.closest('.message-wrapper').querySelector('.voice-transcript');
            if(transcript) transcript.classList.toggle('active');
        }
        const transferCard = e.target.closest('.transfer-card.received-transfer');
        if(transferCard && currentChatType === 'private') {
            const wrapper = transferCard.closest('.message-wrapper');
            const msg = getChatById(currentChatId, 'private').history.find(m => m.id === wrapper.dataset.id);
            if(msg && msg.transferStatus === 'pending') {
                currentTransferMessageId = msg.id;
                document.getElementById('receive-transfer-actionsheet').classList.add('visible');
            }
        }
    });
}

function getChatById(id, type) {
    return type === 'private' ? db.characters.find(c=>c.id===id) : db.groups.find(g=>g.id===id);
}

function openChatRoom(id, type) {
    currentChatId = id;
    currentChatType = type;
    const chat = getChatById(id, type);
    if(!chat) return;

    document.getElementById('chat-room-title').textContent = type === 'private' ? chat.remarkName : chat.name;
    document.getElementById('chat-room-subtitle').style.display = type === 'private' ? 'flex' : 'none';
    document.getElementById('chat-room-screen').style.backgroundImage = chat.chatBg ? `url(${chat.chatBg})` : '';
    
    renderMessages();
    switchScreen('chat-room-screen');
}

function renderMessages() {
    const chat = getChatById(currentChatId, currentChatType);
    const area = document.getElementById('message-area');
    area.innerHTML = '';
    
    chat.history.forEach(msg => {
        const el = createMessageElement(msg, chat);
        if(el) area.appendChild(el);
    });
    area.scrollTop = area.scrollHeight;
}

function createMessageElement(msg, chat) {
    const isSent = msg.role === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isSent ? 'sent' : 'received'}`;
    wrapper.dataset.id = msg.id;

    if(msg.role === 'system' || msg.content.includes('[system')) {
        wrapper.innerHTML = `<div class="system-notification-bubble">${msg.content.replace(/\[system:|\]/g, '')}</div>`;
        wrapper.className = 'message-wrapper system-notification';
        return wrapper;
    }

    let bubbleContent = '';
    let bubbleClass = `message-bubble ${isSent ? 'sent' : 'received'}`;
    
    if(msg.stickerData) {
        bubbleContent = `<div class="image-bubble"><img src="${msg.stickerData}"></div>`;
        bubbleClass = '';
    } else if(msg.content.includes('表情包：')) {
        const urlMatch = msg.content.match(/表情包：(.*?)(]|\[)/);
        const url = urlMatch ? (urlMatch[1].startsWith('http') ? urlMatch[1] : 'https://i.postimg.cc/' + urlMatch[1]) : '';
        bubbleContent = `<div class="image-bubble"><img src="${url}"></div>`;
        bubbleClass = '';
    } else if(msg.content.includes('转账：')) {
        const amount = msg.content.match(/转账：(.*?)元/)?.[1] || '0';
        const status = msg.transferStatus === 'received' ? '已收款' : (msg.transferStatus === 'returned' ? '已退回' : (isSent ? '待收款' : '转账给你'));
        const cardClass = `transfer-card ${isSent ? 'sent-transfer' : 'received-transfer'} ${msg.transferStatus || ''}`;
        bubbleContent = `
            <div class="${cardClass}">
                <div class="overlay"></div>
                <div class="transfer-content">
                    <p class="transfer-title">${isSent ? '转账' : '给你转账'}</p>
                    <p class="transfer-amount">¥${amount}</p>
                    <p class="transfer-status">${status}</p>
                </div>
            </div>`;
        bubbleClass = '';
    } else if(msg.content.includes('语音：')) {
        const text = msg.content.match(/语音：(.*?)\]/)?.[1] || '语音消息';
        bubbleContent = `
            <div class="voice-bubble">
                <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
                <span class="duration">${Math.min(60, Math.ceil(text.length/3))}"</span>
            </div>
            <div class="voice-transcript">${text}</div>
        `;
        bubbleClass = '';
    } else {
        bubbleContent = msg.content.replace(/\[.*?\]/g, '').trim() || msg.content;
    }

    const theme = COLOR_THEMES[chat.theme || 'white_pink'];
    const style = isSent ? theme.sent : theme.received;
    
    let bubbleHtml = bubbleClass ? `<div class="${bubbleClass}" style="background-color:${style.bg};color:${style.text}">${bubbleContent}</div>` : bubbleContent;
    const avatarUrl = isSent ? (chat.type==='private'?chat.myAvatar:chat.me.avatar) : (chat.type==='private'?chat.avatar:'https://i.postimg.cc/Y96LPskq/o-o-2.jpg');
    
    wrapper.innerHTML = `
        <div class="message-bubble-row">
            <div class="message-info"><img src="${avatarUrl}" class="message-avatar"></div>
            ${bubbleHtml}
        </div>
    `;
    return wrapper;
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if(!text) return;
    
    const chat = getChatById(currentChatId, currentChatType);
    const myName = currentChatType === 'private' ? chat.myName : chat.me.nickname;
    const content = `[${myName}的消息：${text}]`;
    
    const msg = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: content,
        timestamp: Date.now()
    };
    
    chat.history.push(msg);
    await saveData();
    renderMessages();
    input.value = '';
}

async function getAiReply() {
    if(isGenerating) return;
    const { url, key, model, provider } = db.apiSettings;
    if(!url || !key) return showToast('请先配置 API');
    
    isGenerating = true;
    document.getElementById('typing-indicator').style.display = 'block';
    
    try {
        const chat = getChatById(currentChatId, currentChatType);
        const prompt = generateSystemPrompt(chat);
        
        const messages = [{ role: 'system', content: prompt }];
        chat.history.slice(-20).forEach(m => {
            messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content });
        });

        const response = await fetch(provider === 'gemini' ? `${url}/v1beta/models/${model}:generateContent?key=${key}` : `${url}/v1/chat/completions`, {
            method: 'POST',
            headers: provider === 'gemini' ? {'Content-Type': 'application/json'} : {'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`},
            body: JSON.stringify(provider === 'gemini' ? {
                contents: [{ role: 'user', parts: [{ text: prompt + "\n\n" + messages.map(m=>m.content).join('\n') }] }] 
            } : { model: model, messages: messages })
        });
        
        const data = await response.json();
        let replyText = '';
        if(provider === 'gemini') replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        else replyText = data.choices?.[0]?.message?.content || '';

        if(replyText) {
            const replyMsg = {
                id: `ai_${Date.now()}`,
                role: 'assistant',
                content: replyText,
                timestamp: Date.now()
            };
            chat.history.push(replyMsg);
            await saveData();
            renderMessages();
        }
    } catch (e) {
        showToast('API错误: ' + e.message);
    } finally {
        isGenerating = false;
        document.getElementById('typing-indicator').style.display = 'none';
    }
}

function generateSystemPrompt(chat) {
    if(chat.type === 'private') {
        return `你正在扮演 ${chat.realName}。我的名字是 ${chat.myName}。你的设定是：${chat.persona || '无'}。请完全沉浸，格式要求：普通消息用 [${chat.realName}的消息：内容]；发表情包用 [${chat.realName}发送的表情包：图片URL]。`;
    } else {
        const members = chat.members.map(m => `${m.realName}(${m.groupNickname})`).join(', ');
        return `你正在扮演群聊中的所有成员：${members}。当前群名：${chat.name}。请随机选择成员发言，格式：[成员真名的消息：内容]。`;
    }
}

function setupToolLogic() {
    document.getElementById('voice-message-btn').onclick = () => document.getElementById('send-voice-modal').classList.add('visible');
    document.getElementById('send-voice-form').onsubmit = async (e) => {
        e.preventDefault();
        const text = document.getElementById('voice-text-input').value;
        const chat = getChatById(currentChatId, currentChatType);
        const name = currentChatType === 'private' ? chat.myName : chat.me.nickname;
        chat.history.push({
            id: `msg_${Date.now()}`, role: 'user', content: `[${name}的语音：${text}]`, timestamp: Date.now()
        });
        await saveData(); renderMessages();
        document.getElementById('send-voice-modal').classList.remove('visible');
    };

    document.getElementById('wallet-btn').onclick = () => document.getElementById('send-transfer-modal').classList.add('visible');
    document.getElementById('send-transfer-form').onsubmit = async (e) => {
        e.preventDefault();
        const amount = document.getElementById('transfer-amount-input').value;
        const chat = getChatById(currentChatId, currentChatType);
        const name = currentChatType === 'private' ? chat.myName : chat.me.nickname;
        chat.history.push({
            id: `msg_${Date.now()}`, role: 'user', content: `[${name}给你转账：${amount}元]`, transferStatus: 'pending', timestamp: Date.now()
        });
        await saveData(); renderMessages();
        document.getElementById('send-transfer-modal').classList.remove('visible');
    };
    
    document.getElementById('accept-transfer-btn').onclick = async () => handleTransfer('received');
    document.getElementById('return-transfer-btn').onclick = async () => handleTransfer('returned');
}

async function handleTransfer(status) {
    const chat = getChatById(currentChatId, 'private');
    const msg = chat.history.find(m => m.id === currentTransferMessageId);
    if(msg) msg.transferStatus = status;
    await saveData(); renderMessages();
    document.getElementById('receive-transfer-actionsheet').classList.remove('visible');
}

function setupStickerLogic() {
    document.getElementById('sticker-toggle-btn').onclick = () => {
        const modal = document.getElementById('sticker-modal');
        modal.classList.toggle('visible');
        if(modal.classList.contains('visible')) renderStickerGrid();
    };
    document.getElementById('add-new-sticker-btn').onclick = () => document.getElementById('add-sticker-modal').classList.add('visible');
    document.getElementById('add-sticker-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('sticker-name').value;
        const urlInput = document.getElementById('sticker-url-input').value;
        db.myStickers.push({ id: `s_${Date.now()}`, name, data: urlInput || 'https://i.postimg.cc/VvQB8dQT/chan-143.png' });
        await saveData();
        renderStickerGrid();
        document.getElementById('add-sticker-modal').classList.remove('visible');
    };
}

function renderStickerGrid() {
    const grid = document.getElementById('sticker-grid-container');
    grid.innerHTML = '';
    db.myStickers.forEach(s => {
        const div = document.createElement('div');
        div.className = 'sticker-item';
        div.innerHTML = `<img src="${s.data}"><span>${s.name}</span>`;
        div.onclick = async () => {
            const chat = getChatById(currentChatId, currentChatType);
            const name = currentChatType === 'private' ? chat.myName : chat.me.nickname;
            chat.history.push({
                id: `msg_${Date.now()}`, role: 'user', content: `[${name}的表情包：${s.name}]`, stickerData: s.data, timestamp: Date.now()
            });
            await saveData(); renderMessages();
            document.getElementById('sticker-modal').classList.remove('visible');
        };
        grid.appendChild(div);
    });
}

function setupGroupLogic() {
    document.getElementById('create-group-btn').onclick = () => {
        const list = document.getElementById('member-selection-list');
        list.innerHTML = '';
        db.characters.forEach(c => {
            list.innerHTML += `<li class="member-selection-item"><input type="checkbox" value="${c.id}"><img src="${c.avatar}">${c.remarkName}</li>`;
        });
        document.getElementById('create-group-modal').classList.add('visible');
    };
    
    document.getElementById('create-group-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('group-name-input').value;
        const ids = Array.from(document.querySelectorAll('#member-selection-list input:checked')).map(i=>i.value);
        if(!ids.length) return showToast('至少选一人');
        
        const members = ids.map(id => {
            const c = db.characters.find(char => char.id === id);
            return { id: `m_${id}`, originalCharId: id, realName: c.realName, groupNickname: c.remarkName, avatar: c.avatar };
        });
        
        const newGroup = {
            id: `group_${Date.now()}`, name, members,
            me: { nickname: '我', avatar: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg' },
            history: [], theme: 'white_pink'
        };
        db.groups.push(newGroup);
        await saveData();
        renderChatList();
        document.getElementById('create-group-modal').classList.remove('visible');
    };
    
    const groupForm = document.getElementById('group-settings-form');
    if (groupForm) {
        groupForm.onsubmit = async (e) => {
            e.preventDefault();
            const group = getChatById(currentChatId, 'group');
            if(!group) return;
            group.name = document.getElementById('setting-group-name').value;
            group.theme = document.getElementById('setting-group-theme-color').value;
            group.maxMemory = parseInt(document.getElementById('setting-group-max-memory').value) || 20;
            await saveData();
            document.getElementById('chat-room-title').textContent = group.name;
            renderChatList();
            renderMessages();
            showToast('群设置已保存');
            document.getElementById('group-settings-sidebar').classList.remove('open');
        };
    }
}

function setupApiLogic() {
    document.getElementById('api-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        db.apiSettings = Object.fromEntries(fd.entries());
        await saveData();
        showToast('已保存');
    }
}

function setupWallpaperLogic() {
    document.getElementById('wallpaper-upload').onchange = async (e) => {
        const file = e.target.files[0];
        if(file) {
            db.wallpaper = await compressImage(file, {maxWidth:1080});
            await saveData();
            applyWallpaper(db.wallpaper);
        }
    }
}

function setupFontLogic() {
    document.getElementById('font-settings-form').onsubmit = async (e) => {
        e.preventDefault();
        db.fontUrl = document.getElementById('font-url').value;
        await saveData();
        applyGlobalFont(db.fontUrl);
    }
}

function setupTutorialLogic() { /* 保持原样 */ }

// --- 被遗漏的函数补全 (关键！) ---

function loadSettingsToSidebar(type) {
    if (type === 'group') {
        const group = getChatById(currentChatId, 'group');
        if (!group) return;
        
        const form = document.getElementById('group-settings-form');
        form.innerHTML = `
            <div class="form-group"><label>群名称</label><input id="setting-group-name" value="${group.name}"></div>
            <div class="form-group"><label>最大记忆轮数</label><input type="number" id="setting-group-max-memory" value="${group.maxMemory || 20}"></div>
            <div class="form-group"><label>主题颜色</label>
                <select id="setting-group-theme-color">
                    ${Object.entries(COLOR_THEMES).map(([k,v]) => `<option value="${k}" ${group.theme===k?'selected':''}>${v.name}</option>`).join('')}
                </select>
            </div>
            <div class="avatar-setting" style="justify-content:center;margin-top:15px;">
                <img src="${group.avatar}" id="setting-group-avatar-preview" class="group-avatar-preview">
                <p style="font-size:12px;color:#888;">(暂不支持修改头像)</p>
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:20px;">保存群设置</button>
        `;
    } else {
        const chat = getChatById(currentChatId, 'private');
        if (!chat) return;
        
        const form = document.getElementById('chat-settings-form');
        form.innerHTML = `
            <div class="form-group"><label>备注名</label><input name="remarkName" value="${chat.remarkName}"></div>
            <div class="form-group"><label>我的称呼</label><input name="myName" value="${chat.myName}"></div>
            <div class="form-group"><label>主题颜色</label>
                <select name="theme">
                    ${Object.entries(COLOR_THEMES).map(([k,v]) => `<option value="${k}" ${chat.theme===k?'selected':''}>${v.name}</option>`).join('')}
                </select>
            </div>
        `;
    }
}

async function savePrivateSettings() {
    const form = document.getElementById('chat-settings-form');
    if (!form || currentChatType !== 'private') return;

    const formData = new FormData(form);
    const chat = getChatById(currentChatId, 'private');
    if (!chat) return;
    
    chat.remarkName = formData.get('remarkName');
    chat.myName = formData.get('myName');
    chat.theme = formData.get('theme');
    
    await saveData();
    document.getElementById('chat-room-title').textContent = chat.remarkName;
    renderChatList();
    renderMessages();
}