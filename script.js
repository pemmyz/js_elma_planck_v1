const canvas = document.getElementById('simulation');
const ctx = canvas.getContext('2d');

// Setup Canvas Dimensions
const WIDTH = 1280;
const HEIGHT = 720;
canvas.width = WIDTH;
canvas.height = HEIGHT;

// Planck.js setup
const pl = planck;
const Vec2 = pl.Vec2;

// PHYSICS CONFIGURATION
// Scale: 30 pixels = 1 meter (Box2D/Planck works best with MKS units)
const SCALE = 30; 

// World with 0 gravity (top-down view simulation)
const world = pl.World(Vec2(0, 0));

// DEFINITIONS
// Base radius for the "Big Balls" (in pixels)
const BASE_RADIUS_PX = 60; 

const BALL_DENSITY = 1.0;
const BALL_FRICTION = 0.3; // Friction required to generate spin on collision
const BALL_RESTITUTION = 1.0; // 1.0 = Perfectly elastic (bounces with same force, no energy loss)

// Store bodies for rendering
const balls = [];

// Helper to convert Pixels to Meters
const p2m = (px) => px / SCALE;
// Helper to convert Meters to Pixels
const m2p = (m) => m * SCALE;

// 1. Create Walls (Static Bodies)
// We create walls so balls don't fly off screen.
function createWall(x, y, w, h) {
    const body = world.createBody(Vec2(p2m(x), p2m(y)));
    body.createFixture(pl.Box(p2m(w/2), p2m(h/2)), {
        friction: 0.0,
        restitution: 1.0 
    });
}

// Top, Bottom, Left, Right Walls
const wallThickness = 50;
createWall(WIDTH/2, -wallThickness/2, WIDTH, wallThickness); // Top
createWall(WIDTH/2, HEIGHT + wallThickness/2, WIDTH, wallThickness); // Bottom
createWall(-wallThickness/2, HEIGHT/2, wallThickness, HEIGHT); // Left
createWall(WIDTH + wallThickness/2, HEIGHT/2, wallThickness, HEIGHT); // Right

// 2. Create Balls
function createBall(xPx, yPx, radiusPx, color) {
    const radiusM = p2m(radiusPx);
    
    // Dynamic body with mass and inertia
    const body = world.createDynamicBody(Vec2(p2m(xPx), p2m(yPx)));
    
    // NO DAMPENING as requested (inertia is kept fully)
    body.setLinearDamping(0.0);
    body.setAngularDamping(0.0);

    body.createFixture(pl.Circle(radiusM), {
        density: BALL_DENSITY,
        friction: BALL_FRICTION, // Friction causes rotation when balls slide/hit
        restitution: BALL_RESTITUTION 
    });

    // Give them a random initial velocity so they start bouncing immediately
    const speed = 15; 
    const angle = Math.random() * Math.PI * 2;
    body.setLinearVelocity(Vec2(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
    ));

    balls.push({
        body: body,
        radius: radiusPx,
        color: color
    });
}

// 3. Initialize 3x3 Matrix
function initGame() {
    // Clear existing balls if restarting
    balls.forEach(b => world.destroyBody(b.body));
    balls.length = 0;

    // Grid Settings
    const rows = 3;
    const cols = 3;
    
    // Calculate spacing
    const startX = WIDTH * 0.2; // Start at 20% width
    const spaceX = WIDTH * 0.3; // Space columns out
    const startY = HEIGHT * 0.25;
    const spaceY = HEIGHT * 0.25;

    for (let r = 0; r < rows; r++) {
        const yPos = startY + (r * spaceY);

        /* 
           Columns Logic:
           Left (0): 0.75 of Middle
           Middle (1): Half of Big
           Right (2): Big Balls
        */
       
        // Right Most (Col 2)
        const bigR = BASE_RADIUS_PX; 
        createBall(startX + (spaceX * 2), yPos, bigR, '#FF5733'); // Red/Orange

        // Middle (Col 1)
        const midR = bigR * 0.5;
        createBall(startX + (spaceX * 1), yPos, midR, '#33FF57'); // Green

        // Left Most (Col 0)
        // 0.75 of the middle balls
        const leftR = midR * 0.75; 
        createBall(startX, yPos, leftR, '#3357FF'); // Blue
    }
}

// 4. Render Loop
function loop() {
    // Step physics: 1/60 seconds
    world.step(1 / 60);

    // Clear Canvas
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Draw Balls
    for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        const pos = b.body.getPosition(); // in meters
        const angle = b.body.getAngle();  // in radians

        const x = m2p(pos.x);
        const y = m2p(pos.y);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Draw Circle
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw a line inside to visualize Spin/Inertia
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(b.radius, 0); // Line from center to edge
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.stroke();

        // Draw a cross to see rotation better
        ctx.beginPath();
        ctx.moveTo(0, -b.radius/2);
        ctx.lineTo(0, b.radius/2);
        ctx.stroke();

        ctx.restore();
    }

    requestAnimationFrame(loop);
}

// Start
initGame();
loop();

// Reset on click
canvas.addEventListener('click', () => {
    // To reset, we just re-run init. 
    // Note: In a real complex app, you'd manage memory better, 
    // but planck handles body destruction efficiently.
    // We clear the JS array in initGame.
    initGame();
});
