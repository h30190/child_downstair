/**
 * 小朋友下樓梯 - 霓虹生存戰
 * 核心遊戲邏輯
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 遊戲設定
const CONFIG = {
    canvasWidth: 400,
    canvasHeight: 600,
    gravity: 0.25,
    maxFallSpeed: 8,
    jumpForce: -6,
    playerSpeed: 3.5,
    scrollSpeed: 1.2,
    platformSpawnInterval: 1200, // 毫秒
    maxHP: 12,
    colors: {
        player: '#00ff95',
        normal: '#ffffff',
        spikes: '#ff3c3c',
        spring: '#ffff00',
        conveyor: '#00ccff',
        fading: '#a5f3fc',
        ceiling: '#ff3c3c'
    }
};

// 狀態變數
let gameActive = false;
let floorCount = 1;
let platforms = [];
let lastPlatformTime = 0;
let keys = {};

// 玩家物件
const player = {
    x: 200,
    y: 100,
    width: 24,
    height: 24,
    vx: 0,
    vy: 0,
    hp: CONFIG.maxHP,
    onPlatform: null,
    
    reset() {
        this.x = CONFIG.canvasWidth / 2 - this.width / 2;
        this.y = 80;
        this.vx = 0;
        this.vy = 0;
        this.hp = CONFIG.maxHP;
        this.onPlatform = null;
    },

    update() {
        // 左右移動
        if (keys['ArrowLeft'] || keys['a']) this.vx = -CONFIG.playerSpeed;
        else if (keys['ArrowRight'] || keys['d']) this.vx = CONFIG.playerSpeed;
        else this.vx = 0;

        this.x += this.vx;

        // 邊界檢查
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > CONFIG.canvasWidth) this.x = CONFIG.canvasWidth - this.width;

        // 重力與垂直移動
        if (this.onPlatform) {
            this.vy = -CONFIG.scrollSpeed; // 跟隨平台上升
            this.y = this.onPlatform.y - this.height;
            
            // 檢查是否還在平台上
            if (this.x + this.width < this.onPlatform.x || this.x > this.onPlatform.x + this.onPlatform.width) {
                this.onPlatform = null;
            }
        } else {
            this.vy += CONFIG.gravity;
            if (this.vy > CONFIG.maxFallSpeed) this.vy = CONFIG.maxFallSpeed;
            this.y += this.vy;
        }

        // 天花板碰撞 (受傷)
        if (this.y < 0) {
            this.y = 10;
            this.vy = 2;
            this.takeDamage(3);
        }

        // 掉落死亡
        if (this.y > CONFIG.canvasHeight) {
            gameOver();
        }
    },

    draw() {
        // 繪製玩家 (發光效果)
        ctx.shadowBlur = 15;
        ctx.shadowColor = CONFIG.colors.player;
        ctx.fillStyle = CONFIG.colors.player;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    },

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            gameOver();
        }
        updateUI();
    },

    heal(amount) {
        this.hp = Math.min(this.hp + amount, CONFIG.maxHP);
        updateUI();
    }
};

// 平台類別
class Platform {
    constructor(y, type = 'normal') {
        this.width = 80;
        this.height = 12;
        this.x = Math.random() * (CONFIG.canvasWidth - this.width);
        this.y = y;
        this.type = type;
        this.opacity = 1;
        this.conveyorDir = Math.random() > 0.5 ? 1 : -1;
    }

    update() {
        this.y -= CONFIG.scrollSpeed;
        
        // 特殊平台邏輯
        if (this.type === 'fading' && player.onPlatform === this) {
            this.opacity -= 0.02;
            if (this.opacity <= 0) {
                this.y = -100; // 移除
            }
        }
    }

    draw() {
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = CONFIG.colors[this.type];
        
        // 繪製平台主體
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // 繪製細節 (例如針刺)
        if (this.type === 'spikes') {
            ctx.fillStyle = '#fff';
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(this.x + i * 20 + 5, this.y);
                ctx.lineTo(this.x + i * 20 + 10, this.y - 8);
                ctx.lineTo(this.x + i * 20 + 15, this.y);
                ctx.fill();
            }
        } else if (this.type === 'conveyor') {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            const arrowX = this.conveyorDir > 0 ? this.x + this.width - 15 : this.x + 5;
            ctx.fillText(this.conveyorDir > 0 ? '>>' : '<<', arrowX, this.y + 10);
        }

        ctx.globalAlpha = 1;
    }
}

// 核心功能
function initGame() {
    canvas.width = CONFIG.canvasWidth;
    canvas.height = CONFIG.canvasHeight;
    
    // 預設第 0 個平台
    platforms = [new Platform(400, 'normal')];
    player.reset();
    floorCount = 1;
    updateUI();
}

function spawnPlatform() {
    const types = ['normal', 'normal', 'normal', 'spikes', 'spring', 'conveyor', 'fading'];
    const type = types[Math.floor(Math.random() * types.length)];
    platforms.push(new Platform(CONFIG.canvasHeight, type));
    
    // 每一段時間增加層數
    floorCount++;
    updateUI();
}

function checkCollision() {
    if (player.vy < 0 && !player.onPlatform) return;

    for (let p of platforms) {
        if (
            player.x + player.width > p.x &&
            player.x < p.x + p.width &&
            player.y + player.height >= p.y &&
            player.y + player.height <= p.y + p.height + player.vy
        ) {
            // 碰撞發生
            if (player.onPlatform !== p) {
                // 初次落到這個平台
                player.onPlatform = p;
                player.y = p.y - player.height;
                player.vy = 0;

                // 處理效果
                if (p.type === 'spikes') {
                    player.takeDamage(3);
                } else if (p.type === 'spring') {
                    player.vy = CONFIG.jumpForce * 2;
                    player.onPlatform = null;
                } else if (p.type === 'normal') {
                    player.heal(1);
                }
            }
            
            // 傳送帶位移
            if (p.type === 'conveyor') {
                player.x += p.conveyorDir * 1.5;
            }
            return;
        }
    }
    player.onPlatform = null;
}

function updateUI() {
    document.getElementById('hp-bar-fill').style.width = (player.hp / CONFIG.maxHP) * 100 + '%';
    document.getElementById('hp-text').innerText = `${player.hp}/${CONFIG.maxHP}`;
    document.getElementById('floor-value').innerText = `B${floorCount}`;
    
    // 血量危險變色
    const fill = document.getElementById('hp-bar-fill');
    if (player.hp <= 3) fill.style.background = CONFIG.colors.spikes;
    else fill.style.background = 'linear-gradient(90deg, #00ff95, #00ffc3)';
}

function gameOver() {
    gameActive = false;
    document.getElementById('overlay').classList.add('active');
    document.getElementById('menu-panel').classList.add('hidden');
    document.getElementById('gameover-panel').classList.remove('hidden');
    document.getElementById('final-floor').innerText = floorCount;
}

function resetGame() {
    initGame();
    document.getElementById('overlay').classList.remove('active');
    document.getElementById('menu-panel').classList.remove('hidden');
    document.getElementById('gameover-panel').classList.add('hidden');
    gameActive = true;
    requestAnimationFrame(gameLoop);
}

// 繪製天花板針刺
function drawCeiling() {
    ctx.fillStyle = CONFIG.colors.ceiling;
    for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 20, 0);
        ctx.lineTo(i * 20 + 10, 20);
        ctx.lineTo(i * 20 + 20, 0);
        ctx.fill();
    }
}

const gameLoop = (time) => {
    if (!gameActive) return;

    // 清除畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 更新與生成平台
    if (time - lastPlatformTime > CONFIG.platformSpawnInterval) {
        spawnPlatform();
        lastPlatformTime = time;
    }

    platforms.forEach((p, index) => {
        p.update();
        p.draw();
        // 移除超出畫面的平台
        if (p.y < -50) platforms.splice(index, 1);
    });

    // 更新角色
    player.update();
    checkCollision();
    player.draw();

    // 繪製天花板
    drawCeiling();

    requestAnimationFrame(gameLoop);
};

// 事件監聽
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

document.getElementById('start-btn').addEventListener('click', () => {
    resetGame();
});

document.getElementById('restart-btn').addEventListener('click', () => {
    resetGame();
});

// 初始化
initGame();
