"use client";
import { useEffect, useState } from "react";

export default function AnimatedBackground() {
  const [mounted, setMounted] = useState(false);

  // Scaled down params for the extension popup (400x600)
  // Original had size ~600, which is too big for a 400px window.
  const seededParams = {
    orbs: [
      {
        size: 250, 
        top: "10%", // Lowered from -10%
        left: "-10%",
        blur: 60,
        dur: 25,
        opacity: 0.4,
      },
      {
        size: 220, 
        top: "15%", // Lowered from -5%
        right: "-10%",
        blur: 55,
        dur: 30,
        opacity: 0.35,
      },
      {
        size: 180, 
        top: "60%", // Lowered from 40%
        left: "-10%",
        blur: 50,
        dur: 18,
        opacity: 0.3,
      },
    ],
  } as const;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Static Grid Pattern */}
      <div
        className={`fixed inset-0 z-[0] transition-opacity duration-1000 ${
          mounted ? "opacity-90 dark:opacity-[0.5]" : "opacity-0"
        }`}
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--border)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)
          `,
          backgroundSize: "30px 30px", // Slightly smaller grid for popup
          maskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Animated glow orbs (Subtle) */}
        <div className="fixed inset-0 z-[0] overflow-hidden pointer-events-none">
          {/* Orb 1 */}
          <div
            className="absolute rounded-full transition-opacity duration-1000"
            style={{
              width: `${seededParams.orbs[0].size}px`,
              height: `${seededParams.orbs[0].size}px`,
              background:
                "radial-gradient(circle, hsl(var(--primary) / 0.6), hsl(var(--primary) / 0.2) 40%, transparent 70%)",
              filter: `blur(${seededParams.orbs[0].blur}px)`,
              top: seededParams.orbs[0].top,
              left: seededParams.orbs[0].left,
              opacity: seededParams.orbs[0].opacity,
              animation: `float1 ${seededParams.orbs[0].dur}s ease-in-out infinite`,
            }}
          />

          {/* Orb 2 */}
          <div
            className="absolute rounded-full transition-opacity duration-1000"
            style={{
              width: `${seededParams.orbs[1].size}px`,
              height: `${seededParams.orbs[1].size}px`,
              background:
                "radial-gradient(circle, hsl(var(--primary) / 0.5), hsl(var(--primary) / 0.2) 40%, transparent 70%)",
              filter: `blur(${seededParams.orbs[1].blur}px)`,
              top: seededParams.orbs[1].top,
              right: seededParams.orbs[1].right,
              opacity: seededParams.orbs[1].opacity,
              animation: `float2 ${seededParams.orbs[1].dur}s ease-in-out infinite`,
            }}
          />

          {/* Orb 3 */}
          <div
            className="absolute rounded-full transition-opacity duration-1000"
            style={{
              width: `${seededParams.orbs[2].size}px`,
              height: `${seededParams.orbs[2].size}px`,
              background:
                "radial-gradient(circle, hsl(var(--primary) / 0.4), hsl(var(--primary) / 0.15) 40%, transparent 70%)",
              filter: `blur(${seededParams.orbs[2].blur}px)`,
              top: seededParams.orbs[2].top,
              left: seededParams.orbs[2].left,
              opacity: seededParams.orbs[2].opacity,
              animation: `pulse1 ${seededParams.orbs[2].dur}s ease-in-out infinite`,
            }}
          />
        </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -20px) scale(1.05); }
          66% { transform: translate(-15px, 15px) scale(0.95); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-25px, 20px) scale(1.08); }
        }
        @keyframes pulse1 {
          0%, 100% { transform: scale(1); opacity: ${seededParams.orbs[2].opacity}; }
          50% { transform: scale(1.15); opacity: ${seededParams.orbs[2].opacity * 1.5}; }
        }
      `}</style>
    </>
  );
}
