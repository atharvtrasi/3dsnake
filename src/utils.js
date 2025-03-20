// Get random coordinates for food in 2D
export const getRandomCoordinates = (boardSize, snake = []) => {
  const position = {
    x: Math.floor(Math.random() * boardSize),
    y: Math.floor(Math.random() * boardSize)
  };

  // Make sure the food doesn't spawn on the snake
  if (snake.some(segment => segment.x === position.x && segment.y === position.y)) {
    return getRandomCoordinates(boardSize, snake);
  }

  return position;
};

// Get random coordinates for food in 3D
export const getRandomCoordinates3D = (boardSize, snake = []) => {
  const position = {
    x: Math.floor(Math.random() * boardSize),
    y: Math.floor(Math.random() * boardSize),
    z: Math.floor(Math.random() * boardSize)
  };

  // Make sure the food doesn't spawn on the snake
  if (snake.some(segment => 
    segment.x === position.x && 
    segment.y === position.y && 
    segment.z === position.z)) {
    return getRandomCoordinates3D(boardSize, snake);
  }

  return position;
};

// Generate rainbow colors from red to purple (20 values)
export const generateRainbowColors = (count) => {
  const colors = [];
  
  for (let i = 0; i < count; i++) {
    // Convert position to a value between 0 and 1
    const position = i / (count - 1);
    
    // Use HSL (Hue, Saturation, Lightness)
    // Hue: 0 is red, 60 is yellow, 120 is green, 180 is cyan, 240 is blue, 270 is purple, 300 is pink
    const hue = position * 270; // Go from red (0) to purple (270)
    
    colors.push(`hsl(${hue}, 100%, 50%)`);
  }
  
  return colors;
}; 