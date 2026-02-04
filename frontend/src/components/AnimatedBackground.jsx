import React, { useEffect, useRef } from 'react';

const AnimatedBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const particleCount = 80;
    const codeChars = ['0', '1', '{', '}', '<', '>', '/', '*', '+', '-', '=', 'λ', 'π', 'Σ', 'α', 'β', 'γ'];

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.opacity = Math.random() * 0.5 + 0.2;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > canvas.width) this.x = 0;
        if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        if (this.y < 0) this.y = canvas.height;
      }

      draw() {
        ctx.fillStyle = `rgba(60, 195, 182, ${this.opacity})`; // التركواز الدقيق
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    class CodeChar {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.char = codeChars[Math.floor(Math.random() * codeChars.length)];
        this.size = Math.random() * 10 + 8;
        this.opacity = Math.random() * 0.1 + 0.05;
        this.speedY = Math.random() * 0.2 + 0.1;
      }

      update() {
        this.y += this.speedY;
        if (this.y > canvas.height) {
          this.y = -20;
          this.x = Math.random() * canvas.width;
        }
      }

      draw() {
        ctx.fillStyle = `rgba(100, 100, 100, ${this.opacity})`;
        ctx.font = `${this.size}px monospace`;
        ctx.fillText(this.char, this.x, this.y);
      }
    }

    // Create particles
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    // Create code characters
    const codeCharacters = [];
    for (let i = 0; i < 50; i++) {
      codeCharacters.push(new CodeChar());
    }

    let animationId;
    // Reduce load on low-memory devices by limiting FPS
    let lastFrameTs = 0;
    const targetFps = 20;
    const frameInterval = 1000 / targetFps;

    function animate(ts) {
      if (ts - lastFrameTs < frameInterval) {
        animationId = requestAnimationFrame(animate);
        return;
      }
      lastFrameTs = ts;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw and update code characters
      codeCharacters.forEach(char => {
        char.update();
        char.draw();
      });

      // Draw and update particles
      particles.forEach(particle => {
        particle.update();
        particle.draw();
      });

      // Draw connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            ctx.strokeStyle = `rgba(34, 197, 94, ${0.12 * (1 - distance / 100)})`; // أخضر أوضح
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0, opacity: 0.6 }}
    />
  );
};

export default AnimatedBackground;
