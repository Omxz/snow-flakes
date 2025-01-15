import React, { useEffect, useState } from 'react';

const Snowflakes = () => {
  const [snowflakes, setSnowflakes] = useState([]);

  useEffect(() => {
    const createSnowflake = () => {
      const snowflake = {
        id: Date.now(),
        x: Math.random() * window.innerWidth,
        y: -10,
        size: Math.random() * 4 + 2, // Smaller size for snowflakes
        speed: Math.random() * 2 + 1,
        opacity: Math.random() * 0.6 + 0.4 // Random opacity for depth effect
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
            backgroundColor: '#fff',
            borderRadius: '50%',
            opacity: flake.opacity,
            boxShadow: '0 0 10px rgba(255, 255, 255, 0.8)',
            transition: 'left 0.3s ease'
          }}
        />
      ))}
    </div>
  );
};

export default Snowflakes;