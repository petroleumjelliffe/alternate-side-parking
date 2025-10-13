import React, { useState, useEffect, useRef, useCallback } from "react";

const ParkingGame = () => {
  // Grid configuration
  const GRID = {
    cellWidth: 80,
    cellHeight: 80,
    cols: 8,
    visibleRows: 8,
    COL_LEFT_SIDEWALK: 0,
    COL_LEFT_PARKING: 1,
    COL_LANE_0: 2,
    COL_LANE_1: 3,
    COL_LANE_2: 4,
    COL_LANE_3: 5,
    COL_RIGHT_PARKING: 6,
    COL_RIGHT_SIDEWALK: 7,
    PLAYER_VISUAL_ROW: 5,
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
    { parkingSide: 'left', numSpots: 3, description: 'Park on the LEFT side' },
    { parkingSide: 'right', numSpots: 2, description: 'Park on the RIGHT side' },
    { parkingSide: 'both', numSpots: 3, description: 'Park on EITHER side' },
    { parkingSide: 'left', numSpots: 2, description: 'Park on the LEFT side' },
    { parkingSide: 'right', numSpots: 1, description: 'Find the ONE spot on the RIGHT' },
  ];

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

  // Helper function to get level config (no dependencies, stable reference)
  const getLevelConfig = useCallback((level) => {
    return LEVEL_CONFIGS[(level - 1) % LEVEL_CONFIGS.length];
  }, []);

  // Generate level
  const generateLevel = useCallback((level) => {
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
      const side = Math.random() < 0.5 ? 'left' : 'right';

      if (side === 'left') {
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
      .filter(idx => rows[idx].leftParking === "car");
    const eligibleRightRows = rows
      .map((row, idx) => idx)
      .filter(idx => rows[idx].rightParking === "car");

    let spotsPlaced = 0;
    while (spotsPlaced < config.numSpots) {
      if (config.parkingSide === 'left' || (config.parkingSide === 'both' && Math.random() < 0.5)) {
        if (eligibleLeftRows.length > 0) {
          const randomIndex = Math.floor(Math.random() * eligibleLeftRows.length);
          const rowIndex = eligibleLeftRows[randomIndex];
          rows[rowIndex].leftParking = "spot";
          eligibleLeftRows.splice(randomIndex, 1);
          spotsPlaced++;
        }
      } else {
        if (eligibleRightRows.length > 0) {
          const randomIndex = Math.floor(Math.random() * eligibleRightRows.length);
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
  }, [LEVEL_LENGTH, getLevelConfig]);

  // Initialize game
  useEffect(() => {
    setGameState((prev) => ({
      ...prev,
      streetData: generateLevel(1),
    }));
  }, [generateLevel]);

  // Sprite rendering functions
  const sprites = {
    playerCar: (ctx, x, y) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(x + 10, y + 10, 60, 60);
      ctx.fillStyle = "#9CA089";
      ctx.fillRect(x + 20, y + 20, 40, 20);
      // Speed indicator
      ctx.fillStyle = "#000";
      ctx.font = "bold 16px monospace";
      ctx.fillText(SPEEDS[gameState.currentSpeed].name, x + 32, y + 55);
    },
    car: (ctx, x, y) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(x + 15, y + 15, 50, 50);
    },
    spot: (ctx, x, y) => {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x + 10, y + 10, 60, 60);
      ctx.setLineDash([]);
    },
    obstacle: (ctx, x, y) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(x + 25, y + 25, 30, 30);
    },
    hydrant: (ctx, x, y) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(x + 30, y + 35, 20, 20);
      ctx.fillRect(x + 35, y + 30, 10, 30);
    },
    crash: (ctx, x, y) => {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x + 20, y + 20);
      ctx.lineTo(x + 60, y + 60);
      ctx.moveTo(x + 60, y + 20);
      ctx.lineTo(x + 20, y + 60);
      ctx.stroke();
    },
  };

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

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

    // Draw grid lines
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    for (let col = 0; col <= GRID.cols; col++) {
      ctx.beginPath();
      ctx.moveTo(col * GRID.cellWidth, UI_HEIGHT);
      ctx.lineTo(col * GRID.cellWidth, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let row = 0; row <= GRID.visibleRows; row++) {
      ctx.beginPath();
      ctx.moveTo(0, UI_HEIGHT + row * GRID.cellHeight);
      ctx.lineTo(CANVAS_WIDTH, UI_HEIGHT + row * GRID.cellHeight);
      ctx.stroke();
    }

    // Get visible rows - higher row numbers at top, lower at bottom
    // Player is at PLAYER_VISUAL_ROW (5), so we show rows ahead and behind
    const startRow = gameState.worldRow + GRID.PLAYER_VISUAL_ROW;
    const endRow = gameState.worldRow - (GRID.visibleRows - GRID.PLAYER_VISUAL_ROW);

    // Render street objects (from top to bottom = high row to low row)
    for (let worldRowIndex = startRow; worldRowIndex >= endRow; worldRowIndex--) {
      const row = gameState.streetData[worldRowIndex];
      if (!row) continue;

      const visualIndex = startRow - worldRowIndex;
      const y = UI_HEIGHT + visualIndex * GRID.cellHeight;

      // Render sidewalk objects
      if (row.leftSidewalk === "hydrant") {
        sprites.hydrant(ctx, GRID.COL_LEFT_SIDEWALK * GRID.cellWidth, y);
      } else if (row.leftSidewalk === "obstacle") {
        sprites.obstacle(ctx, GRID.COL_LEFT_SIDEWALK * GRID.cellWidth, y);
      }
      if (row.rightSidewalk === "hydrant") {
        sprites.hydrant(ctx, GRID.COL_RIGHT_SIDEWALK * GRID.cellWidth, y);
      } else if (row.rightSidewalk === "obstacle") {
        sprites.obstacle(ctx, GRID.COL_RIGHT_SIDEWALK * GRID.cellWidth, y);
      }

      // Render parking
      if (row.leftParking === "car") {
        sprites.car(ctx, GRID.COL_LEFT_PARKING * GRID.cellWidth, y);
      } else if (row.leftParking === "spot") {
        sprites.spot(ctx, GRID.COL_LEFT_PARKING * GRID.cellWidth, y);
      }

      if (row.rightParking === "car") {
        sprites.car(ctx, GRID.COL_RIGHT_PARKING * GRID.cellWidth, y);
      } else if (row.rightParking === "spot") {
        sprites.spot(ctx, GRID.COL_RIGHT_PARKING * GRID.cellWidth, y);
      }

      // Render lane objects
      row.lanes.forEach((lane, laneIndex) => {
        if (lane === "car") {
          sprites.car(ctx, (GRID.COL_LANE_0 + laneIndex) * GRID.cellWidth, y);
        } else if (lane === "obstacle") {
          sprites.obstacle(
            ctx,
            (GRID.COL_LANE_0 + laneIndex) * GRID.cellWidth,
            y
          );
        }
      });
    }

    // Render player
    let playerX;
    if (gameState.playerLane === -1) {
      // In left parking column
      playerX = GRID.COL_LEFT_PARKING * GRID.cellWidth;
    } else if (gameState.playerLane === 4) {
      // In right parking column
      playerX = GRID.COL_RIGHT_PARKING * GRID.cellWidth;
    } else {
      // In driving lanes (0-3)
      playerX = (GRID.COL_LANE_0 + gameState.playerLane) * GRID.cellWidth;
    }
    const playerY = UI_HEIGHT + GRID.PLAYER_VISUAL_ROW * GRID.cellHeight;
    sprites.playerCar(ctx, playerX, playerY);

    // Render game state overlays
    if (gameState.status === "READY") {
      // Semi-transparent overlay
      ctx.fillStyle = "rgba(156, 160, 137, 0.9)";
      ctx.fillRect(0, UI_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - UI_HEIGHT);

      const levelConfig = getLevelConfig(gameState.level);
      ctx.fillStyle = "#000";
      ctx.font = "bold 48px monospace";
      ctx.fillText(`LEVEL ${gameState.level}`, CANVAS_WIDTH / 2 - 120, CANVAS_HEIGHT / 2 - 80);

      ctx.font = "bold 24px monospace";
      ctx.fillText(levelConfig.description, CANVAS_WIDTH / 2 - 150, CANVAS_HEIGHT / 2 - 20);

      ctx.font = "bold 20px monospace";
      ctx.fillText(`${levelConfig.numSpots} spot${levelConfig.numSpots > 1 ? 's' : ''} available`,
        CANVAS_WIDTH / 2 - 120, CANVAS_HEIGHT / 2 + 20);
    } else if (gameState.status === "CRASH") {
      sprites.crash(ctx, playerX, playerY);

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
      ctx.fillText("TIME'S UP!", CANVAS_WIDTH / 2 - 120, CANVAS_HEIGHT / 2 - 40);
    } else if (gameState.status === "SUCCESS") {
      ctx.fillStyle = "rgba(156, 160, 137, 0.9)";
      ctx.fillRect(0, UI_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - UI_HEIGHT);

      ctx.fillStyle = "#000";
      ctx.font = "bold 48px monospace";
      ctx.fillText("SUCCESS!", CANVAS_WIDTH / 2 - 120, CANVAS_HEIGHT / 2 - 80);

      ctx.font = "bold 24px monospace";
      ctx.fillText(`+${gameState.score} points`, CANVAS_WIDTH / 2 - 100, CANVAS_HEIGHT / 2 - 20);
      ctx.fillText(`Total: ${gameState.totalScore}`, CANVAS_WIDTH / 2 - 90, CANVAS_HEIGHT / 2 + 20);
    } else if (gameState.status === "GAME_OVER") {
      ctx.fillStyle = "rgba(156, 160, 137, 0.9)";
      ctx.fillRect(0, UI_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - UI_HEIGHT);

      ctx.fillStyle = "#000";
      ctx.font = "bold 48px monospace";
      ctx.fillText("GAME OVER", CANVAS_WIDTH / 2 - 140, CANVAS_HEIGHT / 2 - 80);

      ctx.font = "bold 24px monospace";
      ctx.fillText(`Level ${gameState.level} reached`, CANVAS_WIDTH / 2 - 120, CANVAS_HEIGHT / 2 - 20);
      ctx.fillText(`Final Score: ${gameState.totalScore}`, CANVAS_WIDTH / 2 - 130, CANVAS_HEIGHT / 2 + 20);
    }

    // Controls (only show when playing)
    if (gameState.status === "PLAYING") {
      ctx.fillStyle = "#000";
      ctx.font = "bold 12px monospace";
      ctx.fillText("↑↓ SPEED  ←→ LANE/PARK", 20, CANVAS_HEIGHT - 10);
    }
  }, [gameState, GRID, CANVAS_WIDTH, CANVAS_HEIGHT, UI_HEIGHT, SPEEDS, getLevelConfig]);

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

          // Check bounds
          if (newState.worldRow < 0) newState.worldRow = 0;
          if (newState.worldRow >= prev.streetData.length) {
            newState.status = "SUCCESS";
            return newState;
          }

          // Check collision after movement
          const currentRow = prev.streetData[newState.worldRow];
          if (currentRow && currentRow.lanes[prev.playerLane] === "car") {
            newState.status = "CRASH";
            return newState;
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
      // Prevent default behavior for arrow keys and Enter
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) {
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
        } else if (gameState.status === "CRASH" || gameState.status === "TIMEOUT") {
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
            } else if (prev.currentSpeed === "REVERSE" && prev.playerLane === 0) {
              // Move into left parking column (lane -1)
              newState.playerLane = -1;
              const currentRow = prev.streetData[prev.worldRow];
              if (currentRow && currentRow.leftParking === "car") {
                newState.status = "CRASH";
              }
            }
            break;

          case "ArrowRight":
            // Lane change or move into parking
            if (prev.currentSpeed === "PARKED") break; // Can't move while parked

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
            } else if (prev.currentSpeed === "REVERSE" && prev.playerLane === 3) {
              // Move into right parking column (lane 4)
              newState.playerLane = 4;
              const currentRow = prev.streetData[prev.worldRow];
              if (currentRow && currentRow.rightParking === "car") {
                newState.status = "CRASH";
              }
            }
            break;
        }

        return newState;
      });
    },
    [gameState.status, SPEED_ORDER, generateLevel]
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

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    if (gameState.status !== "PLAYING") return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    // Detect horizontal swipe (left/right)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        // Swipe right
        handleKeyDown({ key: "ArrowRight", preventDefault: () => {} });
      } else {
        // Swipe left
        handleKeyDown({ key: "ArrowLeft", preventDefault: () => {} });
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }, [gameState.status, handleKeyDown]);

  // Button handlers
  const handleSpeedUp = useCallback(() => {
    handleKeyDown({ key: "ArrowUp", preventDefault: () => {} });
  }, [handleKeyDown]);

  const handleSpeedDown = useCallback(() => {
    handleKeyDown({ key: "ArrowDown", preventDefault: () => {} });
  }, [handleKeyDown]);

  const handleEnterButton = useCallback(() => {
    handleKeyDown({ key: "Enter", preventDefault: () => {} });
  }, [handleKeyDown]);

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
          {(gameState.status === "CRASH" || gameState.status === "TIMEOUT") && "RETRY"}
          {gameState.status === "GAME_OVER" && "RESTART GAME"}
        </button>
      )}

      {/* On-screen controls for mobile during gameplay */}
      {gameState.status === "PLAYING" && (
        <div style={{ display: "flex", gap: "15px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          {/* Speed controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              style={controlButtonStyle}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleSpeedUp();
              }}
              onClick={handleSpeedUp}
            >
              ↑
            </button>
            <button
              style={controlButtonStyle}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleSpeedDown();
              }}
              onClick={handleSpeedDown}
            >
              ↓
            </button>
          </div>

          {/* Swipe instruction */}
          <div style={{ color: "#A8AA94", fontSize: "12px", maxWidth: "150px", textAlign: "center" }}>
            Swipe left/right on canvas to steer
          </div>
        </div>
      )}
    </div>
  );
};

export default ParkingGame;
