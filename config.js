// --- 配置文件 ---

// 1. 默认应用图标 (使用通用图床或占位符)
const DEFAULT_ICONS = {
    'chat-list-screen': { name: '消息', url: 'https://i.postimg.cc/sgbRm9Ld/xiao-xi-icon.png' },
    'api-settings-screen': { name: '设置', url: 'https://i.postimg.cc/0yhqnd41/she-zhi-icon.png' },
    'wallpaper-screen': { name: '壁纸', url: 'https://i.postimg.cc/0yhqnd4g/bi-zhi-icon.png' },
    'world-book-screen': { name: '世界书', url: 'https://i.postimg.cc/Mpg85bFC/shi-jie-shu-icon.png' },
    'customize-screen': { name: '自定义', url: 'https://i.postimg.cc/DwRK6dMp/zi-ding-yi-icon.png' },
    'font-settings-screen': { name: '字体', url: 'https://i.postimg.cc/3xzH1Ccn/zi-ti-icon.png' },
    'tutorial-screen': { name: '说明', url: 'https://i.postimg.cc/52DMgqRk/shuo-ming-icon.png' },
    'day-mode-btn': { name: '', url: 'https://i.postimg.cc/vZCdhLNP/bai-tian-mo-shi-icon.png' },
    'night-mode-btn': { name: '', url: 'https://i.postimg.cc/zG417Scx/ye-wan-mo-shi-icon.png' }
};

// 2. 聊天气泡配色方案
const COLOR_THEMES = {
    'white_pink': {
        name: '白/粉 (默认)',
        received: { bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D' },
        sent: { bg: 'rgba(255,204,204,0.9)', text: '#A56767' }
    },
    'white_blue': {
        name: '白/蓝',
        received: { bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D' },
        sent: { bg: 'rgba(173,216,230,0.9)', text: '#4A6F8A' }
    },
    'black_white': {
        name: '黑/白 (极简)',
        received: { bg: 'rgba(30,30,30,0.85)', text: '#E0E0E0' },
        sent: { bg: 'rgba(245,245,245,0.9)', text: '#333' }
    },
    'white_green': {
        name: '白/绿 (护眼)',
        received: { bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D' },
        sent: { bg: 'rgba(188,238,188,0.9)', text: '#4F784F' }
    },
     'black_green': {
        name: '黑/绿 (黑客)',
        received: {bg: 'rgba(30,30,30,0.85)', text: '#E0E0E0'},
        sent: {bg: 'rgba(119,221,119,0.9)', text: '#2E5C2E'}
    }
};

// 3. 教程内容 (通用化)
const TUTORIAL_CONTENT = [
    { title: '快速开始', content: '欢迎使用 AI ChatOS。这是一个完全运行在本地的 AI 角色扮演模拟器。你可以创建角色、组建群聊，并体验模拟真实的社交软件互动。' },
    { title: '如何设置 API', content: '在主屏幕点击“设置”图标。支持 NewAPI、DeepSeek、Claude 和 Gemini。请确保填入正确的 API Key 以启用 AI 对话功能。' },
    { title: '数据安全', content: '所有聊天记录和设置都存储在你的浏览器本地（IndexedDB），不会上传到任何服务器。请定期使用“备份数据”功能以防丢失。' }
];

// 全局导出
window.DEFAULT_ICONS = DEFAULT_ICONS;
window.COLOR_THEMES = COLOR_THEMES;
window.TUTORIAL_CONTENT = TUTORIAL_CONTENT;