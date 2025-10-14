/**
 * Sprite rendering module
 * Each sprite function can be replaced with image rendering in the future
 */

const OUTLINE_COLOR = "#9CA089"; // Olive green background color
const OUTLINE_WIDTH = 2;

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

    const cellWidth = 80;
    const cellHeight = 80;

    // Calculate scaled dimensions
    const scaledWidth = 60 * scale;
    const scaledHeight = 60 * scale;
    const scaledWindowWidth = 40 * scale;
    const scaledWindowHeight = 20 * scale;

    // Center the sprite horizontally within the cell
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

    // Window
    ctx.fillStyle = "#9CA089";
    ctx.fillRect(
      baseX + (10 * scale),
      baseY + (10 * scale),
      scaledWindowWidth,
      scaledWindowHeight
    );

    // Speed indicator
    ctx.fillStyle = "#000";
    ctx.font = `bold ${16 * scale}px monospace`;
    ctx.fillText(speedName, baseX + (22 * scale), baseY + (45 * scale));

    ctx.globalAlpha = 1.0; // Reset
  },

  /**
   * Renders a regular car (obstacle or parked)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X position (cell origin)
   * @param {number} y - Y position
   * @param {number} scale - Scale factor (default 1.0)
   * @param {number} opacity - Opacity (0-1, default 1.0)
   */
  car: (ctx, x, y, scale = 1.0, opacity = 1.0) => {
    if (opacity === 0) return; // Skip if fully transparent

    const cellWidth = 80;
    const cellHeight = 80;
    const scaledWidth = 50 * scale;
    const scaledHeight = 50 * scale;

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
