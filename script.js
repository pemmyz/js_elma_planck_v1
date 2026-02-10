const canvas = document.getElementById('simulation');
const ctx = canvas.getContext('2d');

// Setup Canvas Dimensions
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

// Game State Configuration
let config = {
    style: 'new' // 'new' (default) or 'old'
};

// Planck.js setup
const pl = planck;
const Vec2 = pl.Vec2;

// PHYSICS CONFIGURATION
const SCALE = 30; // 30 pixels = 1 meter
const world = pl.World(Vec2(0, 0)); // 0 Gravity

// DEFINITIONS
const BASE_RADIUS_PX = 60; 
const BALL_DENSITY = 1.0;
const BALL_FRICTION = 0.3; 
const BALL_RESTITUTION = 1.0; 

// Store bodies
const balls = [];

// Helper: Pixels <-> Meters
const p2m = (px) => px / SCALE;
const m2p = (m) => m * SCALE;

// 1. Create Walls
function createWall(x, y, w, h) {
    const body = world.createBody(Vec2(p2m(x), p2m(y)));
    body.createFixture(pl.Box(p2m(w/2), p2m(h/2)), {
        friction: 0.0,
        restitution: 1.0 
    });
}

const wallThickness = 50;
createWall(WIDTH/2, -wallThickness/2, WIDTH, wallThickness); // Top
createWall(WIDTH/2, HEIGHT + wallThickness/2, WIDTH, wallThickness); // Bottom
createWall(-wallThickness/2, HEIGHT/2, wallThickness, HEIGHT); // Left
createWall(WIDTH + wallThickness/2, HEIGHT/2, wallThickness, HEIGHT); // Right

// 2. Create Balls
function createBall(xPx, yPx, radiusPx, color, shouldMove) {
    const radiusM = p2m(radiusPx);
    
    // Dynamic body
    const body = world.createDynamicBody(Vec2(p2m(xPx), p2m(yPx)));
    
    // No dampening
    body.setLinearDamping(0.0);
    body.setAngularDamping(0.0);

    body.createFixture(pl.Circle(radiusM), {
        density: BALL_DENSITY,
        friction: BALL_FRICTION,
        restitution: BALL_RESTITUTION 
    });

    if (shouldMove) {
        const speed = 15; 
        const angle = Math.random() * Math.PI * 2;
        body.setLinearVelocity(Vec2(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        ));
    } else {
        body.setLinearVelocity(Vec2(0, 0));
        body.setAngularVelocity(0);
    }

    balls.push({
        body: body,
        radius: radiusPx,
        color: color
    });
}

// 3. Initialize 3x3 Matrix
function initGame() {
    // Clear existing balls
    balls.forEach(b => world.destroyBody(b.body));
    balls.length = 0;

    const rows = 3;
    
    // Spacing calculations
    const startX = WIDTH * 0.2; 
    const spaceX = WIDTH * 0.3; 
    const startY = HEIGHT * 0.25;
    const spaceY = HEIGHT * 0.25;

    for (let r = 0; r < rows; r++) {
        const yPos = startY + (r * spaceY);

        // Logic for movement based on style
        // 'old': everyone moves
        // 'new': only Top Left (row 0, col 0) moves
        const isOldStyle = config.style === 'old';
        const isTopRow = r === 0;

        // --- Column 2: Big Balls (Right) ---
        const bigR = BASE_RADIUS_PX; 
        createBall(
            startX + (spaceX * 2), 
            yPos, 
            bigR, 
            '#FF5733', 
            isOldStyle // In 'new' mode, these are static
        );

        // --- Column 1: Middle Balls (Middle) ---
        const midR = bigR * 0.5;
        createBall(
            startX + (spaceX * 1), 
            yPos, 
            midR, 
            '#33FF57', 
            isOldStyle // In 'new' mode, these are static
        );

        // --- Column 0: Small Balls (Left) ---
        // 0.75 of the middle balls
        const leftR = midR * 0.75; 
        
        // In New mode, only top row (r==0) moves for this column
        const leftShouldMove = isOldStyle || (config.style === 'new' && isTopRow);

        createBall(
            startX, 
            yPos, 
            leftR, 
            '#3357FF', 
            leftShouldMove
        );
    }
}

// 4. Render Loop
function loop() {
    world.step(1 / 60);

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

        // Spin visualization
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(b.radius, 0); 
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -b.radius/2);
        ctx.lineTo(0, b.radius/2);
        ctx.stroke();

        ctx.restore();
    }

    requestAnimationFrame(loop);
}

// 5. Input Handling & Menu Logic

function toggleMenu() {
    menu.classList.toggle('hidden');
}

function updateConfigFromUI() {
    for (const rb of radioButtons) {
        if (rb.checked) {
            config.style = rb.value;
            break;
        }
    }
}

// Open Menu Logic
btnTrigger.addEventListener('click', () => {
    toggleMenu();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'o' || e.key === 'O') {
        toggleMenu();
    }
});

// Menu Buttons
btnApply.addEventListener('click', () => {
    updateConfigFromUI();
    initGame();
    menu.classList.add('hidden'); // Close menu after applying
});

btnClose.addEventListener('click', () => {
    // Just close, don't restart (unless user manually clicked apply before)
    // To ensure UI matches reality if they changed radio but didn't click apply:
    // We could revert UI, but simple is fine:
    menu.classList.add('hidden');
});

// Canvas click to reset (Quick restart based on current config)
canvas.addEventListener('click', () => {
    // Only reset if menu is closed to prevent clicking through
    if(menu.classList.contains('hidden')) {
        initGame();
    }
});

// Start
initGame();
loop();
