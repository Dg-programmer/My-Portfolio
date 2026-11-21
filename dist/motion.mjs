const preferenceKey = 'dhruvil-portfolio:motion';
const root = document.documentElement;
const toggle = document.querySelector('[data-motion-toggle]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let pausedByVisitor = false;

try {
  pausedByVisitor = localStorage.getItem(preferenceKey) === 'paused';
} catch {
  // The control still works for this page when browser storage is blocked.
}

function applyMotionPreference() {
  const paused = pausedByVisitor || reducedMotion.matches;
  root.dataset.motion = paused ? 'paused' : 'running';

  if (toggle) {
    toggle.hidden = reducedMotion.matches;
    toggle.textContent = paused ? 'Resume motion' : 'Pause motion';
  }
}

toggle?.addEventListener('click', () => {
  if (reducedMotion.matches) return;
  pausedByVisitor = !pausedByVisitor;
  applyMotionPreference();

  try {
    localStorage.setItem(preferenceKey, root.dataset.motion);
  } catch {
    // Keep the current choice in memory when browser storage is blocked.
  }
});

reducedMotion.addEventListener('change', applyMotionPreference);
applyMotionPreference();
