const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let width, height;

function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const MAP_SIZE = 16;
const TILE_SIZE = 64;
const FOV = Math.PI / 3;
const NUM_RAYS = Math.min(width, 640);
const MAX_DEPTH = 20;

const map = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,0,0,0,0,0,0,0,1,1,0,1],
    [1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,1,1,0,0,1,1,0,0,0,0,1],
    [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
    [1,0,0,0,0,1,1,0,0,1,1,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,1,1,0,0,0,0,0,0,0,0,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const player = {
    x: 2.5,
    y: 2.5,
    angle: 0,
    health: 100,
    ammo: 30,
    maxAmmo: 90,
    reserveAmmo: 90,
    score: 0,
    speed: 0.08,
    rotSpeed: 0.04
};

let enemies = [];
let bullets = [];
let gameRunning = false;
let lastTime = 0;

const keys = {};
let mouseX = 0;
let isMouseDown = false;

function castRay(angle) {
    let sin = Math.sin(angle);
    let cos = Math.cos(angle);
    
    for (let depth = 0; depth < MAX_DEPTH * TILE_SIZE; depth += 1) {
        let targetX = player.x * TILE_SIZE + cos * depth;
        let targetY = player.y * TILE_SIZE + sin * depth;
        
        let mapX = Math.floor(targetX / TILE_SIZE);
        let mapY = Math.floor(targetY / TILE_SIZE);
        
        if (mapX >= 0 && mapX < MAP_SIZE && mapY >= 0 && mapY < MAP_SIZE) {
            if (map[mapY][mapX] === 1) {
                return {
                    distance: depth,
                    x: targetX,
                    y: targetY,
                    mapX: mapX,
                    mapY: mapY
                };
            }
        }
    }
    
    return {
        distance: MAX_DEPTH * TILE_SIZE,
        x: player.x * TILE_SIZE + cos * MAX_DEPTH * TILE_SIZE,
        y: player.y * TILE_SIZE + sin * MAX_DEPTH * TILE_SIZE
    };
}

function render3D() {
    const rayWidth = width / NUM_RAYS;
    
    for (let i = 0; i < NUM_RAYS; i++) {
        let rayAngle = player.angle - FOV / 2 + (i / NUM_RAYS) * FOV;
        let ray = castRay(rayAngle);
        
        let correctedDistance = ray.distance * Math.cos(rayAngle - player.angle);
        let wallHeight = (TILE_SIZE * height) / correctedDistance;
        
        let brightness = Math.max(0, 1 - correctedDistance / (MAX_DEPTH * TILE_SIZE));
        let r = Math.floor(100 * brightness);
        let g = Math.floor(100 * brightness);
        let b = Math.floor(150 * brightness);
        
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(i * rayWidth, (height - wallHeight) / 2, rayWidth + 1, wallHeight);
    }
}

function renderFloor() {
    const gradient = ctx.createLinearGradient(0, height / 2, 0, height);
    gradient.addColorStop(0, '#2a2a3e');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height / 2, width, height / 2);
}

function renderCeiling() {
    const gradient = ctx.createLinearGradient(0, 0, 0, height / 2);
    gradient.addColorStop(0, '#0a0a1e');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height / 2);
}

function spawnEnemy() {
    let x, y;
    do {
        x = Math.random() * (MAP_SIZE - 2) + 1;
        y = Math.random() * (MAP_SIZE - 2) + 1;
    } while (map[Math.floor(y)][Math.floor(x)] === 1 || 
             Math.abs(x - player.x) < 3 && Math.abs(y - player.y) < 3);
    
    enemies.push({
        x: x,
        y: y,
        health: 30,
        speed: 0.02 + Math.random() * 0.01,
        damage: 10,
        lastAttack: 0,
        size: 0.5
    });
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        let enemy = enemies[i];
        
        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0.5) {
            let moveX = (dx / dist) * enemy.speed;
            let moveY = (dy / dist) * enemy.speed;
            
            let newX = enemy.x + moveX;
            let newY = enemy.y + moveY;
            
            if (map[Math.floor(newY)][Math.floor(newX)] === 0) {
                enemy.x = newX;
                enemy.y = newY;
            }
        }
        
        if (dist < 1 && Date.now() - enemy.lastAttack > 1000) {
            player.health -= enemy.damage;
            enemy.lastAttack = Date.now();
            updateUI();
            
            if (player.health <= 0) {
                gameOver();
            }
        }
        
        if (enemy.health <= 0) {
            enemies.splice(i, 1);
            player.score += 100;
            updateUI();
        }
    }
}

function renderEnemies() {
    enemies.forEach(enemy => {
        let dx = enemy.x - player.x;
        let dy = enemy.y - player.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        
        let angle = Math.atan2(dy, dx);
        let angleDiff = angle - player.angle;
        
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        if (Math.abs(angleDiff) < FOV / 2 + 0.2) {
            let screenX = width / 2 + (angleDiff / FOV) * width;
            let size = (TILE_SIZE * height * 0.6) / (dist * TILE_SIZE);
            
            let brightness = Math.max(0.2, 1 - dist / 10);
            let r = Math.floor(255 * brightness);
            let g = Math.floor(50 * brightness);
            let b = Math.floor(50 * brightness);
            
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(screenX - size / 2, height / 2 - size / 2, size, size);
            
            ctx.fillStyle = `rgb(${Math.floor(200 * brightness)},${Math.floor(200 * brightness)},0)`;
            ctx.fillRect(screenX - size / 4, height / 2 - size / 4, size / 2, size / 4);
        }
    });
}

function shoot() {
    if (player.ammo <= 0) return;
    
    player.ammo--;
    updateUI();
    
    let hit = false;
    let ray = castRay(player.angle);
    
    enemies.forEach(enemy => {
        let dx = enemy.x - player.x;
        let dy = enemy.y - player.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        
        let angle = Math.atan2(dy, dx);
        let angleDiff = Math.abs(angle - player.angle);
        
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        
        if (angleDiff < 0.1 && dist < ray.distance / TILE_SIZE) {
            enemy.health -= 15;
            hit = true;
        }
    });
    
    if (!hit) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.fillRect(0, 0, width, height);
    }
}

function reload() {
    if (player.reserveAmmo > 0 && player.ammo < 30) {
        let needed = 30 - player.ammo;
        let available = Math.min(needed, player.reserveAmmo);
        player.ammo += available;
        player.reserveAmmo -= available;
        updateUI();
    }
}

function updateUI() {
    document.getElementById('healthText').textContent = `生命值: ${player.health}`;
    document.getElementById('healthFill').style.width = `${player.health}%`;
    document.getElementById('ammoText').textContent = `弹药: ${player.ammo}/${player.reserveAmmo}`;
    document.getElementById('scoreText').textContent = `得分: ${player.score}`;
}

function movePlayer() {
    let moveX = 0;
    let moveY = 0;
    
    if (keys['w'] || keys['W'] || keys['ArrowUp']) {
        moveX += Math.cos(player.angle) * player.speed;
        moveY += Math.sin(player.angle) * player.speed;
    }
    if (keys['s'] || keys['S'] || keys['ArrowDown']) {
        moveX -= Math.cos(player.angle) * player.speed;
        moveY -= Math.sin(player.angle) * player.speed;
    }
    if (keys['a'] || keys['A'] || keys['ArrowLeft']) {
        moveX += Math.cos(player.angle - Math.PI / 2) * player.speed;
        moveY += Math.sin(player.angle - Math.PI / 2) * player.speed;
    }
    if (keys['d'] || keys['D'] || keys['ArrowRight']) {
        moveX += Math.cos(player.angle + Math.PI / 2) * player.speed;
        moveY += Math.sin(player.angle + Math.PI / 2) * player.speed;
    }
    
    let newX = player.x + moveX;
    let newY = player.y + moveY;
    
    if (map[Math.floor(player.y)][Math.floor(newX)] === 0) {
        player.x = newX;
    }
    if (map[Math.floor(newY)][Math.floor(player.x)] === 0) {
        player.y = newY;
    }
}

let joystickActive = false;
let joystickX = 0;
let joystickY = 0;

const moveJoystick = document.getElementById('moveJoystick');
const moveJoystickKnob = document.getElementById('moveJoystickKnob');

moveJoystick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joystickActive = true;
});

moveJoystick.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!joystickActive) return;
    
    const rect = moveJoystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const touch = e.touches[0];
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    
    const maxDist = 35;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
    }
    
    joystickX = dx / maxDist;
    joystickY = dy / maxDist;
    
    moveJoystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
});

moveJoystick.addEventListener('touchend', () => {
    joystickActive = false;
    joystickX = 0;
    joystickY = 0;
    moveJoystickKnob.style.transform = 'translate(-50%, -50%)';
});

document.getElementById('fireButton').addEventListener('touchstart', (e) => {
    e.preventDefault();
    shoot();
});

document.getElementById('reloadButton').addEventListener('touchstart', (e) => {
    e.preventDefault();
    reload();
});

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (e.key === ' ' || e.key === 'r' || e.key === 'R') {
        reload();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

canvas.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
        player.angle += e.movementX * 0.002;
    }
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        shoot();
    }
});

canvas.addEventListener('click', () => {
    canvas.requestPointerLock();
});

function gameLoop(timestamp) {
    if (!gameRunning) return;
    
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    movePlayer();
    
    if (joystickActive) {
        player.x += joystickX * player.speed;
        player.y += joystickY * player.speed;
        
        let newX = player.x + joystickX * player.speed;
        let newY = player.y + joystickY * player.speed;
        
        if (map[Math.floor(player.y)][Math.floor(newX)] === 0) {
            player.x = newX;
        }
        if (map[Math.floor(newY)][Math.floor(player.x)] === 0) {
            player.y = newY;
        }
    }
    
    updateEnemies();
    
    renderCeiling();
    renderFloor();
    render3D();
    renderEnemies();
    
    if (Math.random() < 0.01 && enemies.length < 10) {
        spawnEnemy();
    }
    
    requestAnimationFrame(gameLoop);
}

function startGame() {
    gameRunning = true;
    player.x = 2.5;
    player.y = 2.5;
    player.angle = 0;
    player.health = 100;
    player.ammo = 30;
    player.reserveAmmo = 90;
    player.score = 0;
    enemies = [];
    
    for (let i = 0; i < 3; i++) {
        spawnEnemy();
    }
    
    updateUI();
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameRunning = false;
    document.getElementById('finalScore').textContent = `最终得分: ${player.score}`;
    document.getElementById('gameOver').style.display = 'flex';
}

document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('restartButton').addEventListener('click', startGame);