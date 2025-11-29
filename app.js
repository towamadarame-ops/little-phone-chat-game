// --- 核心应用逻辑 (API与世界书修复版) ---

// 全局状态
let db = {
    characters: [],
    groups: [],
    apiSettings: {},
    // 修改这里的默认链接
    wallpaper: 'https://i.postimg.cc/P5cNsDPz/bd7c5e3d695da973c90768cf08511298.jpg',
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
let currentEditingWorldBookId = null; // 新增：当前编辑的世界书ID
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
        setupEventListeners(); // 这里会绑定 API 按钮和世界书逻辑
        
        updateClock();
        setInterval(updateClock, 30000);
        
        applyGlobalFont(db.fontUrl);
        setupHomeScreen();
        setupChatListScreen();
        applyHomeScreenMode(db.homeScreenMode);
        
        renderChatList();
        
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
    if (!db.worldBooks) db.worldBooks = [];
    
    db.characters.forEach(c => {
        if (!c.history) c.history = [];
        if (c.isPinned === undefined) c.isPinned = false;
        if (!c.worldBookIds) c.worldBookIds = [];
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

// 🟢 修复点1：补全世界书和其他页面的 HTML 注入
function injectDynamicHTML() {
    const apiHTML = `<header class="app-header"><button class="back-btn" data-target="home-screen">‹</button><div class="title-container"><h1 class="title">API 设置</h1></div><div class="placeholder"></div></header><main class="content"><form id="api-form"><div class="form-group"><label>服务商</label><select id="api-provider" name="provider"><option value="newapi">自定义 (OpenAI格式)</option><option value="deepseek">DeepSeek</option><option value="claude">Claude</option><option value="gemini">Gemini</option></select></div><div class="form-group"><label>API 地址</label><input type="url" id="api-url" name="url" placeholder="https://..." required></div><div class="form-group"><label>密钥 (Key)</label><input type="password" id="api-key" name="key" required></div><button type="button" class="btn btn-secondary" id="fetch-models-btn"><span class="btn-text">点击拉取模型列表</span><div class="spinner"></div></button><div class="form-group"><label>模型</label><select id="api-model" name="model" required><option value="">请先拉取...</option></select></div><button type="submit" class="btn btn-primary">保存设置</button></form></main>`;
    
    const wallpaperHTML = `<header class="app-header"><button class="back-btn" data-target="home-screen">‹</button><div class="title-container"><h1 class="title">壁纸</h1></div><div class="placeholder"></div></header><main class="content"><div class="wallpaper-preview" id="wallpaper-preview" style="border:3px dashed #ccc;height:300px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;background-size:cover;background-position:center;">当前预览</div><input type="file" id="wallpaper-upload" accept="image/*" style="display: none;"><label for="wallpaper-upload" class="btn btn-primary">更换壁纸</label></main>`;
    
    // 世界书列表页
    const worldBookHTML = `<header class="app-header"><button class="back-btn" data-target="home-screen">‹</button><div class="title-container"><h1 class="title">世界书</h1></div><button class="action-btn" id="add-world-book-btn">+</button></header><main class="content"><ul class="list-container" id="world-book-list-container"></ul><div class="placeholder-text" id="no-world-books-placeholder" style="display:none;">暂无设定<br>点击右上角添加</div></main>`;
    
    // 世界书编辑页
    const editWorldBookHTML = `<header class="app-header"><button class="back-btn" data-target="world-book-screen">‹</button><div class="title-container"><h1 class="title">编辑词条</h1></div><div class="placeholder"></div></header><main class="content"><form id="edit-world-book-form"><div class="form-group"><label>名称</label><input type="text" id="world-book-name" required></div><div class="form-group"><label>内容</label><textarea id="world-book-content" rows="8" required placeholder="输入设定内容..."></textarea></div><div class="form-group"><label>位置</label><select id="world-book-position"><option value="before">前置 (Before)</option><option value="after">后置 (After)</option></select></div><button type="submit" class="btn btn-primary">保存条目</button></form></main>`;

    const customizeHTML = `<header class="app-header"><button class="back-btn" data-target="home-screen">‹</button><div class="title-container"><h1 class="title">自定义图标</h1></div><div class="placeholder"></div></header><main class="content"><form id="customize-form"></form></main>`;
    
    const tutorialHTML = `<header class="app-header"><button class="back-btn" data-target="home-screen">‹</button><div class="title-container"><h1 class="title">使用说明</h1></div><div class="placeholder"></div></header><main class="content" id="tutorial-content-area"></main>`;
    
    const fontHTML = `<header class="app-header"><button class="back-btn" data-target="home-screen">‹</button><div class="title-container"><h1 class="title">字体</h1></div><div class="placeholder"></div></header><main class="content"><form id="font-settings-form"><div class="form-group"><label>字体链接 (WOFF2/TTF)</label><input type="url" id="font-url" placeholder="https://..." required></div><button type="submit" class="btn btn-primary">应用</button><button type="button" class="btn btn-neutral" id="restore-default-font-btn" style="margin-top:15px;">恢复默认</button></form></main>`;

    const setHTML = (id, html) => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = html;
    };

    setHTML('api-settings-screen', apiHTML);
    setHTML('wallpaper-screen', wallpaperHTML);
    setHTML('world-book-screen', worldBookHTML);
    setHTML('edit-world-book-screen', editWorldBookHTML);
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
    setupWorldBookLogic(); // 绑定世界书逻辑
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
    // 定义新的默认壁纸
    const defaultWallpaper = 'https://i.postimg.cc/P5cNsDPz/bd7c5e3d695da973c90768cf08511298.jpg';
    
    // 旧的壁纸链接列表（如果检测到用户当前是这些旧图，就自动替换成新的）
    const oldWallpapers = [
        'https://i.postimg.cc/W4Z9R9x4/ins-1.jpg',
        'https://i.pinimg.com/736x/bd/7c/5e/bd7c5e3d695da973c90768cf08511298.jpg'
    ];

    // 逻辑：如果 url 为空，或者 url 是旧的默认图，则强制更新为新的默认图
    // 这样不会影响用户自己上传的自定义图片
    if (!url || oldWallpapers.includes(url)) {
        url = defaultWallpaper;
        // 同步更新数据库
        if (typeof db !== 'undefined') {
            db.wallpaper = defaultWallpaper;
            saveData(); 
        }
    }

    // 应用壁纸
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

// --- 自定义图标 ---
function renderCustomizeForm() {
    const form = document.getElementById('customize-form');
    if(!form) return;
    form.innerHTML = '';
    Object.entries(DEFAULT_ICONS).forEach(([key, val]) => {
        const current = db.customIcons[key] || val.url;
        const div = document.createElement('div');
        div.className = 'icon-custom-item';
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

window.updateCustomIcon = async (key, url) => {
    if(url) db.customIcons[key] = url;
    await saveData();
    setupHomeScreen();
};

window.resetCustomIcon = async (key) => {
    delete db.customIcons[key];
    await saveData();
    setupHomeScreen();
};

// --- 世界书逻辑 (完全修复) ---
function setupWorldBookLogic() {
    // 渲染列表
    document.querySelector('[data-target="world-book-screen"]').addEventListener('click', renderWorldBookList);
    
    // 添加按钮
    document.getElementById('add-world-book-btn').onclick = () => {
        currentEditingWorldBookId = null;
        document.getElementById('edit-world-book-form').reset();
        switchScreen('edit-world-book-screen');
    };
    
    // 保存表单
    document.getElementById('edit-world-book-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('world-book-name').value.trim();
        const content = document.getElementById('world-book-content').value.trim();
        const position = document.getElementById('world-book-position').value;
        
        if (!name || !content) return showToast('内容不能为空');
        
        if (currentEditingWorldBookId) {
            const book = db.worldBooks.find(b => b.id === currentEditingWorldBookId);
            if (book) Object.assign(book, { name, content, position });
        } else {
            db.worldBooks.push({ id: `wb_${Date.now()}`, name, content, position });
        }
        
        await saveData();
        renderWorldBookList();
        switchScreen('world-book-screen');
    };
    
    // 点击编辑
    document.getElementById('world-book-list-container').addEventListener('click', (e) => {
        const item = e.target.closest('.list-item');
        if (item) {
            const book = db.worldBooks.find(b => b.id === item.dataset.id);
            if (book) {
                currentEditingWorldBookId = book.id;
                document.getElementById('world-book-name').value = book.name;
                document.getElementById('world-book-content').value = book.content;
                document.getElementById('world-book-position').value = book.position;
                switchScreen('edit-world-book-screen');
            }
        }
    });
    
    // 长按删除
    document.getElementById('world-book-list-container').addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const item = e.target.closest('.list-item');
        if (!item) return;
        
        createContextMenu([{
            label: '删除条目', danger: true,
            action: async () => {
                if (confirm('删除此条目？')) {
                    db.worldBooks = db.worldBooks.filter(b => b.id !== item.dataset.id);
                    await saveData();
                    renderWorldBookList();
                }
            }
        }], e.clientX, e.clientY);
    });
}

function renderWorldBookList() {
    const list = document.getElementById('world-book-list-container');
    if (!list) return;
    list.innerHTML = '';
    
    if (db.worldBooks.length === 0) {
        document.getElementById('no-world-books-placeholder').style.display = 'block';
    } else {
        document.getElementById('no-world-books-placeholder').style.display = 'none';
        db.worldBooks.forEach(book => {
            const li = document.createElement('li');
            li.className = 'list-item';
            li.dataset.id = book.id;
            li.innerHTML = `
                <div class="item-details">
                    <div class="item-name">${book.name} <span style="font-size:10px;color:#999;border:1px solid #ddd;padding:0 4px;border-radius:4px;">${book.position==='before'?'前置':'后置'}</span></div>
                    <div class="item-preview">${book.content}</div>
                </div>
            `;
            list.appendChild(li);
        });
    }
}

// 🟢 修复点2：API 拉取按钮逻辑
function setupApiLogic() {
    // 拉取模型列表
    document.getElementById('fetch-models-btn').onclick = async () => {
        const btn = document.getElementById('fetch-models-btn');
        const select = document.getElementById('api-model');
        const provider = document.getElementById('api-provider').value;
        let url = document.getElementById('api-url').value.trim();
        const key = document.getElementById('api-key').value.trim();
        
        if (!url || !key) return showToast('请先填写地址和 Key');
        
        // 移除末尾斜杠
        if (url.endsWith('/')) url = url.slice(0, -1);
        
        // 构造请求地址
        let fetchUrl = '';
        let headers = {};
        
        if (provider === 'gemini') {
            fetchUrl = `${url}/v1beta/models?key=${key}`;
        } else {
            // OpenAI/Claude/DeepSeek 格式
            fetchUrl = `${url}/v1/models`;
            headers = { 'Authorization': `Bearer ${key}` };
        }
        
        btn.classList.add('loading');
        try {
            const res = await fetch(fetchUrl, { method: 'GET', headers });
            if (!res.ok) throw new Error(`Status: ${res.status}`);
            
            const data = await res.json();
            select.innerHTML = '';
            
            let models = [];
            if (data.data) {
                // OpenAI 格式
                models = data.data.map(m => m.id);
            } else if (data.models) {
                // Gemini 格式
                models = data.models.map(m => m.name.replace('models/', ''));
            }
            
            if (models.length > 0) {
                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.textContent = m;
                    select.appendChild(opt);
                });
                showToast(`成功获取 ${models.length} 个模型`);
            } else {
                select.innerHTML = '<option value="">未找到模型</option>';
            }
        } catch (e) {
            showToast('拉取失败: ' + e.message);
            console.error(e);
        } finally {
            btn.classList.remove('loading');
        }
    };

    // 保存配置
    document.getElementById('api-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        db.apiSettings = Object.fromEntries(fd.entries());
        await saveData();
        showToast('API 配置已保存');
    }
    
    // 自动填充 URL
    document.getElementById('api-provider').onchange = (e) => {
        const defaults = {
            'deepseek': 'https://api.deepseek.com',
            'claude': 'https://api.anthropic.com',
            'gemini': 'https://generativelanguage.googleapis.com'
        };
        const urlInput = document.getElementById('api-url');
        if(defaults[e.target.value]) urlInput.value = defaults[e.target.value];
    };
}

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
    const settingsForm = document.getElementById('chat-settings-form');
    if(settingsForm) {
        settingsForm.onsubmit = async (e) => {
            e.preventDefault();
            if(currentChatType !== 'private') return;
            
            const chat = getChatById(currentChatId, 'private');
            if (!chat) return;

            const fd = new FormData(settingsForm);
            
            // 1. 保存普通文本字段
            chat.remarkName = fd.get('remarkName');
            chat.myName = fd.get('myName');
            chat.persona = fd.get('persona');
            chat.userPersona = fd.get('userPersona'); // 新增：保存用户人设
            chat.theme = fd.get('theme');
            chat.maxMemory = parseInt(fd.get('maxMemory')) || 20;

            // 2. 保存世界书选择
            const selectedBooks = Array.from(settingsForm.querySelectorAll('input[name="worldBookIds"]:checked')).map(cb => cb.value);
            chat.worldBookIds = selectedBooks;

            // 3. 处理图片上传 (需要压缩)
            const charAvatarFile = document.getElementById('setting-char-avatar-input').files[0];
            const myAvatarFile = document.getElementById('setting-my-avatar-input').files[0];
            const chatBgFile = document.getElementById('setting-chat-bg-input').files[0];

            if (charAvatarFile) chat.avatar = await compressImage(charAvatarFile, {maxWidth: 200});
            if (myAvatarFile) chat.myAvatar = await compressImage(myAvatarFile, {maxWidth: 200});
            
            if (chatBgFile) {
                chat.chatBg = await compressImage(chatBgFile, {maxWidth: 1080});
            } else if (window.removeChatBg) {
                delete chat.chatBg;
            }

            // 4. 保存并刷新
            await saveData();
            
            // 更新界面元素
            document.getElementById('chat-room-title').textContent = chat.remarkName;
            document.getElementById('chat-room-screen').style.backgroundImage = chat.chatBg ? `url(${chat.chatBg})` : '';
            renderChatList();
            renderMessages(); // 刷新消息以更新头像
            
            showToast('设置已保存');
            document.getElementById('chat-settings-sidebar').classList.remove('open');
        };
    }
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
    const settingsForm = document.getElementById('chat-settings-form');
    if(settingsForm) {
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
    let worldBookContext = '';
    // 简单的世界书注入逻辑
    if(chat.worldBookIds && chat.worldBookIds.length > 0) {
        const relevantBooks = db.worldBooks.filter(wb => chat.worldBookIds.includes(wb.id));
        worldBookContext = relevantBooks.map(wb => `【${wb.name}】\n${wb.content}`).join('\n\n');
    }

    if(chat.type === 'private') {
        // --- 修改开始 ---
        const userPersonaText = chat.userPersona ? `\n我的设定：${chat.userPersona}` : '';
        
        return `世界观设定：\n${worldBookContext}\n\n你正在扮演 ${chat.realName}。我的名字是 ${chat.myName}。${userPersonaText}\n你的设定是：${chat.persona || '无'}。\n\n请完全沉浸，不要出戏。格式要求：普通消息用 [${chat.realName}的消息：内容]；发表情包用 [${chat.realName}发送的表情包：图片URL]。`;
        // --- 修改结束 ---
    } else {

    if(chat.type === 'private') {
        return `世界观设定：\n${worldBookContext}\n\n你正在扮演 ${chat.realName}。我的名字是 ${chat.myName}。你的设定是：${chat.persona || '无'}。请完全沉浸，格式要求：普通消息用 [${chat.realName}的消息：内容]；发表情包用 [${chat.realName}发送的表情包：图片URL]。`;
    } else {
        const members = chat.members.map(m => `${m.realName}(${m.groupNickname})`).join(', ');
        return `世界观设定：\n${worldBookContext}\n\n你正在扮演群聊中的所有成员：${members}。当前群名：${chat.name}。请随机选择成员发言，格式：[成员真名的消息：内容]。`;
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
        
        // 生成世界书复选框列表
        let worldBookOptions = '';
        if (db.worldBooks.length > 0) {
            worldBookOptions = '<div class="form-group"><label>关联世界书</label><div style="max-height:150px;overflow-y:auto;background:#f9f9f9;padding:10px;border-radius:10px;">';
            db.worldBooks.forEach(wb => {
                const isChecked = chat.worldBookIds && chat.worldBookIds.includes(wb.id) ? 'checked' : '';
                worldBookOptions += `
                    <div style="display:flex;align-items:center;margin-bottom:8px;">
                        <input type="checkbox" name="worldBookIds" value="${wb.id}" ${isChecked} style="width:auto;margin-right:10px;">
                        <span>${wb.name}</span>
                    </div>`;
            });
            worldBookOptions += '</div></div>';
        } else {
            worldBookOptions = '<div class="form-group"><label>关联世界书</label><div style="font-size:12px;color:#999;">暂无世界书，请在主页添加</div></div>';
        }

        const form = document.getElementById('chat-settings-form');
        form.innerHTML = `
            <!-- 1. 头像设置区域 (并排显示) -->
            <div style="display:flex; justify-content:space-around; margin-bottom:20px;">
                <div style="text-align:center;">
                    <label style="font-size:12px;display:block;margin-bottom:5px;">对方头像</label>
                    <img src="${chat.avatar}" id="setting-char-avatar-preview" class="avatar-preview" style="width:60px;height:60px;" onclick="document.getElementById('setting-char-avatar-input').click()">
                    <input type="file" id="setting-char-avatar-input" style="display:none;" accept="image/*">
                </div>
                <div style="text-align:center;">
                    <label style="font-size:12px;display:block;margin-bottom:5px;">我的头像</label>
                    <img src="${chat.myAvatar || 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg'}" id="setting-my-avatar-preview" class="avatar-preview" style="width:60px;height:60px;" onclick="document.getElementById('setting-my-avatar-input').click()">
                    <input type="file" id="setting-my-avatar-input" style="display:none;" accept="image/*">
                </div>
            </div>

            <!-- 2. 基础信息 -->
            <div class="form-group"><label>角色备注名</label><input name="remarkName" value="${chat.remarkName}"></div>
            <div class="form-group"><label>我的称呼 (对方怎么叫我)</label><input name="myName" value="${chat.myName}"></div>
            
            <!-- 3. 人设区域 -->
            <div class="form-group"><label>角色人设 (System Prompt)</label><textarea name="persona" rows="4" placeholder="定义角色的性格、背景...">${chat.persona || ''}</textarea></div>
            <div class="form-group"><label>我的人设 (可选)</label><textarea name="userPersona" rows="3" placeholder="定义我在故事中的设定...">${chat.userPersona || ''}</textarea></div>

            <!-- 4. 世界书 -->
            ${worldBookOptions}

            <!-- 5. 样式与背景 -->
            <div class="form-group"><label>主题气泡颜色</label>
                <select name="theme">
                    ${Object.entries(COLOR_THEMES).map(([k,v]) => `<option value="${k}" ${chat.theme===k?'selected':''}>${v.name}</option>`).join('')}
                </select>
            </div>
            
            <div class="form-group"><label>聊天背景图</label>
                <div style="display:flex;align-items:center;gap:10px;">
                    <img src="${chat.chatBg || ''}" id="setting-chat-bg-preview" style="width:40px;height:40px;border-radius:8px;object-fit:cover;background:#eee;border:1px solid #ddd;">
                    <input type="file" id="setting-chat-bg-input" style="display:none;" accept="image/*">
                    <button type="button" class="btn btn-secondary" style="margin:0;padding:8px 15px;width:auto;" onclick="document.getElementById('setting-chat-bg-input').click()">选择图片</button>
                    <button type="button" class="btn btn-neutral" style="margin:0;padding:8px 15px;width:auto;" onclick="document.getElementById('setting-chat-bg-preview').src='';window.removeChatBg=true;">清除</button>
                </div>
            </div>

            <div class="form-group"><label>最大记忆轮数</label><input type="number" name="maxMemory" value="${chat.maxMemory || 20}"></div>

            <!-- 6. 保存按钮 -->
            <button type="submit" class="btn btn-primary">保存设置</button>
        `;

        // 绑定预览逻辑
        const bindPreview = (inputId, imgId) => {
            document.getElementById(inputId).onchange = (e) => {
                const file = e.target.files[0];
                if(file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => document.getElementById(imgId).src = evt.target.result;
                    reader.readAsDataURL(file);
                }
            };
        };
        bindPreview('setting-char-avatar-input', 'setting-char-avatar-preview');
        bindPreview('setting-my-avatar-input', 'setting-my-avatar-preview');
        bindPreview('setting-chat-bg-input', 'setting-chat-bg-preview');
        window.removeChatBg = false; // 重置清除标记
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