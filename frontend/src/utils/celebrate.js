import confetti from 'canvas-confetti';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Small burst from a point on screen (e.g. the card that reached Done) */
export function burst(x = 0.5, y = 0.5) {
  if (reducedMotion()) return;
  confetti({
    particleCount: 70,
    spread: 70,
    startVelocity: 32,
    scalar: 0.9,
    origin: { x, y },
    colors: ['#6366f1', '#a855f7', '#10b981', '#f59e0b', '#ec4899'],
    zIndex: 60,
  });
}

/** Bigger two-sided celebration (sprint closed) */
export function celebrate() {
  if (reducedMotion()) return;
  const end = Date.now() + 900;
  (function frame() {
    confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, zIndex: 60 });
    confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, zIndex: 60 });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
