import React, { useEffect, useState } from 'react';

const Snowflakes = () => {
  const [snowflakes, setSnowflakes] = useState([]);

  // Array of colors for random selection
  const colors = [
    '#ff6b6b', // red
    '#4ecdc4', // teal
    '#45b7d1', // blue
    '#96ceb4', // green
    '#ffeaa7', // yellow
    '#dfe6e9', // white
    '#a29bfe', // purple
    '#fd79a8', // pink
    '#74b9ff', // light blue
    '#00b894', // emerald
  ];

  const getRandomColor = () => {
    return colors[Math.floor(Math.random() * colors.length)];
  };

  useEffect(() => {
    const createSnowflake = () => {
      const color = getRandomColor();
      const snowflake = {
        id: Date.now() + Math.random(),
        x: Math.random() * window.innerWidth,
        y: -10,
        size: Math.random() * 4 + 2, // Smaller size for snowflakes
        speed: Math.random() * 2 + 1,
        opacity: Math.random() * 0.6 + 0.4, // Random opacity for depth effect
        color: color
      };
      setSnowflakes(prev => [...prev, snowflake]);
    };

    const animateSnowflakes = () => {
      setSnowflakes(prev =>
        prev.map(flake => ({
          ...flake,
          y: flake.y + flake.speed,
          x: flake.x + Math.sin(flake.y * 0.02) * 0.5 // Add gentle horizontal movement
        })).filter(flake => flake.y < window.innerHeight)
      );
    };

    const snowInterval = setInterval(createSnowflake, 100);
    const animationFrame = setInterval(animateSnowflakes, 30);

    return () => {
      clearInterval(snowInterval);
      clearInterval(animationFrame);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 9999,
      overflow: 'hidden'
    }}>
      {snowflakes.map(flake => (
        <div
          key={flake.id}
          style={{
            position: 'absolute',
            left: `${flake.x}px`,
            top: `${flake.y}px`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            backgroundColor: flake.color,
            borderRadius: '50%',
            opacity: flake.opacity,
            boxShadow: `0 0 ${flake.size * 3}px ${flake.color}, 0 0 ${flake.size * 6}px ${flake.color}, 0 0 ${flake.size * 10}px ${flake.color}, 0 0 ${flake.size * 15}px ${flake.color}`,
            transition: 'left 0.3s ease'
          }}
        />
      ))}
    </div>
  );
};

export default Snowflakes;