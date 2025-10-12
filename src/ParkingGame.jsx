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

  //state machine diagram


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

  // Game state
  const [gameState, setGameState] = useState({
    level: 1,
    score: 0,
    time: 60,
    currentSpeed: "DRIVE",
    playerLane: 2,
    worldRow: 1, // Start at row 1 (beginning of block)
    tickCounter: 0,
    status: "PLAYING",
    streetData: [],
  });

  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastFrameRef = useRef(0);
  const keysPressed = useRef(new Set());

  // Generate level
  const generateLevel = useCallback((level) => {
    const rows = [];
    const totalRows = LEVEL_LENGTH;

    // Level configuration based on difficulty
    const levelConfigs = [
      { parkingSide: 'left', numSpots: 3 },    // Level 1: easy, left side only
      { parkingSide: 'right', numSpots: 2 },   // Level 2: right side only
      { parkingSide: 'both', numSpots: 3 },    // Level 3: both sides
      { parkingSide: 'left', numSpots: 2 },    // Level 4: harder
      { parkingSide: 'right', numSpots: 1 },   // Level 5: very hard
    ];

    const config = levelConfigs[(level - 1) % levelConfigs.length];

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
  }, [LEVEL_LENGTH]);

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
    ctx.fillText(`SCORE: ${gameState.score}`, 20, 35);
    ctx.fillText(`TIME: ${Math.ceil(gameState.time)}`, 200, 35);
    ctx.fillText(`SPEED: ${SPEEDS[gameState.currentSpeed].name}`, 360, 35);
    ctx.fillText(`LEVEL: ${gameState.level}`, 540, 35);

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

    // Render crash if crashed
    if (gameState.status === "CRASH") {
      sprites.crash(ctx, playerX, playerY);
      ctx.fillStyle = "#000";
      ctx.font = "bold 36px monospace";
      ctx.fillText("CRASH!", CANVAS_WIDTH / 2 - 70, CANVAS_HEIGHT / 2);
    }

    if (gameState.status === "SUCCESS") {
      ctx.fillStyle = "#000";
      ctx.font = "bold 36px monospace";
      ctx.fillText("SUCCESS!", CANVAS_WIDTH / 2 - 90, CANVAS_HEIGHT / 2);
    }

    // Controls
    ctx.fillStyle = "#000";
    ctx.font = "bold 12px monospace";
    ctx.fillText("↑↓ SPEED  ←→ LANE/PARK", 20, CANVAS_HEIGHT - 10);
  }, [gameState, GRID, CANVAS_WIDTH, CANVAS_HEIGHT, UI_HEIGHT, SPEEDS]);

  // Collision detection
  const checkCollision = useCallback(() => {
    if (
      gameState.worldRow < 0 ||
      gameState.worldRow >= gameState.streetData.length
    ) {
      return false;
    }

    const currentRow = gameState.streetData[gameState.worldRow];
    const laneContent = currentRow.lanes[gameState.playerLane];

    return laneContent === "car" || laneContent === "obstacle";
  }, [gameState]);

  // Game update
  const update = useCallback(
    (deltaTime) => {
      if (gameState.status !== "PLAYING") return;
      console.log("Updating game state", deltaTime, gameState);

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
      if (gameState.status !== "PLAYING") {
        if (e.key === "Enter") {
          // Restart
          setGameState((prev) => ({
            ...prev,
            score: 0,
            time: 60,
            currentSpeed: "DRIVE",
            playerLane: 2,
            worldRow: 1,
            tickCounter: 0,
            status: "PLAYING",
            streetData: generateLevel(prev.level),
          }));
        }
        return;
      }

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
                state.score += 1000;
              }
            } else if (state.playerLane === 4) {
              // In right parking column
              if (currentRow && currentRow.rightParking === "spot") {
                state.status = "SUCCESS";
                state.score += 1000;
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

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#333",
        fontFamily: "monospace",
      }}
    >
      <div
        style={{
          padding: "20px",
          background: "#8B8D7A",
          borderRadius: "20px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{
            display: "block",
            borderRadius: "10px",
          }}
        />
      </div>
    </div>
  );
};

export default ParkingGame;
