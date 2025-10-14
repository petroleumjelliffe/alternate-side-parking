import React, { useState, useEffect, useRef, useCallback } from "react";
import sprites from "./sprites";

const ParkingGame = () => {
  // Flicker configuration - EDIT THIS VALUE
  const FLICKER_DURATION_MS = 100; // Milliseconds sprites are 0% opaque at redraw

  // Grid configuration
  const GRID = {
    cellWidth: 80,
    cellHeight: 80,
    cols: 8,
    visibleRows: 5, // Reduced for perspective view
    COL_LEFT_SIDEWALK: 0,
    COL_LEFT_PARKING: 1,
    COL_LANE_0: 2,
    COL_LANE_1: 3,
    COL_LANE_2: 4,
    COL_LANE_3: 5,
    COL_RIGHT_PARKING: 6,
    COL_RIGHT_SIDEWALK: 7,
    PLAYER_VISUAL_ROW: 3, // Player near bottom for perspective
  };

  const UI_HEIGHT = 60;
  const CANVAS_WIDTH = GRID.cellWidth * GRID.cols;
  const CANVAS_HEIGHT = GRID.cellHeight * GRID.visibleRows + UI_HEIGHT;
  const LEVEL_LENGTH = 100; // Number of rows per level

  // Speed configurations
  const SPEEDS = {
    REVERSE: { name: "R", tickInterval: 60, direction: -1 },
    PARKED: { name: "P", tickInterval: 0, direction: 0 },
    DRIVE: { name: "D", tickInterval: 30, direction: 1 },
    FAST: { name: "F", tickInterval: 15, direction: 1 },
  };
  const SPEED_ORDER = ["REVERSE", "PARKED", "DRIVE", "FAST"];

  // Level configurations (defined once, outside of any dependency tracking)
  const LEVEL_CONFIGS = [
    { parkingSide: "left", numSpots: 3, description: "Park on the LEFT side" },
    {
      parkingSide: "right",
      numSpots: 2,
      description: "Park on the RIGHT side",
    },
    { parkingSide: "both", numSpots: 3, description: "Park on EITHER side" },
    { parkingSide: "left", numSpots: 2, description: "Park on the LEFT side" },
    {
      parkingSide: "right",
      numSpots: 1,
      description: "Find the ONE spot on the RIGHT",
    },
  ];

  // Debug menu state
  const [debugMode, setDebugMode] = useState(false);
  const [debugValues, setDebugValues] = useState({
    minScale: 0.1,
    maxScale: 1.0,
    yScaleFactor: 1.0,  // How much Y spacing scales with distance
    reverseFlipsSteering: false,  // Whether steering is flipped in reverse
  });

  // Game states: READY, PLAYING, SUCCESS, GAME_OVER
  const [gameState, setGameState] = useState({
    level: 1,
    lives: 3,
    score: 0,
    totalScore: 0,
    time: 60,
    currentSpeed: "DRIVE",
    playerLane: 2,
    worldRow: 1, // Start at row 1 (beginning of block)
    tickCounter: 0,
    status: "READY", // State machine: READY -> PLAYING -> SUCCESS/GAME_OVER
    streetData: [],
  });

  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastFrameRef = useRef(0);
  const keysPressed = useRef(new Set());
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const lastMovementTime = useRef(0); // Track when sprites last moved for flicker

  // Helper function to get level config (no dependencies, stable reference)
  const getLevelConfig = useCallback((level) => {
    return LEVEL_CONFIGS[(level - 1) % LEVEL_CONFIGS.length];
  }, []);

  // Generate level
  const generateLevel = useCallback(
    (level) => {
      const rows = [];
      const totalRows = LEVEL_LENGTH;

      const config = getLevelConfig(level);

      // Step 1: Initialize all rows with cars in parking lanes
      for (let i = 0; i < totalRows; i++) {
        const row = {
          index: i,
          leftSidewalk: null,
          leftParking: "car",
          lanes: [
            Math.random() > 0.9 ? "car" : null,
            Math.random() > 0.9 ? "car" : null,
            Math.random() > 0.9 ? "car" : null,
            Math.random() > 0.9 ? "car" : null,
          ],
          rightParking: "car",
          rightSidewalk: null,
        };
        rows.push(row);
      }

      // Step 2: Place 2 fire hydrants
      for (let h = 0; h < 2; h++) {
        const hydrantRow = Math.floor(Math.random() * totalRows);
        const side = Math.random() < 0.5 ? "left" : "right";

        if (side === "left") {
          rows[hydrantRow].leftSidewalk = "hydrant";
          rows[hydrantRow].leftParking = null; // Remove parked car
        } else {
          rows[hydrantRow].rightSidewalk = "hydrant";
          rows[hydrantRow].rightParking = null; // Remove parked car
        }
      }

      // Step 3: Seed parking spots based on level config
      const eligibleLeftRows = rows
        .map((row, idx) => idx)
        .filter((idx) => rows[idx].leftParking === "car");
      const eligibleRightRows = rows
        .map((row, idx) => idx)
        .filter((idx) => rows[idx].rightParking === "car");

      let spotsPlaced = 0;
      while (spotsPlaced < config.numSpots) {
        if (
          config.parkingSide === "left" ||
          (config.parkingSide === "both" && Math.random() < 0.5)
        ) {
          if (eligibleLeftRows.length > 0) {
            const randomIndex = Math.floor(
              Math.random() * eligibleLeftRows.length
            );
            const rowIndex = eligibleLeftRows[randomIndex];
            rows[rowIndex].leftParking = "spot";
            eligibleLeftRows.splice(randomIndex, 1);
            spotsPlaced++;
          }
        } else {
          if (eligibleRightRows.length > 0) {
            const randomIndex = Math.floor(
              Math.random() * eligibleRightRows.length
            );
            const rowIndex = eligibleRightRows[randomIndex];
            rows[rowIndex].rightParking = "spot";
            eligibleRightRows.splice(randomIndex, 1);
            spotsPlaced++;
          }
        }

        // Safety check to prevent infinite loop
        if (eligibleLeftRows.length === 0 && eligibleRightRows.length === 0) {
          break;
        }
      }

      return rows;
    },
    [LEVEL_LENGTH, getLevelConfig]
  );

  // Initialize game
  useEffect(() => {
    setGameState((prev) => ({
      ...prev,
      streetData: generateLevel(1),
    }));
  }, [generateLevel]);

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Calculate sprite opacity for flicker effect
    const now = performance.now();
    const timeSinceMovement = now - lastMovementTime.current;
    const spriteOpacity = timeSinceMovement < FLICKER_DURATION_MS ? 0 : 1;

    // Clear screen
    ctx.fillStyle = "#9CA089";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Render UI
    ctx.fillStyle = "#A8AA94";
    ctx.fillRect(0, 0, CANVAS_WIDTH, UI_HEIGHT);
    ctx.fillStyle = "#000";
    ctx.font = "bold 18px monospace";
    ctx.fillText(`LVL: ${gameState.level}`, 20, 35);
    ctx.fillText(`LIVES: ${gameState.lives}`, 120, 35);
    ctx.fillText(`TIME: ${Math.ceil(gameState.time)}`, 250, 35);
    ctx.fillText(`SPEED: ${SPEEDS[gameState.currentSpeed].name}`, 360, 35);
    ctx.fillText(`SCORE: ${gameState.totalScore}`, 480, 35);

    // Get visible rows - for 1-point perspective, render furthest rows first
    const startRow = gameState.worldRow + GRID.PLAYER_VISUAL_ROW;
    const endRow =
      gameState.worldRow - (GRID.visibleRows - GRID.PLAYER_VISUAL_ROW);
    const screenCenterX = CANVAS_WIDTH / 2;
    const screenCenterY = UI_HEIGHT + (CANVAS_HEIGHT - UI_HEIGHT) / 2;

    // Helper function to calculate perspective X position
    const getPerspectiveX = (colIndex, scale) => {
      // Calculate base X position (center of cell)
      const baseX = colIndex * GRID.cellWidth + GRID.cellWidth / 2;
      // Calculate offset from center
      const offsetFromCenter = baseX - screenCenterX;
      // Scale the offset and add back to center
      return screenCenterX + (offsetFromCenter * scale) - GRID.cellWidth / 2;
    };

    // Helper function to calculate perspective Y position
    const getPerspectiveY = (visualIndex, scale) => {
      const baseY = UI_HEIGHT + visualIndex * GRID.cellHeight;
      // Apply Y scaling: rows converge toward center as they get further
      const offsetFromCenter = baseY - screenCenterY;
      const scaledOffset = offsetFromCenter * (1 - (1 - scale) * debugValues.yScaleFactor);
      return screenCenterY + scaledOffset;
    };

    // Render street objects (1-point perspective: furthest first, closest last)
    // This creates depth by drawing far rows first, then overlaying closer ones
    for (
      let worldRowIndex = startRow;
      worldRowIndex >= endRow;
      worldRowIndex--
    ) {
      const row = gameState.streetData[worldRowIndex];
      if (!row) continue;

      const visualIndex = startRow - worldRowIndex;

      // Calculate scale factor for perspective (0 = furthest, visibleRows-1 = closest)
      // Furthest rows are smaller, closest rows are larger
      const distanceFromPlayer = -(visualIndex - GRID.PLAYER_VISUAL_ROW);
      const maxDistance = GRID.visibleRows - 1;
      // Invert: 0 distance = scale 1.0, max distance = MIN_SCALE
      const scale =
        debugValues.maxScale -
        (distanceFromPlayer / maxDistance) *
          (debugValues.maxScale - debugValues.minScale);

      const y = getPerspectiveY(visualIndex, scale);

      // Render sidewalk objects
      if (row.leftSidewalk === "hydrant") {
        sprites.hydrant(ctx, getPerspectiveX(GRID.COL_LEFT_SIDEWALK, scale), y, scale, spriteOpacity);
      } else if (row.leftSidewalk === "obstacle") {
        sprites.obstacle(
          ctx,
          getPerspectiveX(GRID.COL_LEFT_SIDEWALK, scale),
          y,
          scale,
          spriteOpacity
        );
      }
      if (row.rightSidewalk === "hydrant") {
        sprites.hydrant(
          ctx,
          getPerspectiveX(GRID.COL_RIGHT_SIDEWALK, scale),
          y,
          scale,
          spriteOpacity
        );
      } else if (row.rightSidewalk === "obstacle") {
        sprites.obstacle(
          ctx,
          getPerspectiveX(GRID.COL_RIGHT_SIDEWALK, scale),
          y,
          scale,
          spriteOpacity
        );
      }

      // Render parking
      if (row.leftParking === "car") {
        sprites.car(ctx, getPerspectiveX(GRID.COL_LEFT_PARKING, scale), y, scale, spriteOpacity);
      } else if (row.leftParking === "spot") {
        sprites.spot(ctx, getPerspectiveX(GRID.COL_LEFT_PARKING, scale), y, scale, spriteOpacity);
      }

      if (row.rightParking === "car") {
        sprites.car(ctx, getPerspectiveX(GRID.COL_RIGHT_PARKING, scale), y, scale, spriteOpacity);
      } else if (row.rightParking === "spot") {
        sprites.spot(ctx, getPerspectiveX(GRID.COL_RIGHT_PARKING, scale), y, scale, spriteOpacity);
      }

      // Render lane objects
      row.lanes.forEach((lane, laneIndex) => {
        if (lane === "car") {
          sprites.car(
            ctx,
            getPerspectiveX(GRID.COL_LANE_0 + laneIndex, scale),
            y,
            scale,
            spriteOpacity
          );
        } else if (lane === "obstacle") {
          sprites.obstacle(
            ctx,
            getPerspectiveX(GRID.COL_LANE_0 + laneIndex, scale),
            y,
            scale,
            spriteOpacity
          );
        }
      });
    }

    // Render player (always at full scale since it's at player row)
    let playerCol;
    if (gameState.playerLane === -1) {
      // In left parking column
      playerCol = GRID.COL_LEFT_PARKING;
    } else if (gameState.playerLane === 4) {
      // In right parking column
      playerCol = GRID.COL_RIGHT_PARKING;
    } else {
      // In driving lanes (0-3)
      playerCol = GRID.COL_LANE_0 + gameState.playerLane;
    }
    const playerX = getPerspectiveX(playerCol, 1.0);
    const playerY = getPerspectiveY(GRID.PLAYER_VISUAL_ROW, 1.0);
    sprites.playerCar(
      ctx,
      playerX,
      playerY,
      SPEEDS[gameState.currentSpeed].name,
      1.0,
      spriteOpacity
    );

    // Render game state overlays
    if (gameState.status === "READY") {
      // Semi-transparent overlay
      ctx.fillStyle = "rgba(156, 160, 137, 0.9)";
      ctx.fillRect(0, UI_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - UI_HEIGHT);

      const levelConfig = getLevelConfig(gameState.level);
      ctx.fillStyle = "#000";
      ctx.font = "bold 48px monospace";
      ctx.fillText(
        `LEVEL ${gameState.level}`,
        CANVAS_WIDTH / 2 - 120,
        CANVAS_HEIGHT / 2 - 80
      );

      ctx.font = "bold 24px monospace";
      ctx.fillText(
        levelConfig.description,
        CANVAS_WIDTH / 2 - 150,
        CANVAS_HEIGHT / 2 - 20
      );

      ctx.font = "bold 20px monospace";
      ctx.fillText(
        `${levelConfig.numSpots} spot${
          levelConfig.numSpots > 1 ? "s" : ""
        } available`,
        CANVAS_WIDTH / 2 - 120,
        CANVAS_HEIGHT / 2 + 20
      );
    } else if (gameState.status === "CRASH") {
      sprites.crash(ctx, playerX, playerY, 1.0, spriteOpacity);

      ctx.fillStyle = "rgba(156, 160, 137, 0.8)";
      ctx.fillRect(0, UI_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - UI_HEIGHT);

      ctx.fillStyle = "#000";
      ctx.font = "bold 48px monospace";
      ctx.fillText("CRASH!", CANVAS_WIDTH / 2 - 90, CANVAS_HEIGHT / 2 - 40);
    } else if (gameState.status === "TIMEOUT") {
      ctx.fillStyle = "rgba(156, 160, 137, 0.8)";
      ctx.fillRect(0, UI_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - UI_HEIGHT);

      ctx.fillStyle = "#000";
      ctx.font = "bold 48px monospace";
      ctx.fillText(
        "TIME'S UP!",
        CANVAS_WIDTH / 2 - 120,
        CANVAS_HEIGHT / 2 - 40
      );
    } else if (gameState.status === "SUCCESS") {
      ctx.fillStyle = "rgba(156, 160, 137, 0.9)";
      ctx.fillRect(0, UI_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - UI_HEIGHT);

      ctx.fillStyle = "#000";
      ctx.font = "bold 48px monospace";
      ctx.fillText("SUCCESS!", CANVAS_WIDTH / 2 - 120, CANVAS_HEIGHT / 2 - 80);

      ctx.font = "bold 24px monospace";
      ctx.fillText(
        `+${gameState.score} points`,
        CANVAS_WIDTH / 2 - 100,
        CANVAS_HEIGHT / 2 - 20
      );
      ctx.fillText(
        `Total: ${gameState.totalScore}`,
        CANVAS_WIDTH / 2 - 90,
        CANVAS_HEIGHT / 2 + 20
      );
    } else if (gameState.status === "GAME_OVER") {
      ctx.fillStyle = "rgba(156, 160, 137, 0.9)";
      ctx.fillRect(0, UI_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - UI_HEIGHT);

      ctx.fillStyle = "#000";
      ctx.font = "bold 48px monospace";
      ctx.fillText("GAME OVER", CANVAS_WIDTH / 2 - 140, CANVAS_HEIGHT / 2 - 80);

      ctx.font = "bold 24px monospace";
      ctx.fillText(
        `Level ${gameState.level} reached`,
        CANVAS_WIDTH / 2 - 120,
        CANVAS_HEIGHT / 2 - 20
      );
      ctx.fillText(
        `Final Score: ${gameState.totalScore}`,
        CANVAS_WIDTH / 2 - 130,
        CANVAS_HEIGHT / 2 + 20
      );
    }

    // Controls (only show when playing)
    if (gameState.status === "PLAYING") {
      ctx.fillStyle = "#000";
      ctx.font = "bold 12px monospace";
      ctx.fillText("↑↓ SPEED  ←→ LANE/PARK  D=DEBUG", 20, CANVAS_HEIGHT - 10);
    }

    // Debug menu overlay
    if (debugMode) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(10, UI_HEIGHT + 10, 320, 170);

      ctx.fillStyle = "#FFF";
      ctx.font = "bold 16px monospace";
      ctx.fillText("DEBUG MENU (D to close)", 20, UI_HEIGHT + 30);

      ctx.font = "14px monospace";
      ctx.fillText(`Min Scale: ${debugValues.minScale.toFixed(2)}`, 20, UI_HEIGHT + 55);
      ctx.fillText(`[-/=] keys`, 200, UI_HEIGHT + 55);

      ctx.fillText(`Max Scale: ${debugValues.maxScale.toFixed(2)}`, 20, UI_HEIGHT + 80);
      ctx.fillText(`[,/.] keys`, 200, UI_HEIGHT + 80);

      ctx.fillText(`Y Factor: ${debugValues.yScaleFactor.toFixed(2)}`, 20, UI_HEIGHT + 105);
      ctx.fillText(`[;/'] keys`, 200, UI_HEIGHT + 105);

      ctx.fillText(`Reverse Flips: ${debugValues.reverseFlipsSteering ? 'ON' : 'OFF'}`, 20, UI_HEIGHT + 130);
      ctx.fillText(`[F] key`, 200, UI_HEIGHT + 130);

      ctx.font = "12px monospace";
      ctx.fillText("Press R to reset", 20, UI_HEIGHT + 155);
    }
  }, [
    gameState,
    GRID,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    UI_HEIGHT,
    SPEEDS,
    getLevelConfig,
    debugMode,
    debugValues,
    FLICKER_DURATION_MS,
  ]);

  // Game update
  const update = useCallback(
    (deltaTime) => {
      if (gameState.status !== "PLAYING") return;

      setGameState((prev) => {
        let newState = { ...prev };

        // Update timer
        newState.time = Math.max(0, prev.time - deltaTime / 1000);
        if (newState.time <= 0) {
          newState.status = "TIMEOUT";
          return newState;
        }

        // Update tick counter
        newState.tickCounter = prev.tickCounter + 1;

        // Update movement based on speed
        const speed = SPEEDS[prev.currentSpeed];
        if (
          speed.tickInterval > 0 &&
          newState.tickCounter % speed.tickInterval === 0
        ) {
          newState.worldRow = prev.worldRow + speed.direction;

          // Trigger flicker effect
          lastMovementTime.current = performance.now();

          // Check bounds
          if (newState.worldRow < 0) newState.worldRow = 0;
          if (newState.worldRow >= prev.streetData.length) {
            newState.status = "SUCCESS";
            return newState;
          }

          // Check collision after movement
          const currentRow = prev.streetData[newState.worldRow];
          if (currentRow) {
            // Check collision based on current lane
            if (prev.playerLane === -1) {
              // In left parking column
              if (currentRow.leftParking === "car") {
                newState.status = "CRASH";
                return newState;
              }
            } else if (prev.playerLane === 4) {
              // In right parking column
              if (currentRow.rightParking === "car") {
                newState.status = "CRASH";
                return newState;
              }
            } else {
              // In driving lanes (0-3)
              if (currentRow.lanes[prev.playerLane] === "car") {
                newState.status = "CRASH";
                return newState;
              }
            }
          }
        }

        return newState;
      });
    },
    [gameState.status, SPEEDS]
  );

  // Handle input
  const handleKeyDown = useCallback(
    (e) => {
      // Debug menu toggle
      if (e.key === "d" || e.key === "D") {
        setDebugMode(prev => !prev);
        return;
      }

      // Debug value adjustments
      if (debugMode) {
        const step = 0.05;
        if (e.key === "-") {
          setDebugValues(prev => ({ ...prev, minScale: Math.max(0, prev.minScale - step) }));
          return;
        } else if (e.key === "=") {
          setDebugValues(prev => ({ ...prev, minScale: Math.min(1, prev.minScale + step) }));
          return;
        } else if (e.key === ",") {
          setDebugValues(prev => ({ ...prev, maxScale: Math.max(0.1, prev.maxScale - step) }));
          return;
        } else if (e.key === ".") {
          setDebugValues(prev => ({ ...prev, maxScale: Math.min(2, prev.maxScale + step) }));
          return;
        } else if (e.key === ";") {
          setDebugValues(prev => ({ ...prev, yScaleFactor: Math.max(0, prev.yScaleFactor - step) }));
          return;
        } else if (e.key === "'") {
          setDebugValues(prev => ({ ...prev, yScaleFactor: Math.min(1, prev.yScaleFactor + step) }));
          return;
        } else if (e.key === "f" || e.key === "F") {
          setDebugValues(prev => ({ ...prev, reverseFlipsSteering: !prev.reverseFlipsSteering }));
          return;
        } else if (e.key === "r" || e.key === "R") {
          setDebugValues({ minScale: 0.3, maxScale: 1.0, yScaleFactor: 0.5, reverseFlipsSteering: false });
          return;
        }
      }

      // Prevent default behavior for arrow keys and Enter
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(
          e.key
        )
      ) {
        e.preventDefault();
      }

      // Handle state transitions
      if (e.key === "Enter") {
        if (gameState.status === "READY") {
          // Start level
          setGameState((prev) => ({
            ...prev,
            status: "PLAYING",
            currentSpeed: "DRIVE",
            playerLane: 2,
            worldRow: 1,
            tickCounter: 0,
            time: 60,
          }));
          return;
        } else if (gameState.status === "SUCCESS") {
          // Advance to next level
          setGameState((prev) => ({
            ...prev,
            level: prev.level + 1,
            score: 0,
            totalScore: prev.totalScore + prev.score,
            status: "READY",
            streetData: generateLevel(prev.level + 1),
          }));
          return;
        } else if (
          gameState.status === "CRASH" ||
          gameState.status === "TIMEOUT"
        ) {
          // Lose a life and check if game over
          setGameState((prev) => {
            const newLives = prev.lives - 1;
            if (newLives <= 0) {
              // Game over
              return {
                ...prev,
                lives: 0,
                status: "GAME_OVER",
              };
            } else {
              // Restart current level with one less life
              return {
                ...prev,
                lives: newLives,
                status: "READY",
                streetData: generateLevel(prev.level),
              };
            }
          });
          return;
        } else if (gameState.status === "GAME_OVER") {
          // Restart entire game
          setGameState({
            level: 1,
            lives: 3,
            score: 0,
            totalScore: 0,
            time: 60,
            currentSpeed: "DRIVE",
            playerLane: 2,
            worldRow: 1,
            tickCounter: 0,
            status: "READY",
            streetData: generateLevel(1),
          });
          return;
        }
      }

      // Game controls only work when PLAYING
      if (gameState.status !== "PLAYING") return;

      if (keysPressed.current.has(e.key)) return;
      keysPressed.current.add(e.key);

      setGameState((prev) => {
        let newState = { ...prev };

        // Helper function to check parking success when shifting to PARKED
        const checkParkingSuccess = (state) => {
          if (state.currentSpeed === "PARKED") {
            const currentRow = state.streetData[state.worldRow];
            if (state.playerLane === -1) {
              // In left parking column
              if (currentRow && currentRow.leftParking === "spot") {
                state.status = "SUCCESS";
                state.score = Math.ceil(state.time) * 10;
              }
            } else if (state.playerLane === 4) {
              // In right parking column
              if (currentRow && currentRow.rightParking === "spot") {
                state.status = "SUCCESS";
                state.score = Math.ceil(state.time) * 10;
              }
            }
          }
        };

        switch (e.key) {
          case "ArrowUp":
            // Speed up
            const currentUpIndex = SPEED_ORDER.indexOf(prev.currentSpeed);
            if (currentUpIndex < SPEED_ORDER.length - 1) {
              newState.currentSpeed = SPEED_ORDER[currentUpIndex + 1];
              checkParkingSuccess(newState);
            }
            break;

          case "ArrowDown":
            // Slow down
            const currentDownIndex = SPEED_ORDER.indexOf(prev.currentSpeed);
            if (currentDownIndex > 0) {
              newState.currentSpeed = SPEED_ORDER[currentDownIndex - 1];
              checkParkingSuccess(newState);
            }
            break;

          case "ArrowLeft":
            // Lane change or move into parking
            if (prev.currentSpeed === "PARKED") break; // Can't move while parked

            // Determine direction (flip if in reverse and config enabled)
            const leftDirection =
              debugValues.reverseFlipsSteering && prev.currentSpeed === "REVERSE"
                ? 1
                : -1;

            if (leftDirection === -1) {
              // Normal left movement
              if (prev.playerLane > 0) {
                // Move left in driving lanes
                newState.playerLane = prev.playerLane - 1;
                const currentRow = prev.streetData[prev.worldRow];
                if (
                  currentRow &&
                  currentRow.lanes[newState.playerLane] === "car"
                ) {
                  newState.status = "CRASH";
                }
              } else if (
                prev.currentSpeed === "REVERSE" &&
                prev.playerLane === 0
              ) {
                // Move into left parking column (lane -1)
                newState.playerLane = -1;
                const currentRow = prev.streetData[prev.worldRow];
                if (currentRow && currentRow.leftParking === "car") {
                  newState.status = "CRASH";
                }
              }
            } else {
              // Reversed (acts like right)
              if (prev.playerLane < 3) {
                // Move right in driving lanes
                newState.playerLane = prev.playerLane + 1;
                const currentRow = prev.streetData[prev.worldRow];
                if (
                  currentRow &&
                  currentRow.lanes[newState.playerLane] === "car"
                ) {
                  newState.status = "CRASH";
                }
              } else if (
                prev.currentSpeed === "REVERSE" &&
                prev.playerLane === 3
              ) {
                // Move into right parking column (lane 4)
                newState.playerLane = 4;
                const currentRow = prev.streetData[prev.worldRow];
                if (currentRow && currentRow.rightParking === "car") {
                  newState.status = "CRASH";
                }
              }
            }
            break;

          case "ArrowRight":
            // Lane change or move into parking
            if (prev.currentSpeed === "PARKED") break; // Can't move while parked

            // Determine direction (flip if in reverse and config enabled)
            const rightDirection =
              debugValues.reverseFlipsSteering && prev.currentSpeed === "REVERSE"
                ? -1
                : 1;

            if (rightDirection === 1) {
              // Normal right movement
              if (prev.playerLane < 3) {
                // Move right in driving lanes
                newState.playerLane = prev.playerLane + 1;
                const currentRow = prev.streetData[prev.worldRow];
                if (
                  currentRow &&
                  currentRow.lanes[newState.playerLane] === "car"
                ) {
                  newState.status = "CRASH";
                }
              } else if (
                prev.currentSpeed === "REVERSE" &&
                prev.playerLane === 3
              ) {
                // Move into right parking column (lane 4)
                newState.playerLane = 4;
                const currentRow = prev.streetData[prev.worldRow];
                if (currentRow && currentRow.rightParking === "car") {
                  newState.status = "CRASH";
                }
              }
            } else {
              // Reversed (acts like left)
              if (prev.playerLane > 0) {
                // Move left in driving lanes
                newState.playerLane = prev.playerLane - 1;
                const currentRow = prev.streetData[prev.worldRow];
                if (
                  currentRow &&
                  currentRow.lanes[newState.playerLane] === "car"
                ) {
                  newState.status = "CRASH";
                }
              } else if (
                prev.currentSpeed === "REVERSE" &&
                prev.playerLane === 0
              ) {
                // Move into left parking column (lane -1)
                newState.playerLane = -1;
                const currentRow = prev.streetData[prev.worldRow];
                if (currentRow && currentRow.leftParking === "car") {
                  newState.status = "CRASH";
                }
              }
            }
            break;
        }

        return newState;
      });
    },
    [gameState.status, SPEED_ORDER, generateLevel, debugMode, debugValues]
  );

  const handleKeyUp = useCallback((e) => {
    keysPressed.current.delete(e.key);
  }, []);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      if (gameState.status !== "PLAYING") return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = touch.clientY - touchStartY.current;

      // Detect horizontal swipe (left/right)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          // Swipe right
          const event = {
            key: "ArrowRight",
            preventDefault: () => {},
            _fromButton: true,
          };
          handleKeyDown(event);
          setTimeout(() => keysPressed.current.delete("ArrowRight"), 0);
        } else {
          // Swipe left
          const event = {
            key: "ArrowLeft",
            preventDefault: () => {},
            _fromButton: true,
          };
          handleKeyDown(event);
          setTimeout(() => keysPressed.current.delete("ArrowLeft"), 0);
        }
      }

      touchStartX.current = null;
      touchStartY.current = null;
    },
    [gameState.status, handleKeyDown]
  );

  // Button handlers - using useCallback to ensure stable references
  const handleGearShift = (targetGear) => {
    // Directly set the gear instead of simulating key presses
    setGameState((prev) => {
      if (prev.status !== "PLAYING") {
        console.log("Gear shift ignored - not playing", prev.status);
        return prev;
      }

      console.log("Shifting gear from", prev.currentSpeed, "to", targetGear);
      const newState = { ...prev, currentSpeed: targetGear };

      // Check if shifting to PARKED while in a parking spot
      if (targetGear === "PARKED") {
        const currentRow = prev.streetData[prev.worldRow];
        if (prev.playerLane === -1) {
          // In left parking column
          if (currentRow && currentRow.leftParking === "spot") {
            newState.status = "SUCCESS";
            newState.score = Math.ceil(prev.time) * 10;
          }
        } else if (prev.playerLane === 4) {
          // In right parking column
          if (currentRow && currentRow.rightParking === "spot") {
            newState.status = "SUCCESS";
            newState.score = Math.ceil(prev.time) * 10;
          }
        }
      }

      return newState;
    });
  };

  const handleLaneLeft = () => {
    console.log("Lane left button pressed");
    // Create a synthetic event that won't get stuck in keysPressed
    const event = {
      key: "ArrowLeft",
      preventDefault: () => {},
      _fromButton: true,
    };
    handleKeyDown(event);
    // Immediately remove from keysPressed since it's a button click
    setTimeout(() => keysPressed.current.delete("ArrowLeft"), 0);
  };

  const handleLaneRight = () => {
    console.log("Lane right button pressed");
    const event = {
      key: "ArrowRight",
      preventDefault: () => {},
      _fromButton: true,
    };
    handleKeyDown(event);
    setTimeout(() => keysPressed.current.delete("ArrowRight"), 0);
  };

  const handleEnterButton = () => {
    console.log("Enter button pressed, current status:", gameState.status);
    const event = { key: "Enter", preventDefault: () => {}, _fromButton: true };
    handleKeyDown(event);
    setTimeout(() => keysPressed.current.delete("Enter"), 0);
  };

  // Game loop
  useEffect(() => {
    const FPS = 60;
    const frameInterval = 1000 / FPS;

    const gameLoop = (timestamp) => {
      const deltaTime = timestamp - lastFrameRef.current;

      if (deltaTime >= frameInterval) {
        update(deltaTime);
        render();
        lastFrameRef.current = timestamp;
      }

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [update, render]);

  // Event listeners
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Button styles
  const buttonStyle = {
    padding: "15px 30px",
    fontSize: "18px",
    fontWeight: "bold",
    fontFamily: "monospace",
    border: "3px solid #000",
    borderRadius: "10px",
    background: "#A8AA94",
    color: "#000",
    cursor: "pointer",
    touchAction: "manipulation",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
  };

  const controlButtonStyle = {
    width: "60px",
    height: "60px",
    fontSize: "24px",
    fontWeight: "bold",
    fontFamily: "monospace",
    border: "3px solid #000",
    borderRadius: "10px",
    background: "#A8AA94",
    color: "#000",
    cursor: "pointer",
    touchAction: "manipulation",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "#333",
        fontFamily: "monospace",
        margin: 0,
        padding: "10px",
        boxSizing: "border-box",
        gap: "10px",
      }}
    >
      <div
        style={{
          background: "#8B8D7A",
          borderRadius: "10px",
          boxShadow: "0 5px 20px rgba(0,0,0,0.5)",
          maxWidth: "100%",
          maxHeight: "calc(100vh - 150px)",
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{
            display: "block",
            borderRadius: "10px",
            maxWidth: "100%",
            height: "auto",
            touchAction: "none",
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
      </div>

      {/* Menu button for non-playing states */}
      {gameState.status !== "PLAYING" && (
        <button
          style={buttonStyle}
          onClick={handleEnterButton}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleEnterButton();
          }}
        >
          {gameState.status === "READY" && "START LEVEL"}
          {gameState.status === "SUCCESS" && "NEXT LEVEL"}
          {(gameState.status === "CRASH" || gameState.status === "TIMEOUT") &&
            "RETRY"}
          {gameState.status === "GAME_OVER" && "RESTART GAME"}
        </button>
      )}

      {/* On-screen controls for mobile during gameplay */}
      {gameState.status === "PLAYING" && (
        <div
          style={{
            display: "flex",
            gap: "40px",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {/* Lane change buttons - LEFT SIDE */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              style={{ ...controlButtonStyle, fontSize: "28px" }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleLaneLeft();
              }}
              onClick={handleLaneLeft}
            >
              ←
            </button>
            <button
              style={{ ...controlButtonStyle, fontSize: "28px" }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleLaneRight();
              }}
              onClick={handleLaneRight}
            >
              →
            </button>
          </div>

          {/* Gear selector - RIGHT SIDE - vertical like automatic transmission */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              background: "#6B6D5A",
              padding: "10px",
              borderRadius: "15px",
              border: "3px solid #000",
            }}
          >
            {/* P at top */}
            {(() => {
              const gear = "PARKED";
              const isActive = gameState.currentSpeed === gear;
              return (
                <button
                  key={gear}
                  style={{
                    ...controlButtonStyle,
                    background: isActive ? "#FFF" : "#A8AA94",
                    color: "#000",
                    fontWeight: isActive ? "bold" : "normal",
                    border: isActive ? "3px solid #000" : "2px solid #000",
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleGearShift(gear);
                  }}
                  onClick={() => handleGearShift(gear)}
                >
                  {SPEEDS[gear].name}
                </button>
              );
            })()}

            {/* Gap */}
            <div style={{ height: "10px" }} />

            {/* D then R */}
            {["DRIVE", "REVERSE"].map((gear) => {
              const isActive = gameState.currentSpeed === gear;
              return (
                <button
                  key={gear}
                  style={{
                    ...controlButtonStyle,
                    background: isActive ? "#FFF" : "#A8AA94",
                    color: "#000",
                    fontWeight: isActive ? "bold" : "normal",
                    border: isActive ? "3px solid #000" : "2px solid #000",
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleGearShift(gear);
                  }}
                  onClick={() => handleGearShift(gear)}
                >
                  {SPEEDS[gear].name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ParkingGame;
