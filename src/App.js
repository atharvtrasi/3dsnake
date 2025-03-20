import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import './App.css';
import { useInterval } from './hooks/useInterval';
import { generateRainbowColors } from './utils';

const GRID_SIZE = 20;
const GAME_SPEED = 150;
const BOARD_SIZE = 10; // Cube size
const GRID_COUNT = 10; // Number of grid cells on each face
const INITIAL_SNAKE = [
  { face: 'front', x: 5, y: 5 }, // Head
  { face: 'front', x: 5, y: 6 }, // Tail
];

// Face directions in 3D space - determines which way is "up" on each face
const FACE_ORIENTATIONS = {
  front: { normal: [0, 0, 1], up: [0, 1, 0], right: [1, 0, 0] },
  back: { normal: [0, 0, -1], up: [0, 1, 0], right: [-1, 0, 0] },
  top: { normal: [0, 1, 0], up: [0, 0, -1], right: [1, 0, 0] },
  bottom: { normal: [0, -1, 0], up: [0, 0, 1], right: [1, 0, 0] },
  left: { normal: [-1, 0, 0], up: [0, 1, 0], right: [0, 0, 1] },
  right: { normal: [1, 0, 0], up: [0, 1, 0], right: [0, 0, -1] },
};

// Movement directions for each face
const DIRECTIONS = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right'
};

const SPECIAL_FOOD_CHANCE = 0.1;
const FRUIT_TYPES = {
  NORMAL: 'normal',
  MULTI_FRUIT: 'multi-fruit',
  INVINCIBILITY: 'invincibility',
  LOOP_AROUND: 'loop-around',
};

// Get world position from face coordinates
function getFacePosition(face, x, y) {
  const halfSize = BOARD_SIZE / 2;
  const cellSize = BOARD_SIZE / GRID_COUNT;
  
  // Convert grid coordinates to positions relative to the center of the face (-0.5 to 0.5)
  const relX = (x / GRID_COUNT - 0.5) * BOARD_SIZE + cellSize/2;
  const relY = (y / GRID_COUNT - 0.5) * BOARD_SIZE + cellSize/2;
  
  let position = [0, 0, 0];
  
  switch (face) {
    case 'front':
      position = [relX, relY, halfSize];
      break;
    case 'back':
      position = [-relX, relY, -halfSize];
      break;
    case 'top':
      position = [relX, halfSize, -relY];
      break;
    case 'bottom':
      position = [relX, -halfSize, relY];
      break;
    case 'left':
      position = [-halfSize, relY, -relX];
      break;
    case 'right':
      position = [halfSize, relY, relX];
      break;
    default:
      break;
  }
  
  return position;
}

// Grid line for a single face
function FaceGrid({ position, rotation, size }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color="darkblue" transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
      <gridHelper 
        args={[size, GRID_COUNT, "rgba(255, 255, 255, 0.3)", "rgba(255, 255, 255, 0.3)"]} 
        rotation={[Math.PI/2, 0, 0]}
      />
    </group>
  );
}

// 3D Grid Cube
function GridCube() {
  const halfSize = BOARD_SIZE / 2;
  
  return (
    <group>
      {/* Front face - Z positive */}
      <FaceGrid 
        position={[0, 0, halfSize]} 
        rotation={[0, 0, 0]} 
        size={BOARD_SIZE} 
      />
      
      {/* Back face - Z negative */}
      <FaceGrid 
        position={[0, 0, -halfSize]} 
        rotation={[0, Math.PI, 0]} 
        size={BOARD_SIZE} 
      />
      
      {/* Top face - Y positive */}
      <FaceGrid 
        position={[0, halfSize, 0]} 
        rotation={[Math.PI/2, 0, 0]} 
        size={BOARD_SIZE} 
      />
      
      {/* Bottom face - Y negative */}
      <FaceGrid 
        position={[0, -halfSize, 0]} 
        rotation={[-Math.PI/2, 0, 0]} 
        size={BOARD_SIZE} 
      />
      
      {/* Left face - X negative */}
      <FaceGrid 
        position={[-halfSize, 0, 0]} 
        rotation={[0, -Math.PI/2, 0]} 
        size={BOARD_SIZE} 
      />
      
      {/* Right face - X positive */}
      <FaceGrid 
        position={[halfSize, 0, 0]} 
        rotation={[0, Math.PI/2, 0]} 
        size={BOARD_SIZE} 
      />
    </group>
  );
}

// Snake Segment
function SnakeSegment({ face, x, y, color, isInvincible }) {
  const position = getFacePosition(face, x, y);
  const cellSize = BOARD_SIZE / GRID_COUNT;
  
  return (
    <mesh position={position}>
      <boxGeometry args={[cellSize * 0.8, cellSize * 0.8, cellSize * 0.3]} />
      <meshStandardMaterial 
        color={color} 
        emissive={isInvincible ? "white" : color}
        emissiveIntensity={isInvincible ? 0.5 : 0.1}
      />
    </mesh>
  );
}

// Food
function Food({ face, x, y, type }) {
  const position = getFacePosition(face, x, y);
  const cellSize = BOARD_SIZE / GRID_COUNT;
  
  let color;
  switch (type) {
    case FRUIT_TYPES.MULTI_FRUIT:
      color = "blue";
      break;
    case FRUIT_TYPES.INVINCIBILITY:
      color = "yellow";
      break;
    case FRUIT_TYPES.LOOP_AROUND:
      color = "green";
      break;
    default:
      color = "red";
  }

  return (
    <mesh position={position}>
      <sphereGeometry args={[cellSize * 0.3, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
  );
}

// Camera with static position
function FollowCamera() {
  return (
    <PerspectiveCamera 
      makeDefault
      position={[0, 0, 20]} 
      fov={50}
    />
  );
}

// Game UI that renders the score and game over screen
function GameUI({ score, highScore, gameOver, restartGame }) {
  if (gameOver) {
    return (
      <group position={[0, 1, 0]}>
        <Text position={[0, 1, 0]} color="red" fontSize={1} anchorX="center" anchorY="middle">
          Game Over!
        </Text>
        <Text position={[0, 0, 0]} color="white" fontSize={0.5} anchorX="center" anchorY="middle">
          Score: {score}
        </Text>
        <Text position={[0, -0.7, 0]} color="white" fontSize={0.5} anchorX="center" anchorY="middle">
          High Score: {highScore}
        </Text>
      </group>
    );
  }
  
  return (
    <group position={[0, BOARD_SIZE/2 + 1, 0]}>
      <Text position={[-BOARD_SIZE/2, 0, 0]} color="white" fontSize={0.5} anchorX="left" anchorY="middle">
        Score: {score}
      </Text>
      <Text position={[BOARD_SIZE/2, 0, 0]} color="white" fontSize={0.5} anchorX="right" anchorY="middle">
        High Score: {highScore}
      </Text>
    </group>
  );
}

// 3D Game Board
function GameBoard({ snake, foods, isInvincible, rainbowColors, score, highScore, gameOver, restartGame }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <GridCube />
      
      {/* Render snake */}
      {snake.map((segment, index) => (
        <SnakeSegment 
          key={`${segment.face}-${segment.x}-${segment.y}-${index}`}
          face={segment.face}
          x={segment.x}
          y={segment.y}
          color={rainbowColors[index % rainbowColors.length]}
          isInvincible={isInvincible}
        />
      ))}
      
      {/* Render food */}
      {foods.map((food, index) => (
        <Food 
          key={`food-${index}-${food.face}-${food.x}-${food.y}`}
          face={food.face}
          x={food.x}
          y={food.y}
          type={food.type}
        />
      ))}
      
      <FollowCamera />
      <GameUI score={score} highScore={highScore} gameOver={gameOver} restartGame={restartGame} />
      
      {/* Enable OrbitControls since we disabled automatic camera movement */}
      <OrbitControls enablePan={false} />
    </>
  );
}

// Get next position based on current face and direction
function getNextPosition(face, x, y, direction) {
  let newFace = face;
  let newX = x;
  let newY = y;
  
  // First calculate the movement on the current face
  switch (direction) {
    case DIRECTIONS.UP:
      newY--;
      break;
    case DIRECTIONS.DOWN:
      newY++;
      break;
    case DIRECTIONS.LEFT:
      newX--;
      break;
    case DIRECTIONS.RIGHT:
      newX++;
      break;
    default:
      break;
  }
  
  // Check if we need to transition to another face
  const isOutOfBounds = 
    newX < 0 || 
    newX >= GRID_COUNT || 
    newY < 0 || 
    newY >= GRID_COUNT;
  
  if (isOutOfBounds) {
    // Revised face transition logic
    if (face === 'front') {
      if (newY < 0) { // Top edge
        newFace = 'top';
        newY = GRID_COUNT - 1;
        newX = x; // Maintain same X position
      } else if (newY >= GRID_COUNT) { // Bottom edge
        newFace = 'bottom';
        newY = 0;
        newX = x;
      } else if (newX < 0) { // Left edge
        newFace = 'left';
        newX = GRID_COUNT - 1;
        newY = y;
      } else if (newX >= GRID_COUNT) { // Right edge
        newFace = 'right';
        newX = 0;
        newY = y;
      }
    } else if (face === 'back') {
      if (newY < 0) { // Top edge
        newFace = 'top';
        newY = GRID_COUNT - 1;
        newX = GRID_COUNT - 1 - x; // Mirror X
      } else if (newY >= GRID_COUNT) { // Bottom edge
        newFace = 'bottom';
        newY = 0;
        newX = GRID_COUNT - 1 - x;
      } else if (newX < 0) { // Left edge
        newFace = 'right';
        newX = GRID_COUNT - 1;
        newY = y;
      } else if (newX >= GRID_COUNT) { // Right edge
        newFace = 'left';
        newX = 0;
        newY = y;
      }
    } else if (face === 'top') {
      if (newY < 0) { // Front edge
        newFace = 'front';
        newY = GRID_COUNT - 1;
        newX = x;
      } else if (newY >= GRID_COUNT) { // Back edge
        newFace = 'back';
        newY = GRID_COUNT - 1;
        newX = GRID_COUNT - 1 - x;
      } else if (newX < 0) { // Left edge
        newFace = 'left';
        newX = y;
        newY = GRID_COUNT - 1;
      } else if (newX >= GRID_COUNT) { // Right edge
        newFace = 'right';
        newX = GRID_COUNT - 1 - y;
        newY = GRID_COUNT - 1;
      }
    } else if (face === 'bottom') {
      if (newY < 0) { // Front edge
        newFace = 'front';
        newY = 0;
        newX = x;
      } else if (newY >= GRID_COUNT) { // Back edge
        newFace = 'back';
        newY = 0;
        newX = GRID_COUNT - 1 - x;
      } else if (newX < 0) { // Left edge
        newFace = 'left';
        newX = GRID_COUNT - 1 - y;
        newY = 0;
      } else if (newX >= GRID_COUNT) { // Right edge
        newFace = 'right';
        newX = y;
        newY = 0;
      }
    } else if (face === 'left') {
      if (newY < 0) { // Top edge
        newFace = 'top';
        newX = 0;
        newY = x;
      } else if (newY >= GRID_COUNT) { // Bottom edge
        newFace = 'bottom';
        newX = 0;
        newY = GRID_COUNT - 1 - x;
      } else if (newX < 0) { // Back edge
        newFace = 'back';
        newX = GRID_COUNT - 1;
        newY = y;
      } else if (newX >= GRID_COUNT) { // Front edge
        newFace = 'front';
        newX = GRID_COUNT - 1;
        newY = y;
      }
    } else if (face === 'right') {
      if (newY < 0) { // Top edge
        newFace = 'top';
        newX = GRID_COUNT - 1;
        newY = GRID_COUNT - 1 - x;
      } else if (newY >= GRID_COUNT) { // Bottom edge
        newFace = 'bottom';
        newX = GRID_COUNT - 1;
        newY = x;
      } else if (newX < 0) { // Front edge
        newFace = 'front';
        newX = 0;
        newY = y;
      } else if (newX >= GRID_COUNT) { // Back edge
        newFace = 'back';
        newX = 0;
        newY = y;
      }
    }
  }
  
  return { face: newFace, x: newX, y: newY, crossedEdge: isOutOfBounds };
}

// Get random face coordinates
function getRandomFacePosition(snake = []) {
  const faces = ['front', 'back', 'top', 'bottom', 'left', 'right'];
  const face = faces[Math.floor(Math.random() * faces.length)];
  
  const position = {
    face,
    x: Math.floor(Math.random() * GRID_COUNT),
    y: Math.floor(Math.random() * GRID_COUNT)
  };

  // Make sure the food doesn't spawn on the snake
  if (snake.some(segment => 
    segment.face === position.face && 
    segment.x === position.x && 
    segment.y === position.y)) {
    return getRandomFacePosition(snake);
  }

  return position;
}

function App() {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [direction, setDirection] = useState(DIRECTIONS.UP);
  const [foods, setFoods] = useState([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(parseInt(localStorage.getItem('highScore') || '0'));
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isInvincible, setIsInvincible] = useState(false);
  const [canLoopAround, setCanLoopAround] = useState(false);
  const [fruitMultiplier, setFruitMultiplier] = useState(1);
  const [rainbowColors, setRainbowColors] = useState(generateRainbowColors(20));
  
  const directionRef = useRef(direction);
  const invincibilityTimeoutRef = useRef(null);
  const lastKeyPressTimeRef = useRef(0);
  const lastDirectionChangedRef = useRef(false);
  const snakeRef = useRef(snake);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      // Initialize food on first render
      setFoods([getRandomFood()]);
    }
  }, []);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);
  
  useEffect(() => {
    snakeRef.current = snake;
  }, [snake]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (invincibilityTimeoutRef.current) {
        clearTimeout(invincibilityTimeoutRef.current);
      }
    };
  }, []);

  function getRandomFood() {
    const foodType = Math.random() < SPECIAL_FOOD_CHANCE ? 
      getRandomSpecialFoodType() : FRUIT_TYPES.NORMAL;
    
    return {
      ...getRandomFacePosition(snakeRef.current),
      type: foodType
    };
  }

  function getRandomSpecialFoodType() {
    const types = [
      FRUIT_TYPES.MULTI_FRUIT, 
      FRUIT_TYPES.INVINCIBILITY, 
      FRUIT_TYPES.LOOP_AROUND
    ];
    return types[Math.floor(Math.random() * types.length)];
  }

  function handleKeyDown(e) {
    if (gameOver) {
      if (e.key === 'Enter' || e.key === ' ') {
        restartGame();
      }
      return;
    }
    
    if (e.key === ' ') {
      setIsPaused(prev => !prev);
      return;
    }
    
    // Minimum delay between direction changes to prevent 180° turns
    const now = Date.now();
    if (now - lastKeyPressTimeRef.current < GAME_SPEED * 0.8) {
      // If we already changed direction once during this game cycle, ignore further changes
      if (lastDirectionChangedRef.current) {
        return;
      }
    }
    
    let newDirection = directionRef.current;
    const currentDirection = directionRef.current;
    const head = snake[0];
    
    // Helper function to check opposite directions
    const isOppositeDirection = (dir1, dir2) => {
      if (dir1 === DIRECTIONS.UP && dir2 === DIRECTIONS.DOWN) return true;
      if (dir1 === DIRECTIONS.DOWN && dir2 === DIRECTIONS.UP) return true;
      if (dir1 === DIRECTIONS.LEFT && dir2 === DIRECTIONS.RIGHT) return true;
      if (dir1 === DIRECTIONS.RIGHT && dir2 === DIRECTIONS.LEFT) return true;
      return false;
    };
    
    switch (e.key) {
      // Arrow keys
      case 'ArrowUp':
        if (!isOppositeDirection(DIRECTIONS.UP, currentDirection)) {
          newDirection = DIRECTIONS.UP;
        }
        break;
      case 'ArrowDown':
        if (!isOppositeDirection(DIRECTIONS.DOWN, currentDirection)) {
          newDirection = DIRECTIONS.DOWN;
        }
        break;
      case 'ArrowLeft':
        if (!isOppositeDirection(DIRECTIONS.LEFT, currentDirection)) {
          newDirection = DIRECTIONS.LEFT;
        }
        break;
      case 'ArrowRight':
        if (!isOppositeDirection(DIRECTIONS.RIGHT, currentDirection)) {
          newDirection = DIRECTIONS.RIGHT;
        }
        break;
      // WASD keys
      case 'w':
      case 'W':
        if (!isOppositeDirection(DIRECTIONS.UP, currentDirection)) {
          newDirection = DIRECTIONS.UP;
        }
        break;
      case 's':
      case 'S':
        if (!isOppositeDirection(DIRECTIONS.DOWN, currentDirection)) {
          newDirection = DIRECTIONS.DOWN;
        }
        break;
      case 'a':
      case 'A':
        if (!isOppositeDirection(DIRECTIONS.LEFT, currentDirection)) {
          newDirection = DIRECTIONS.LEFT;
        }
        break;
      case 'd':
      case 'D':
        if (!isOppositeDirection(DIRECTIONS.RIGHT, currentDirection)) {
          newDirection = DIRECTIONS.RIGHT;
        }
        break;
      default:
        return;
    }
    
    // Only update if the direction actually changed
    if (newDirection !== currentDirection) {
      setDirection(newDirection);
      lastKeyPressTimeRef.current = now;
      lastDirectionChangedRef.current = true;
    }
  }

  useInterval(() => {
    if (isPaused || gameOver) return;
    // Reset the flag at the start of each game cycle
    lastDirectionChangedRef.current = false;
    moveSnake();
  }, GAME_SPEED);

  function moveSnake() {
    const newSnake = [...snake];
    const head = newSnake[0];
    
    // Calculate new head position
    const nextPosition = getNextPosition(head.face, head.x, head.y, direction);
    
    // Check for self collision (skip the tail since it will move)
    const hitSelf = newSnake.slice(0, -1).some(segment => 
      segment.face === nextPosition.face && 
      segment.x === nextPosition.x && 
      segment.y === nextPosition.y
    );
    
    if (hitSelf && !isInvincible) {
      handleGameOver();
      return;
    }
    
    // Create the new head
    const newHead = {
      face: nextPosition.face,
      x: nextPosition.x,
      y: nextPosition.y
    };
    
    // Add new head
    newSnake.unshift(newHead);
    
    // Check for food collision
    let foodEaten = false;
    let newFoods = [...foods];
    let newScore = score;

    for (let i = 0; i < newFoods.length; i++) {
      const food = newFoods[i];
      if (newHead.face === food.face && newHead.x === food.x && newHead.y === food.y) {
        foodEaten = true;
        newScore += 1 * 3; // Each fruit is worth 3 points
        
        // Apply special food effects
        switch (food.type) {
          case FRUIT_TYPES.MULTI_FRUIT:
            setFruitMultiplier(prev => prev + 1);
            break;
          case FRUIT_TYPES.INVINCIBILITY:
            activateInvincibility();
            break;
          case FRUIT_TYPES.LOOP_AROUND:
            setCanLoopAround(true);
            break;
          default:
            break;
        }
        
        // Generate new foods
        newFoods.splice(i, 1);
        
        // Add food based on multiplier
        for (let j = 0; j < fruitMultiplier; j++) {
          newFoods.push(getRandomFood());
        }
        
        break;
      }
    }
    
    if (!foodEaten) {
      newSnake.pop(); // Remove tail if no food eaten
    } else {
      // Shift rainbow colors
      setRainbowColors(prevColors => {
        const colors = [...prevColors];
        colors.unshift(colors.pop());
        return colors;
      });
    }
    
    setSnake(newSnake);
    setFoods(newFoods);
    if (foodEaten) {
      setScore(newScore);
    }
  }

  function activateInvincibility() {
    setIsInvincible(true);
    
    // Clear existing timeout if it exists
    if (invincibilityTimeoutRef.current) {
      clearTimeout(invincibilityTimeoutRef.current);
    }
    
    // Set timeout to disable invincibility after 5 seconds
    invincibilityTimeoutRef.current = setTimeout(() => {
      setIsInvincible(false);
    }, 5000);
  }

  function handleGameOver() {
    setGameOver(true);
    
    // Update high score if current score is higher
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('highScore', score.toString());
    }
  }

  function restartGame() {
    setSnake(INITIAL_SNAKE);
    setDirection(DIRECTIONS.UP);
    setFoods([getRandomFood()]);
    setScore(0);
    setGameOver(false);
    setIsPaused(false);
    setIsInvincible(false);
    setCanLoopAround(false);
    setFruitMultiplier(1);
    setRainbowColors(generateRainbowColors(20));
    lastKeyPressTimeRef.current = 0;
    lastDirectionChangedRef.current = false;
    
    // Clear timers
    if (invincibilityTimeoutRef.current) {
      clearTimeout(invincibilityTimeoutRef.current);
    }
  }

  return (
    <div className="App">
      <div className="game-container-3d">
        <div className="controls-overlay">
          <h1>Cube Snake</h1>
          <div className="controls">
            <p>Move: <strong>WASD</strong> or <strong>Arrow Keys</strong></p>
            <p><strong>Space</strong> to pause/restart</p>
          </div>
          
          <div className="legend">
            <div className="legend-item">
              <div className="legend-color normal-fruit"></div>
              <span>Normal Fruit</span>
            </div>
            <div className="legend-item">
              <div className="legend-color multi-fruit"></div>
              <span>Multi Fruit: Spawns additional fruits</span>
            </div>
            <div className="legend-item">
              <div className="legend-color invincibility-fruit"></div>
              <span>Invincibility: 5 seconds of invulnerability</span>
            </div>
            <div className="legend-item">
              <div className="legend-color loop-fruit"></div>
              <span>Loop Around: Teleport through walls</span>
            </div>
          </div>
          
          <div className="score-container">
            <div>Score: {score}</div>
            <div>High Score: {highScore}</div>
            <div>Fruits: {score / 3}</div>
          </div>
          
          <div className="game-status">
            {isPaused && <div className="paused">PAUSED</div>}
            {isInvincible && <div className="invincible-status">INVINCIBLE</div>}
            {canLoopAround && <div className="loop-status">LOOP ENABLED</div>}
          </div>
          
          {gameOver && (
            <div className="game-over">
              <h2>Game Over!</h2>
              <p>Your score: {score}</p>
              <p>High score: {highScore}</p>
              <button onClick={restartGame}>Restart</button>
            </div>
          )}
        </div>
        
        <div className="canvas-container">
          <Canvas>
            <GameBoard 
              snake={snake} 
              foods={foods} 
              isInvincible={isInvincible} 
              rainbowColors={rainbowColors}
              score={score}
              highScore={highScore}
              gameOver={gameOver}
              restartGame={restartGame}
            />
          </Canvas>
        </div>
      </div>
    </div>
  );
}

export default App; 