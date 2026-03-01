// ==========================================
// SCALING LOGIC (Strict 1080p Aspect Ratio)
// ==========================================
function scaleGame() {
    const screen = document.getElementById("screen");
    const baseWidth = 1920;
    const baseHeight = 1080;
    
    // Math.min forces a strict 16:9 aspect ratio fit (letterbox/pillarbox)
    const scale = Math.min(
        window.innerWidth / baseWidth,
        window.innerHeight / baseHeight
    );
    
    // Translate centers the screen strictly, scale fits it into the viewport
    screen.style.transform = `translate(-50%, -50%) scale(${scale})`;
    document.body.classList.add('mobile-mode'); // Locks scrolling & swipe gestures
}

// Attach scaling listeners
window.addEventListener("resize", scaleGame);
window.addEventListener("fullscreenchange", scaleGame);
window.addEventListener("webkitfullscreenchange", scaleGame);

// Initial scale
scaleGame();


// ==========================================
// PART 1: PHYSICS SIMULATION
// ==========================================
const canvas = document.getElementById('simulation');
const ctx = canvas.getContext('2d');

let config = { style: 'new', graphics: 'new' };

const pl = planck;
const Vec2 = pl.Vec2;
const SCALE = 30; 

// FIXED 1080p Dimensions (Window size no longer affects this)
const WIDTH = 1920;
const HEIGHT = 1080;
canvas.width = WIDTH;
canvas.height = HEIGHT;

const p2m = (px) => px / SCALE;
const m2p = (m) => m * SCALE;

const world = pl.World({
    gravity: Vec2(0, 0),
    velocityThreshold: 0, 
    blockSolve: true 
});

const BASE_RADIUS_PX = 60; 
const BALL_DENSITY = 1.0;
const BALL_FRICTION = 0.3; 
const BALL_RESTITUTION = 1.0; 

const balls = [];
const wallBodies = [];

// --- WALL LOGIC ---
const wallThickness = 50;
let boundsLeft, boundsRight, boundsTop, boundsBottom;

function updateBounds() {
    boundsLeft = 0;
    boundsRight = p2m(WIDTH);
    boundsTop = 0;
    boundsBottom = p2m(HEIGHT);
}

function createSingleWall(x, y, w, h) {
    const body = world.createBody(Vec2(p2m(x), p2m(y)));
    body.createFixture(pl.Box(p2m(w/2), p2m(h/2)), {
        friction: 0.0, restitution: 1.0, density: 0.0
    });
    wallBodies.push(body);
}

function setupWalls() {
    wallBodies.forEach(b => world.destroyBody(b));
    wallBodies.length = 0;

    createSingleWall(WIDTH/2, -wallThickness/2, WIDTH, wallThickness); // Top
    createSingleWall(WIDTH/2, HEIGHT + wallThickness/2, WIDTH, wallThickness); // Bottom
    createSingleWall(-wallThickness/2, HEIGHT/2, wallThickness, HEIGHT); // Left
    createSingleWall(WIDTH + wallThickness/2, HEIGHT/2, wallThickness, HEIGHT); // Right

    updateBounds();
}

setupWalls();

// --- BALL LOGIC ---
function createBall(xPx, yPx, radiusPx, color, shouldMove) {
    const radiusM = p2m(radiusPx);
    const body = world.createDynamicBody(Vec2(p2m(xPx), p2m(yPx)));
    body.setBullet(true);
    body.setLinearDamping(0.0);
    body.setAngularDamping(0.0);
    body.setUserData({ radius: radiusM, isBall: true });

    body.createFixture(pl.Circle(radiusM), {
        density: BALL_DENSITY, friction: BALL_FRICTION, restitution: BALL_RESTITUTION 
    });

    if (shouldMove) {
        const speed = 25; 
        const angle = Math.random() * Math.PI * 2;
        body.setLinearVelocity(Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed));
    }

    balls.push({ body: body, radius: radiusPx, color: color });
}

function initGame() {
    balls.forEach(b => world.destroyBody(b.body));
    balls.length = 0;

    const rows = 3;
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;
    
    const rowHeight = 140; 
    const totalBlockHeight = rowHeight * (rows - 1); 
    const startY = centerY - (totalBlockHeight / 2);

    for (let r = 0; r < rows; r++) {
        const yPos = startY + (r * rowHeight);
        const isOldStyle = config.style === 'old';
        const isTopRow = r === 0;

        const smallR = BASE_RADIUS_PX * 0.5 * 0.75; 
        const leftShouldMove = isOldStyle || (config.style === 'new' && isTopRow);
        createBall(centerX - 130, yPos, smallR, '#3357FF', leftShouldMove);

        const midR = BASE_RADIUS_PX * 0.5;
        createBall(centerX, yPos, midR, '#33FF57', isOldStyle);

        const bigR = BASE_RADIUS_PX; 
        createBall(centerX + 150, yPos, bigR, '#FF5733', isOldStyle);
    }
}

// --- RENDER & PHYSICS LOOP ---
function loop() {
    world.step(1 / 60);

    const tolerance = p2m(1.0); 
    const nudge = p2m(2.0); 

    balls.forEach(b => {
        const pos = b.body.getPosition();
        const r = p2m(b.radius);
        const vel = b.body.getLinearVelocity();
        
        const touchLeft = (pos.x - r <= boundsLeft + tolerance);
        const touchRight = (pos.x + r >= boundsRight - tolerance);
        const touchTop = (pos.y - r <= boundsTop + tolerance);
        const touchBottom = (pos.y + r >= boundsBottom - tolerance);

        if ((touchLeft && touchTop) || (touchRight && touchTop) || 
            (touchLeft && touchBottom) || (touchRight && touchBottom)) {
            
            let speed = vel.length();
            if (speed < 15) speed = 15;
            const component = speed * 0.7071;

            if (touchLeft && touchTop) {
                b.body.setLinearVelocity(Vec2(component, component));
                b.body.setPosition(Vec2(boundsLeft + r + nudge, boundsTop + r + nudge));
            } 
            else if (touchRight && touchTop) {
                b.body.setLinearVelocity(Vec2(-component, component));
                b.body.setPosition(Vec2(boundsRight - r - nudge, boundsTop + r + nudge));
            } 
            else if (touchLeft && touchBottom) {
                b.body.setLinearVelocity(Vec2(component, -component));
                b.body.setPosition(Vec2(boundsLeft + r + nudge, boundsBottom - r - nudge));
            } 
            else if (touchRight && touchBottom) {
                b.body.setLinearVelocity(Vec2(-component, -component));
                b.body.setPosition(Vec2(boundsRight - r - nudge, boundsBottom - r - nudge));
            }
        }
    });

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        const pos = b.body.getPosition();
        const angle = b.body.getAngle();
        const x = m2p(pos.x);
        const y = m2p(pos.y);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        let smallR, offset;
        if (b.radius >= 55) { smallR = 13.33; offset = 26.66; } 
        else if (b.radius >= 25) { smallR = 6; offset = 12; } 
        else { smallR = 4.5; offset = 9; }

        if (config.graphics === 'new') {
            ctx.beginPath();
            ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(40, 40, 40, 0.5)"; 
            ctx.fill();

            ctx.globalCompositeOperation = "destination-out";
            ctx.fillStyle = "black"; 
            ctx.beginPath(); ctx.arc(-offset, 0, smallR, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(offset, 0, smallR, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
            ctx.fillStyle = b.color;
            ctx.fill();

            ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke();
            ctx.strokeStyle = "rgba(0, 0, 0, 0.4)"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(-offset, 0, smallR, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(offset, 0, smallR, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore(); 
    }
    requestAnimationFrame(loop);
}

// --- UI & INTERACTIONS ---
const menu = document.getElementById('options-menu');
const btnTrigger = document.getElementById('btn-options-trigger');
const btnMobile = document.getElementById('btn-mobile');
const btnApply = document.getElementById('btn-apply');
const btnClose = document.getElementById('btn-close');
const radioButtons = document.getElementsByName('style');
const selectGraphics = document.getElementById('graphics-style');
const bgInput = document.getElementById('bg-text-input');

function goFull() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}

btnMobile.addEventListener('click', goFull);

function toggleMenu() { menu.classList.toggle('hidden'); }

function updateConfigFromUI() {
    for (const rb of radioButtons) {
        if (rb.checked) { config.style = rb.value; break; }
    }
    config.graphics = selectGraphics.value;
    if (window.updateBgText) window.updateBgText(bgInput.value || " ");
}

btnTrigger.addEventListener('click', toggleMenu);
document.addEventListener('keydown', (e) => {
    if (e.target !== bgInput && (e.key === 'o' || e.key === 'O')) toggleMenu();
});
btnApply.addEventListener('click', () => {
    updateConfigFromUI();
    initGame();
    menu.classList.add('hidden'); 
});
btnClose.addEventListener('click', () => { menu.classList.add('hidden'); });

canvas.addEventListener('click', () => {
    if(menu.classList.contains('hidden')) initGame();
});

initGame();
loop();


// ==========================================
// PART 2: DYNAMIC BACKGROUND (Pemmyz)
// ==========================================
(function() {
    const screenBg = document.getElementById("bg-canvas");
    const sctx = screenBg.getContext("2d");
    
    // Fixed Size for 1080p rendering matching the physics engine
    const BG_WIDTH = 1920;
    const BG_HEIGHT = 1080;
    screenBg.width = BG_WIDTH;
    screenBg.height = BG_HEIGHT;
    
    let currentText = "pemmyz"; 
    const FONT_STR = "bold 44px Arial Black, Impact, sans-serif";
    const TILE_H = 80; 
    let TILE_W = 220;  
    let ROW_OFFSET = 0;
    
    let animateNoise = false; 
    let animationFrameId = null;

    const tile = document.createElement("canvas");
    const tileCtx = tile.getContext("2d", { willReadFrequently: true });

    window.updateBgText = function(newText) {
        currentText = newText;
        startBg(); 
    };

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function updateDimensions() {
        tileCtx.font = FONT_STR;
        const metrics = tileCtx.measureText(currentText);
        const textWidth = Math.ceil(metrics.width);
        const padding = 60; 
        TILE_W = Math.max(50, textWidth + padding);
        tile.width = TILE_W;
        tile.height = TILE_H;
        ROW_OFFSET = Math.floor(TILE_W * 0.5);
    }

    function renderTile() {
        tileCtx.clearRect(0, 0, TILE_W, TILE_H);
        
        tileCtx.fillStyle = "rgb(12, 55, 12)";
        tileCtx.fillRect(0, 0, TILE_W, TILE_H);
        
        tileCtx.save();
        tileCtx.textAlign = "center";
        tileCtx.textBaseline = "middle";
        tileCtx.font = FONT_STR;
        tileCtx.shadowColor = "rgba(0, 255, 0, 0.20)";
        tileCtx.shadowBlur = 10;
        tileCtx.fillStyle = "rgba(0, 120, 0, 0.55)";
        tileCtx.fillText(currentText, TILE_W / 2, TILE_H / 2);
        tileCtx.shadowBlur = 0;
        tileCtx.fillStyle = "rgba(0, 90, 0, 0.65)";
        tileCtx.fillText(currentText, TILE_W / 2, TILE_H / 2);
        tileCtx.restore();

        // Smear
        tileCtx.save();
        tileCtx.globalAlpha = 0.10;
        tileCtx.drawImage(tile, -1, 0); tileCtx.drawImage(tile, 1, 0);
        tileCtx.drawImage(tile, 0, -1); tileCtx.drawImage(tile, 0, 1);
        tileCtx.restore();

        // Noise
        const img = tileCtx.getImageData(0, 0, TILE_W, TILE_H);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const noise = (Math.random() * 2 - 1) * 35 * 0.85;
            d[i] = clamp(d[i] + noise * 0.4, 0, 255);
            d[i + 1] = clamp(d[i + 1] + noise * 1.0, 0, 255);
            d[i + 2] = clamp(d[i + 2] + noise * 0.4, 0, 255);
        }
        tileCtx.putImageData(img, 0, 0);

        // Scanlines
        tileCtx.save();
        tileCtx.globalAlpha = 0.08;
        tileCtx.fillStyle = "#000";
        for (let y = 0; y < TILE_H; y += 2) tileCtx.fillRect(0, y, TILE_W, 1);
        tileCtx.restore();
    }

    function drawStaggeredTiling(imgSource) {
        sctx.clearRect(0, 0, BG_WIDTH, BG_HEIGHT);
        sctx.fillStyle = "rgb(12, 55, 12)";
        sctx.fillRect(0, 0, BG_WIDTH, BG_HEIGHT);

        const rows = Math.ceil(BG_HEIGHT / TILE_H) + 1;
        const cols = Math.ceil(BG_WIDTH / TILE_W) + 2;

        for (let r = 0; r < rows; r++) {
            const y = r * TILE_H;
            const offset = (r % 2 === 0) ? 0 : -ROW_OFFSET;

            for (let c = 0; c < cols; c++) {
                const x = (c * TILE_W) + offset;
                sctx.drawImage(imgSource, x, y);
            }
        }
    }

    let cachedStaticImg = null;

    function renderStaticOnce() {
        renderTile();
        const img = new Image();
        img.onload = () => {
            cachedStaticImg = img;
            drawStaggeredTiling(cachedStaticImg);
        };
        img.src = tile.toDataURL();
    }

    function animateLoop() {
        if (!animateNoise) return;
        renderTile();
        drawStaggeredTiling(tile);
        animationFrameId = requestAnimationFrame(animateLoop);
    }

    function startBg() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        updateDimensions();

        if (animateNoise) {
            cachedStaticImg = null;
            animateLoop();
        } else {
            renderStaticOnce();
        }
    }

    window.addEventListener("keydown", (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.key.toLowerCase() === "a") {
            animateNoise = !animateNoise;
            startBg();
        }
    });

    startBg();
})();
