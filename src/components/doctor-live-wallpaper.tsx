import * as React from "react";

interface DoctorLiveWallpaperProps {
  children?: React.ReactNode;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speedY: number;
  speedX: number;
  swayPhase: number;
  swaySpeed: number;
}

interface NeuralNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  pulsePhase: number;
}

interface HelixNode {
  baseY: number;
  phase: number;
  speed: number;
  radius: number;
  strand: number;
}

export function DoctorLiveWallpaper({ children }: DoctorLiveWallpaperProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // Accessibility: detect reduced motion preference
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mq.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mq.addEventListener?.("change", listener);
      return () => mq.removeEventListener?.("change", listener);
    } catch {
      // Fallback
    }
  }, []);

  // 60FPS Live Canvas: DNA sparkles (left), Neural Synapse Plexus (right), ECG Wave (bottom)
  React.useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let width = 0;
    let height = 0;
    let dpr = 1;

    // Floating DNA luminescence particles (left side)
    const dnaParticles: Particle[] = [];
    const dnaParticleCount = 30;

    // Neural network nodes (right side)
    const neuralNodes: NeuralNode[] = [];
    const neuralNodeCount = 40;

    // Molecular DNA Helix Nodes (left strand)
    const helixNodes: HelixNode[] = [];
    const helixCount = 18;

    const resize = () => {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      if (ctx) {
        ctx.resetTransform?.();
        ctx.scale(dpr, dpr);
      }

      // Initialize DNA sparkles
      if (dnaParticles.length === 0) {
        for (let i = 0; i < dnaParticleCount; i++) {
          dnaParticles.push({
            x: Math.random() * (width * 0.44),
            y: Math.random() * height,
            radius: Math.random() * 2.2 + 0.8,
            alpha: Math.random() * 0.5 + 0.25,
            speedY: -(Math.random() * 0.35 + 0.12),
            speedX: (Math.random() - 0.5) * 0.2,
            swayPhase: Math.random() * Math.PI * 2,
            swaySpeed: Math.random() * 0.02 + 0.008,
          });
        }
      }

      // Initialize Neural Plexus nodes
      if (neuralNodes.length === 0) {
        for (let i = 0; i < neuralNodeCount; i++) {
          neuralNodes.push({
            x: width * 0.56 + Math.random() * (width * 0.44),
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.35,
            vy: (Math.random() - 0.5) * 0.35,
            radius: Math.random() * 1.8 + 1.2,
            baseAlpha: Math.random() * 0.45 + 0.3,
            pulsePhase: Math.random() * Math.PI * 2,
          });
        }
      }

      // Initialize subtle DNA helix rungs
      if (helixNodes.length === 0) {
        for (let i = 0; i < helixCount; i++) {
          helixNodes.push({
            baseY: (i / helixCount) * height,
            phase: (i / helixCount) * Math.PI * 4,
            speed: 0.015,
            radius: 2,
            strand: i % 2 === 0 ? 1 : -1,
          });
        }
      }
    };

    resize();
    window.addEventListener("resize", resize);

    // Bottom ECG parameters
    let ecgX = 0;
    const ecgSpeed = 3.0;
    const ecgHistory: { x: number; y: number }[] = [];
    const maxHistory = 400;

    let time = 0;

    const render = () => {
      time += 0.018;

      if (ctx && width > 0 && height > 0) {
        ctx.clearRect(0, 0, width, height);

        // If reduced motion is active, render a calm, stationary aesthetic
        if (reducedMotion) {
          ctx.fillStyle = "rgba(0, 210, 180, 0.03)";
          ctx.fillRect(0, 0, width, height);
          return;
        }

        // ── 1. FLOATING DNA SPARKLES & BIO-DUST (LEFT) ──
        for (let i = 0; i < dnaParticles.length; i++) {
          const p = dnaParticles[i];
          p.y += p.speedY;
          p.swayPhase += p.swaySpeed;
          p.x += Math.sin(p.swayPhase) * 0.35 + p.speedX;

          if (p.y < -10) {
            p.y = height + 10;
            p.x = Math.random() * (width * 0.44);
          }
          if (p.x < -10) p.x = width * 0.44;
          if (p.x > width * 0.46) p.x = 0;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 210, 180, ${p.alpha * 0.75})`;
          ctx.shadowColor = "rgba(0, 229, 255, 0.8)";
          ctx.shadowBlur = 6;
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        // ── 2. LIVE PULSING NEURAL NETWORK PLEXUS (RIGHT) ──
        const rightMinX = width * 0.55;
        for (let i = 0; i < neuralNodes.length; i++) {
          const node = neuralNodes[i];
          node.x += node.vx;
          node.y += node.vy;
          node.pulsePhase += 0.03;

          if (node.x < rightMinX || node.x > width) node.vx *= -1;
          if (node.y < 0 || node.y > height) node.vy *= -1;
        }

        // Draw connecting filaments with dynamic electrical pulses
        const maxDist = Math.min(width * 0.12, 140);
        ctx.lineWidth = 1.0;
        for (let i = 0; i < neuralNodes.length; i++) {
          for (let j = i + 1; j < neuralNodes.length; j++) {
            const n1 = neuralNodes[i];
            const n2 = neuralNodes[j];
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < maxDist) {
              const alpha = (1 - dist / maxDist) * 0.35;
              ctx.beginPath();
              ctx.moveTo(n1.x, n1.y);
              ctx.lineTo(n2.x, n2.y);
              ctx.strokeStyle = `rgba(0, 180, 216, ${alpha})`;
              ctx.stroke();

              // Electrical pulse spark traveling along filaments
              if ((i + j) % 7 === 0) {
                const sparkProgress = (time * 0.8 + (i * 0.3)) % 1;
                const sx = n1.x + dx * sparkProgress;
                const sy = n1.y + dy * sparkProgress;
                ctx.beginPath();
                ctx.arc(sx, sy, 1.4, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff";
                ctx.shadowColor = "#00e5ff";
                ctx.shadowBlur = 8;
                ctx.fill();
                ctx.shadowBlur = 0;
              }
            }
          }
        }

        // Draw synapse nodes
        for (let i = 0; i < neuralNodes.length; i++) {
          const node = neuralNodes[i];
          const dynamicAlpha =
            node.baseAlpha + Math.sin(node.pulsePhase) * 0.22;
          const nodeAlpha = Math.max(0.15, Math.min(1, dynamicAlpha));

          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 229, 255, ${nodeAlpha})`;
          ctx.shadowColor = "rgba(0, 229, 255, 0.9)";
          ctx.shadowBlur = 10;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        // ── 3. REALTIME CARDIAC LEAD II ECG OSCILLOSCOPE (BOTTOM) ──
        const ecgBaselineY = height - 28;
        ecgX += ecgSpeed;
        if (ecgX > width) {
          ecgX = 0;
          ecgHistory.length = 0;
        }

        const cycleLength = 220;
        const cycleProgress = (ecgX % cycleLength) / cycleLength;

        let dy = 0;
        if (cycleProgress >= 0.15 && cycleProgress < 0.23) {
          dy = -Math.sin(((cycleProgress - 0.15) / 0.08) * Math.PI) * 4;
        } else if (cycleProgress >= 0.32 && cycleProgress < 0.35) {
          dy = 3;
        } else if (cycleProgress >= 0.35 && cycleProgress < 0.39) {
          const peakProgress = (cycleProgress - 0.35) / 0.04;
          dy = -Math.sin(peakProgress * Math.PI) * 30;
        } else if (cycleProgress >= 0.39 && cycleProgress < 0.43) {
          dy = 6;
        } else if (cycleProgress > 0.52 && cycleProgress < 0.68) {
          dy = -Math.sin(((cycleProgress - 0.52) / 0.16) * Math.PI) * 7.5;
        }

        ecgHistory.push({ x: ecgX, y: ecgBaselineY + dy });
        if (ecgHistory.length > maxHistory) {
          ecgHistory.shift();
        }

        if (ecgHistory.length > 2) {
          for (let i = 0; i < ecgHistory.length - 1; i++) {
            const p1 = ecgHistory[i];
            const p2 = ecgHistory[i + 1];
            if (Math.abs(p2.x - p1.x) > 50) continue;
            const ageRatio = i / ecgHistory.length;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(0, 210, 180, ${ageRatio * 0.85})`;
            ctx.lineWidth = ageRatio > 0.8 ? 2 : 1.2;
            ctx.stroke();
          }

          const head = ecgHistory[ecgHistory.length - 1];
          ctx.beginPath();
          ctx.arc(head.x, head.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "#00d2b4";
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
    };
  }, [reducedMotion]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#020612] text-slate-100 flex flex-col justify-between select-none font-sans">
      {/* ── 1. PHOTOREALISTIC 3D DNA + NEURAL PLEXUS BACKGROUND ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <img
          src="/dna-neural-live-bg.jpg"
          alt="Aarogya X Bioinformatics Live Wallpaper"
          className="w-full h-full object-cover object-center filter brightness-[0.92] contrast-[1.08]"
        />

        {/* Ambient atmospheric depth overlay */}
        <div className="absolute inset-0 bg-radial-[circle_at_center_transparent_0%,_#020612/70_100%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020612]/95 via-transparent to-[#020612]/65" />

        {/* Center glowing aura behind the Aarogya X emblem */}
        <div
          className="absolute rounded-full pointer-events-none transition-all duration-700 opacity-45 scale-100"
          style={{
            top: "24%",
            left: "50%",
            width: "320px",
            height: "320px",
            transform: "translate(-50%, -50%)",
            background:
              "radial-gradient(circle, rgba(0, 210, 180, 0.35) 0%, rgba(0, 180, 216, 0.2) 40%, transparent 70%)",
            mixBlendMode: "screen",
            filter: "blur(25px)",
          }}
        />

        {/* High-tech millimeter telemetry grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #00d2b4 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* ── 2. 60FPS LIVE DNA SPARKLES + NEURAL PLEXUS + ECG CANVAS ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10 w-full h-full"
      />

      {/* ── 3. MAIN CONTENT SLOT (CENTERED LOGIN / REGISTER FORM) ── */}
      <div className="relative z-20 flex-1 flex items-center justify-center w-full px-4 sm:px-6 my-auto py-8">
        {children}
      </div>
    </div>
  );
}
