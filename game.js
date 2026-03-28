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
        ceiling: '#ff3c3c',
        dino: '#535353',
        ptero: '#757575',
        bullet: '#ffff00'
    },
    enemySpawnRate: 0.3, // 30% 機率在平台上生成敵人
    pteroSpawnInterval: 5000 // 5 秒生成一次翼龍
};

// 像素圖形定義
const SPRITES = {
    dino: [
        [0,0,0,0,1,1,1,1],
        [0,0,0,0,1,0,1,1],
        [0,0,0,0,1,1,1,1],
        [1,0,0,1,1,1,0,0],
        [1,1,1,1,1,1,1,0],
        [0,1,1,1,1,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,1,0,1,0,0,0]
    ],
    ptero: [
        [0,0,1,1,1,0,0],
        [1,1,1,1,1,1,1],
        [0,0,1,1,1,0,0],
        [0,0,0,1,0,0,0]
    ]
};

// 狀態變數
let gameActive = false;
let floorCount = 1;
let platforms = [];
let enemies = [];
let bullets = [];
let lastPlatformTime = 0;
let lastPteroTime = 0;
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

// 子彈類別
class Bullet {
    constructor(x, y, vx, vy, isEnemy = true) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = 6;
        this.isEnemy = isEnemy;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        ctx.fillStyle = CONFIG.colors.bullet;
        ctx.shadowBlur = 10;
        ctx.shadowColor = CONFIG.colors.bullet;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.shadowBlur = 0;
    }
}

// 敵人類別
class Enemy {
    constructor(x, y, width, height, type) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
        this.lastShootTime = 0;
        this.shootInterval = 2000;
    }

    drawPixelArt(sprite, x, y, size, color) {
        ctx.fillStyle = color;
        for (let r = 0; r < sprite.length; r++) {
            for (let c = 0; c < sprite[r].length; c++) {
                if (sprite[r][c]) {
                    ctx.fillRect(x + c * size, y + r * size, size, size);
                }
            }
        }
    }
}

class DinoEnemy extends Enemy {
    constructor(platform) {
        super(platform.x + platform.width/2 - 12, platform.y - 32, 24, 32, 'dino');
        this.platform = platform;
        this.dir = 1;
        this.walkRange = 20;
        this.offsetX = 0;
    }

    update() {
        this.y = this.platform.y - this.height;
        this.offsetX += 0.5 * this.dir;
        if (Math.abs(this.offsetX) > this.walkRange) this.dir *= -1;
        this.x = this.platform.x + this.platform.width/2 - this.width/2 + this.offsetX;

        // 射擊邏輯
        const now = Date.now();
        if (now - this.lastShootTime > this.shootInterval) {
            this.shoot();
            this.lastShootTime = now;
        }
    }

    shoot() {
        // 朝玩家方向射擊
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const angle = Math.atan2(dy, dx);
        bullets.push(new Bullet(this.x + this.width/2, this.y, Math.cos(angle) * 3, Math.sin(angle) * 3));
    }

    draw() {
        this.drawPixelArt(SPRITES.dino, this.x, this.y, 4, CONFIG.colors.dino);
    }
}

class PteroEnemy extends Enemy {
    constructor() {
        const side = Math.random() > 0.5 ? 1 : -1;
        const x = side > 0 ? -50 : CONFIG.canvasWidth + 50;
        const y = 100 + Math.random() * 200;
        super(x, y, 32, 20, 'ptero');
        this.vx = side * (1.5 + Math.random());
    }

    update() {
        this.x += this.vx;
        
        // 定時向下投彈
        const now = Date.now();
        if (now - this.lastShootTime > 3000) {
            bullets.push(new Bullet(this.x + this.width/2, this.y + this.height, 0, 3));
            this.lastShootTime = now;
        }
    }

    draw() {
        this.drawPixelArt(SPRITES.ptero, this.x, this.y, 4, CONFIG.colors.ptero);
    }
}

// 核心功能
function initGame() {
    canvas.width = CONFIG.canvasWidth;
    canvas.height = CONFIG.canvasHeight;
    
    // 預設第 0 個平台
    platforms = [new Platform(400, 'normal')];
    enemies = [];
    bullets = [];
    player.reset();
    floorCount = 1;
    updateUI();
}

function spawnPlatform() {
    const types = ['normal', 'normal', 'normal', 'spikes', 'spring', 'conveyor', 'fading'];
    const type = types[Math.floor(Math.random() * types.length)];
    const p = new Platform(CONFIG.canvasHeight, type);
    platforms.push(p);
    
    // 機率性生成小恐龍
    if (type === 'normal' && Math.random() < CONFIG.enemySpawnRate) {
        enemies.push(new DinoEnemy(p));
    }

    // 每一段時間增加層數
    floorCount++;
    updateUI();
}

function spawnPtero() {
    enemies.push(new PteroEnemy());
}

function checkCollision() {
    // 平台碰撞 (略，已在原有邏輯中)
    if (!(player.vy < 0 && !player.onPlatform)) {
        for (let p of platforms) {
            if (
                player.x + player.width > p.x &&
                player.x < p.x + p.width &&
                player.y + player.height >= p.y &&
                player.y + player.height <= p.y + p.height + player.vy
            ) {
                if (player.onPlatform !== p) {
                    player.onPlatform = p;
                    player.y = p.y - player.height;
                    player.vy = 0;
                    if (p.type === 'spikes') player.takeDamage(3);
                    else if (p.type === 'spring') {
                        player.vy = CONFIG.jumpForce * 2;
                        player.onPlatform = null;
                    } else if (p.type === 'normal') player.heal(1);
                }
                if (p.type === 'conveyor') player.x += p.conveyorDir * 1.5;
                break; 
            }
        }
    }

    // 敵人與子彈碰撞
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (
            player.x < b.x + b.size &&
            player.x + player.width > b.x &&
            player.y < b.y + b.size &&
            player.y + player.height > b.y
        ) {
            player.takeDamage(2);
            bullets.splice(i, 1);
        }
    }

    for (let e of enemies) {
        if (
            player.x < e.x + e.width &&
            player.x + player.width > e.x &&
            player.y < e.y + e.height &&
            player.y + player.height > e.y
        ) {
            player.takeDamage(2);
        }
    }
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

    // 更新與生成物件
    if (time - lastPlatformTime > CONFIG.platformSpawnInterval) {
        spawnPlatform();
        lastPlatformTime = time;
    }
    if (time - lastPteroTime > CONFIG.pteroSpawnInterval) {
        spawnPtero();
        lastPteroTime = time;
    }

    // 平台更新
    platforms.forEach((p, index) => {
        p.update();
        p.draw();
        if (p.y < -50) platforms.splice(index, 1);
    });

    // 敵人更新
    enemies.forEach((e, index) => {
        e.update();
        e.draw();
        if (e.y < -50 || e.x < -100 || e.x > CONFIG.canvasWidth + 100) {
            enemies.splice(index, 1);
        }
    });

    // 子彈更新
    bullets.forEach((b, index) => {
        b.update();
        b.draw();
        if (b.y < -50 || b.y > CONFIG.canvasHeight + 50 || b.x < -50 || b.x > CONFIG.canvasWidth + 50) {
            bullets.splice(index, 1);
        }
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
