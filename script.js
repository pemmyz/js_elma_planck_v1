const canvas = document.getElementById('simulation');
const ctx = canvas.getContext('2d');

const WIDTH = 1280;
const HEIGHT = 720;
canvas.width = WIDTH;
canvas.height = HEIGHT;

// UI Elements
const menu = document.getElementById('options-menu');
const btnTrigger = document.getElementById('btn-options-trigger');
const btnApply = document.getElementById('btn-apply');
const btnClose = document.getElementById('btn-close');
const radioButtons = document.getElementsByName('style');

let config = { style: 'new' };

const pl = planck;
const Vec2 = pl.Vec2;
const SCALE = 30; 

// Physics World
const world = pl.World({
    gravity: Vec2(0, 0),
    velocityThreshold: 0, // Critical for keeping momentum
    blockSolve: true 
});

const BASE_RADIUS_PX = 60; 
const BALL_DENSITY = 1.0;
const BALL_FRICTION = 0.3; 
const BALL_RESTITUTION = 1.0; 

const balls = [];

const p2m = (px) => px / SCALE;
const m2p = (m) => m * SCALE;

// --- WALL LOGIC ---
const wallThickness = 50;
const boundsLeft = 0;
const boundsRight = p2m(WIDTH);
const boundsTop = 0;
const boundsBottom = p2m(HEIGHT);

function createWall(x, y, w, h) {
    const body = world.createBody(Vec2(p2m(x), p2m(y)));
    body.createFixture(pl.Box(p2m(w/2), p2m(h/2)), {
        friction: 0.0, // Frictionless walls helps prevent initial sticking
        restitution: 1.0, 
        density: 0.0
    });
}

createWall(WIDTH/2, -wallThickness/2, WIDTH, wallThickness); // Top
createWall(WIDTH/2, HEIGHT + wallThickness/2, WIDTH, wallThickness); // Bottom
createWall(-wallThickness/2, HEIGHT/2, wallThickness, HEIGHT); // Left
createWall(WIDTH + wallThickness/2, HEIGHT/2, wallThickness, HEIGHT); // Right

// --- BALL LOGIC ---
function createBall(xPx, yPx, radiusPx, color, shouldMove) {
    const radiusM = p2m(radiusPx);
    const body = world.createDynamicBody(Vec2(p2m(xPx), p2m(yPx)));
    body.setBullet(true); // CCD enabled
    body.setLinearDamping(0.0);
    body.setAngularDamping(0.0);

    body.setUserData({ radius: radiusM, isBall: true });

    body.createFixture(pl.Circle(radiusM), {
        density: BALL_DENSITY,
        friction: BALL_FRICTION, 
        restitution: BALL_RESTITUTION 
    });

    if (shouldMove) {
        const speed = 25; 
        const angle = Math.random() * Math.PI * 2;
        body.setLinearVelocity(Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed));
    } else {
        body.setLinearVelocity(Vec2(0, 0));
        body.setAngularVelocity(0);
    }

    balls.push({ body: body, radius: radiusPx, color: color });
}

function initGame() {
    balls.forEach(b => world.destroyBody(b.body));
    balls.length = 0;

    const rows = 3;
    const startX = WIDTH * 0.2; 
    const spaceX = WIDTH * 0.3; 
    const startY = HEIGHT * 0.25;
    const spaceY = HEIGHT * 0.25;

    for (let r = 0; r < rows; r++) {
        const yPos = startY + (r * spaceY);
        const isOldStyle = config.style === 'old';
        const isTopRow = r === 0;

        const bigR = BASE_RADIUS_PX; 
        createBall(startX + (spaceX * 2), yPos, bigR, '#FF5733', isOldStyle);

        const midR = bigR * 0.5;
        createBall(startX + (spaceX * 1), yPos, midR, '#33FF57', isOldStyle);

        const leftR = midR * 0.75; 
        const leftShouldMove = isOldStyle || (config.style === 'new' && isTopRow);
        createBall(startX, yPos, leftR, '#3357FF', leftShouldMove);
    }
}

// --- RENDER & PHYSICS LOOP ---
function loop() {
    world.step(1 / 60);

    // --- CORNER EJECTION LOGIC ---
    // 1. Detect if ball is in corner.
    // 2. If so, calculate speed and redirect exactly 45 degrees away.
    // 3. Nudge ball slightly away from wall so physics engine doesn't cancel the bounce.
    
    // Tolerance buffer for wall detection
    const tolerance = p2m(1.0); 
    // Small nudge amount (meters) to clear the wall collision
    const nudge = p2m(2.0); 

    balls.forEach(b => {
        const pos = b.body.getPosition();
        const r = p2m(b.radius);
        const vel = b.body.getLinearVelocity();
        
        // Check Wall Touches
        const touchLeft = (pos.x - r <= boundsLeft + tolerance);
        const touchRight = (pos.x + r >= boundsRight - tolerance);
        const touchTop = (pos.y - r <= boundsTop + tolerance);
        const touchBottom = (pos.y + r >= boundsBottom - tolerance);

        // Check if hitting a corner (2 walls at once)
        if ((touchLeft && touchTop) || (touchRight && touchTop) || 
            (touchLeft && touchBottom) || (touchRight && touchBottom)) {
            
            // Get current speed. If it's sliding slowly, give it a minimum boost (15).
            let speed = vel.length();
            if (speed < 15) speed = 15;

            // Calculate 45 degree components: Speed * sin(45) = Speed * 0.7071
            const component = speed * 0.7071;

            if (touchLeft && touchTop) {
                // Top-Left -> Go Bottom-Right (+X, +Y)
                b.body.setLinearVelocity(Vec2(component, component));
                // Teleport slightly out to prevent sticking
                b.body.setPosition(Vec2(boundsLeft + r + nudge, boundsTop + r + nudge));
            } 
            else if (touchRight && touchTop) {
                // Top-Right -> Go Bottom-Left (-X, +Y)
                b.body.setLinearVelocity(Vec2(-component, component));
                b.body.setPosition(Vec2(boundsRight - r - nudge, boundsTop + r + nudge));
            } 
            else if (touchLeft && touchBottom) {
                // Bottom-Left -> Go Top-Right (+X, -Y)
                b.body.setLinearVelocity(Vec2(component, -component));
                b.body.setPosition(Vec2(boundsLeft + r + nudge, boundsBottom - r - nudge));
            } 
            else if (touchRight && touchBottom) {
                // Bottom-Right -> Go Top-Left (-X, -Y)
                b.body.setLinearVelocity(Vec2(-component, -component));
                b.body.setPosition(Vec2(boundsRight - r - nudge, boundsBottom - r - nudge));
            }
        }
    });

    // Draw
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

        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(b.radius, 0); 
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -b.radius/2); ctx.lineTo(0, b.radius/2); ctx.stroke();
        ctx.restore();
    }
    requestAnimationFrame(loop);
}

// --- MENU & INPUT ---
function toggleMenu() { menu.classList.toggle('hidden'); }
function updateConfigFromUI() {
    for (const rb of radioButtons) {
        if (rb.checked) { config.style = rb.value; break; }
    }
}
btnTrigger.addEventListener('click', toggleMenu);
document.addEventListener('keydown', (e) => {
    if (e.key === 'o' || e.key === 'O') toggleMenu();
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
