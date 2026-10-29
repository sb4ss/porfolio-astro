import { gsap } from 'gsap';

export function initializeCarousel() {
  const root = document.querySelector('.project-carousel');
  if (!root) return;
  const viewport = root.querySelector('.carousel-viewport');
  const track = root.querySelector('.project-track');
  const cards = [...track.querySelectorAll('.card')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { position: 0 };
  let step = 0;
  let gap = 0;
  let viewportWidth = 0;
  const setters = cards.map(card => gsap.quickSetter(card, 'x', 'px'));
  const links = cards.map(card => [...card.querySelectorAll('a')]);
  function render() {
    const wrap = gsap.utils.wrap(-step, step * (cards.length - 1));
    cards.forEach((card, index) => {
      const left = wrap(index * step + state.position);
      setters[index](left - index * step);
      const shown = left + step - gap > 1 && left < viewportWidth - 1;
      if (card.dataset.visible !== String(shown)) {
        card.dataset.visible = String(shown);
        card.setAttribute('aria-hidden', String(!shown));
        links[index].forEach(link => link.tabIndex = shown ? 0 : -1);
      }
    });
  }
  function measure() {
    const oldStep = step;
    gap = parseFloat(getComputedStyle(track).gap);
    viewportWidth = viewport.clientWidth;
    step = cards[0].getBoundingClientRect().width + gap;
    if (oldStep && Math.abs(oldStep - step) > .1) {
      gsap.killTweensOf(state);
      state.position = Math.round(state.position / oldStep) * step;
    }
    render();
  }
  function navigate(direction, instant = false) {
    gsap.killTweensOf(state);
    gsap.to(state, {
      position: (Math.round(state.position / step) + direction) * step,
      duration: motion.matches || instant ? 0 : .25,
      ease: 'power2.out', onUpdate: render,
      onComplete: () => {
        if (document.activeElement?.closest('.card[data-visible="false"]')) {
          root.querySelector('.card[data-visible="true"] a')?.focus({ preventScroll: true });
        }
      },
    });
  }
  root.querySelector('[data-carousel-prev]').addEventListener('click', () => navigate(1));
  root.querySelector('[data-carousel-next]').addEventListener('click', () => navigate(-1));
  root.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      navigate(event.key === 'ArrowLeft' ? 1 : -1, true);
    }
  });
  const resize = new ResizeObserver(measure);
  resize.observe(viewport);
  measure();
  document.addEventListener('astro:before-swap', () => {
    gsap.killTweensOf(state);
    resize.disconnect();
  }, { once: true });
}
