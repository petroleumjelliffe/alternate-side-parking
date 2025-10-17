/**
 * Sprite rendering module
 * Now uses procedural generation from procedural-sprites.js
 */

import { seeded, GENERATORS } from "./procedural-sprites.js";

const OUTLINE_COLOR = "#9CA089"; // Olive green background color
const OUTLINE_WIDTH = 2;

// Initialize sprite cache with seeded generation
let spriteCache = null;

function initializeSpriteCache() {
  if (spriteCache) return spriteCache;

  const rng = seeded("game-sprites-v1");
  const scale = 2; // Scale factor for sprite generation

  // Generate different vehicle types
  const vehicles = {
    player: GENERATORS.car(rng, scale),
    car1: GENERATORS.car(rng, scale),
    car2: GENERATORS.car(rng, scale),
    car3: GENERATORS.pickup(rng, scale),
    car4: GENERATORS.van(rng, scale),
  };

  spriteCache = {
    vehicles,
    initialized: true,
  };

  return spriteCache;
}

// Get a random vehicle sprite (for variety in traffic)
function getRandomCarSprite(seed = Math.random()) {
  const cache = initializeSpriteCache();
  const carSprites = [
    cache.vehicles.car1,
    cache.vehicles.car2,
    cache.vehicles.car3,
    cache.vehicles.car4,
  ];
  const index = Math.floor(seed * carSprites.length);
  return carSprites[index];
}

const sprites = {
  /**
   * Renders the player's car
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X position (center)
   * @param {number} y - Y position
   * @param {string} speedName - Current speed indicator (P, R, D, F)
   * @param {number} scale - Scale factor (default 1.0)
   * @param {number} opacity - Opacity (0-1, default 1.0)
   */
  playerCar: (ctx, x, y, speedName, scale = 1.0, opacity = 1.0) => {
    if (opacity === 0) return; // Skip if fully transparent

    const cache = initializeSpriteCache();
    const sprite = cache.vehicles.player;
    const cellWidth = 80;
    const cellHeight = 80;

    ctx.globalAlpha = opacity;

    // Calculate position to center sprite
    const spriteWidth = sprite.canvas.width * scale;
    const spriteHeight = sprite.canvas.height * scale;
    const centerX = x + (cellWidth - spriteWidth) / 2;
    const centerY = y + (cellHeight - spriteHeight) / 2;

    // Draw the procedural sprite
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.drawImage(sprite.canvas, 0, 0);
    ctx.restore();

    // Speed indicator overlay
    ctx.fillStyle = "#FFF";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.font = `bold ${12 * scale}px monospace`;
    const textX = x + cellWidth / 2 - 6 * scale;
    const textY = y + cellHeight / 2 + 4 * scale;
    ctx.strokeText(speedName, textX, textY);
    ctx.fillText(speedName, textX, textY);

    ctx.globalAlpha = 1.0; // Reset
  },

  /**
   * Renders a regular car (obstacle or parked)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X position (cell origin)
   * @param {number} y - Y position
   * @param {number} scale - Scale factor (default 1.0)
   * @param {number} opacity - Opacity (0-1, default 1.0)
   * @param {Object} spriteObj - Optional pre-generated sprite object
   */
  car: (ctx, x, y, scale = 1.0, opacity = 1.0, spriteObj = null) => {
    if (opacity === 0) return; // Skip if fully transparent

    // Use provided sprite object or fall back to position-based sprite
    const sprite = spriteObj || getRandomCarSprite((x * 7 + y * 13) % 1);
    const cellWidth = 80;
    const cellHeight = 80;

    ctx.globalAlpha = opacity;

    // Calculate position to center sprite
    const spriteWidth = sprite.canvas.width * scale;
    const spriteHeight = sprite.canvas.height * scale;
    const centerX = x + (cellWidth - spriteWidth) / 2;
    const centerY = y + (cellHeight - spriteHeight) / 2;

    // Draw the procedural sprite
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.drawImage(sprite.canvas, 0, 0);
    ctx.restore();

    ctx.globalAlpha = 1.0; // Reset
  },

  /**
   * Renders a parking spot (dashed outline)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X position (cell origin)
   * @param {number} y - Y position
   * @param {number} scale - Scale factor (default 1.0)
   * @param {number} opacity - Opacity (0-1, default 1.0)
   */
  spot: (ctx, x, y, scale = 1.0, opacity = 1.0) => {
    if (opacity === 0) return; // Skip if fully transparent

    const cellWidth = 80;
    const cellHeight = 80;
    const scaledWidth = 60 * scale;
    const scaledHeight = 60 * scale;

    // Center the sprite
    const centerOffset = (cellWidth - scaledWidth) / 2;
    const baseX = x + centerOffset;
    const baseY = y + (cellHeight - scaledHeight) / 2;

    ctx.globalAlpha = opacity;

    // Dashed outline
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2 * scale;
    ctx.setLineDash([5 * scale, 5 * scale]);
    ctx.strokeRect(baseX, baseY, scaledWidth, scaledHeight);
    ctx.setLineDash([]);

    // Olive green outline
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = OUTLINE_WIDTH * scale;
    ctx.setLineDash([]);
    ctx.strokeRect(baseX, baseY, scaledWidth, scaledHeight);

    ctx.globalAlpha = 1.0; // Reset
  },

  /**
   * Renders an obstacle
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X position (cell origin)
   * @param {number} y - Y position
   * @param {number} scale - Scale factor (default 1.0)
   * @param {number} opacity - Opacity (0-1, default 1.0)
   */
  obstacle: (ctx, x, y, scale = 1.0, opacity = 1.0) => {
    if (opacity === 0) return; // Skip if fully transparent

    const cellWidth = 80;
    const cellHeight = 80;
    const scaledWidth = 30 * scale;
    const scaledHeight = 30 * scale;

    // Center the sprite
    const centerOffset = (cellWidth - scaledWidth) / 2;
    const baseX = x + centerOffset;
    const baseY = y + (cellHeight - scaledHeight) / 2;

    ctx.globalAlpha = opacity;

    // Main body
    ctx.fillStyle = "#000";
    ctx.fillRect(baseX, baseY, scaledWidth, scaledHeight);

    // Outline
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = OUTLINE_WIDTH * scale;
    ctx.strokeRect(baseX, baseY, scaledWidth, scaledHeight);

    ctx.globalAlpha = 1.0; // Reset
  },

  /**
   * Renders a fire hydrant
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X position (cell origin)
   * @param {number} y - Y position
   * @param {number} scale - Scale factor (default 1.0)
   * @param {number} opacity - Opacity (0-1, default 1.0)
   */
  hydrant: (ctx, x, y, scale = 1.0, opacity = 1.0) => {
    if (opacity === 0) return; // Skip if fully transparent

    const cellWidth = 80;
    const cellHeight = 80;
    const totalWidth = 20 * scale;
    const totalHeight = 30 * scale;

    // Center the sprite
    const centerOffset = (cellWidth - totalWidth) / 2;
    const baseX = x + centerOffset;
    const baseY = y + (cellHeight - totalHeight) / 2;

    ctx.globalAlpha = opacity;

    // Main body
    ctx.fillStyle = "#000";
    // Base
    ctx.fillRect(baseX, baseY + (5 * scale), totalWidth, 20 * scale);
    // Top
    ctx.fillRect(baseX + (5 * scale), baseY, 10 * scale, totalHeight);

    // Outline for base
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = OUTLINE_WIDTH * scale;
    ctx.strokeRect(baseX, baseY + (5 * scale), totalWidth, 20 * scale);
    // Outline for top
    ctx.strokeRect(baseX + (5 * scale), baseY, 10 * scale, totalHeight);

    ctx.globalAlpha = 1.0; // Reset
  },

  /**
   * Renders a crash indicator (X)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X position (cell origin)
   * @param {number} y - Y position
   * @param {number} scale - Scale factor (default 1.0)
   * @param {number} opacity - Opacity (0-1, default 1.0)
   */
  crash: (ctx, x, y, scale = 1.0, opacity = 1.0) => {
    if (opacity === 0) return; // Skip if fully transparent

    const cellWidth = 80;
    const cellHeight = 80;
    const size = 40 * scale;

    // Center the sprite
    const centerX = x + cellWidth / 2;
    const centerY = y + cellHeight / 2;
    const halfSize = size / 2;

    ctx.globalAlpha = opacity;

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 5 * scale;
    ctx.beginPath();
    ctx.moveTo(centerX - halfSize, centerY - halfSize);
    ctx.lineTo(centerX + halfSize, centerY + halfSize);
    ctx.moveTo(centerX + halfSize, centerY - halfSize);
    ctx.lineTo(centerX - halfSize, centerY + halfSize);
    ctx.stroke();

    ctx.globalAlpha = 1.0; // Reset
  },
};

export default sprites;
