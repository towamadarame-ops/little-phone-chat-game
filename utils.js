// --- 工具类与底层逻辑 ---

// 1. 数据库管理 (封装 Dexie)
class DataStorage {
    constructor() {
        // 数据库名称已修改为通用的 AIChatOS_DB
        this.db = new Dexie('AIChatOS_DB');
        this.db.version(1).stores({
            storage: 'key, value, timestamp'
        });
    }

    async saveData(key, data) {
        try {
            await this.db.storage.put({
                key: key,
                value: JSON.stringify(data),
                timestamp: Date.now()
            });
            return true;
        } catch (error) {
            console.error('Save failed:', error);
            return false;
        }
    }

    async getData(key) {
        try {
            const item = await this.db.storage.get(key);
            return item ? JSON.parse(item.value) : null;
        } catch (error) {
            console.error('Get failed:', error);
            return null;
        }
    }
}

// 2. 图片压缩工具
async function compressImage(file, options = {}) {
    const { quality = 0.8, maxWidth = 800, maxHeight = 800 } = options;
    if (file.type === 'image/gif') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onerror = reject;
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onerror = reject;
            img.onload = () => {
                let width = img.width, height = img.height;
                if (width > height) {
                    if (width > maxWidth) { height = Math.round(height * (maxWidth / width)); width = maxWidth; }
                } else {
                    if (height > maxHeight) { width = Math.round(width * (maxHeight / height)); height = maxHeight; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (file.type === 'image/png') { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height); }
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        };
    });
}

// 3. 通用辅助函数
function getRandomValue(str) {
    if (str.includes(',')) {
        const arr = str.split(',').map(item => item.trim());
        return arr[Math.floor(Math.random() * arr.length)];
    }
    return str;
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

function showToast(message) {
    const toast = document.getElementById('toast-notification');
    if(toast) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

// 4. 右键/长按菜单生成器
function createContextMenu(items, x, y) {
    removeContextMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    items.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item';
        if (item.danger) menuItem.classList.add('danger');
        menuItem.textContent = item.label;
        menuItem.onclick = () => {
            item.action();
            removeContextMenu();
        };
        menu.appendChild(menuItem);
    });
    document.body.appendChild(menu);
    document.addEventListener('click', removeContextMenu, {once: true});
}

function removeContextMenu() {
    const menu = document.querySelector('.context-menu');
    if (menu) menu.remove();
}

// 全局变量导出
window.DataStorage = DataStorage;
window.compressImage = compressImage;
window.getRandomValue = getRandomValue;
window.pad = pad;
window.showToast = showToast;
window.createContextMenu = createContextMenu;
window.removeContextMenu = removeContextMenu;