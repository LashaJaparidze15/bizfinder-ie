"use client";

import { useEffect, useRef } from "react";

type Point = { x: number; y: number };
interface WaveConfig {
  offset: number;
  amplitude: number;
  frequency: number;
  color: string;
  opacity: number;
}

// Mouse-reactive glowing waves (21st.dev "GlowyWavesHero" canvas), recolored to
// the emerald brand. Reads shadcn HSL-triple tokens via hsl(var(--x)). Fills its
// parent (position it inside a `relative` container). Respects reduced-motion.
export function WavesBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<Point>({ x: 0, y: 0 });
  const targetMouseRef = useRef<Point>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    let time = 0;

    const rootStyles = getComputedStyle(document.documentElement);
    const resolveColor = (variable: string, alpha = 1) => {
      const raw = rootStyles.getPropertyValue(variable).trim();
      // tokens are HSL triples like "160 84% 30%"
      return raw ? `hsl(${raw} / ${alpha})` : `rgba(120,120,120,${alpha})`;
    };

    const wavePalette: WaveConfig[] = [
      { offset: 0, amplitude: 70, frequency: 0.003, color: resolveColor("--ui-primary", 0.8), opacity: 0.45 },
      { offset: Math.PI / 2, amplitude: 90, frequency: 0.0026, color: resolveColor("--ui-accent", 0.7), opacity: 0.35 },
      { offset: Math.PI, amplitude: 60, frequency: 0.0034, color: resolveColor("--ui-primary", 0.55), opacity: 0.3 },
      { offset: Math.PI * 1.5, amplitude: 80, frequency: 0.0022, color: resolveColor("--ui-accent", 0.4), opacity: 0.25 },
      { offset: Math.PI * 2, amplitude: 55, frequency: 0.004, color: resolveColor("--ui-primary", 0.35), opacity: 0.22 },
    ];

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouseInfluence = prefersReduced ? 8 : 65;
    const influenceRadius = prefersReduced ? 160 : 320;
    const smoothing = prefersReduced ? 0.04 : 0.1;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      const c = { x: canvas.width / 2, y: canvas.height / 2 };
      mouseRef.current = c;
      targetMouseRef.current = c;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetMouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => {
      targetMouseRef.current = { x: canvas.width / 2, y: canvas.height / 2 };
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onLeave);

    const drawWave = (wave: WaveConfig) => {
      ctx.save();
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += 4) {
        const dx = x - mouseRef.current.x;
        const dy = canvas.height / 2 - mouseRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - distance / influenceRadius);
        const mouseEffect = influence * mouseInfluence * Math.sin(time * 0.001 + x * 0.01 + wave.offset);
        const y =
          canvas.height / 2 +
          Math.sin(x * wave.frequency + time * 0.002 + wave.offset) * wave.amplitude +
          Math.sin(x * wave.frequency * 0.4 + time * 0.003) * (wave.amplitude * 0.45) +
          mouseEffect;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = wave.color;
      ctx.globalAlpha = wave.opacity;
      ctx.shadowBlur = 32;
      ctx.shadowColor = wave.color;
      ctx.stroke();
      ctx.restore();
    };

    const animate = () => {
      time += 1;
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * smoothing;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * smoothing;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      wavePalette.forEach(drawWave);
      animationId = window.requestAnimationFrame(animate);
    };
    animationId = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className={className ?? "absolute inset-0 h-full w-full"} aria-hidden="true" />
  );
}
