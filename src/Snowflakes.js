import React, { useEffect, useState } from 'react';
import logoLasLight from './lars.png'; // Import the image

const Snowflakes = () => {
  const [snowflakes, setSnowflakes] = useState([]);

  useEffect(() => {
    const createSnowflake = () => {
      const snowflake = {
        id: Date.now(),
        x: Math.random() * window.innerWidth,
        y: -100, // Increased initial y to account for image size
        size: Math.random() * 50 + 30, // Larger size range for image
        speed: Math.random() * 3 + 1
      };
      setSnowflakes(prev => [...prev, snowflake]);
    };

    const animateSnowflakes = () => {
      setSnowflakes(prev =>
        prev.map(flake => ({
          ...flake,
          y: flake.y + flake.speed
        })).filter(flake => flake.y < window.innerHeight)
      );
    };

    const snowInterval = setInterval(createSnowflake, 200);
    const animationFrame = setInterval(animateSnowflakes, 50);

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
      zIndex: 9999
    }}>
      {snowflakes.map(flake => (
        <img
          key={flake.id}
          src={logoLasLight}
          alt="Falling logo"
          style={{
            position: 'absolute',
            left: `${flake.x}px`,
            top: `${flake.y}px`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: 0.7,
            objectFit: 'contain',
            borderRadius: '50px'
          }}
        />
      ))}
    </div>
  );
};

export default Snowflakes;