const nav = document.querySelector('.navbar');
const trigger = document.querySelector('.btn-nav');
const closeButton = document.querySelector('.quitnav');
const mobile = window.matchMedia('(max-width: 800px)');

function setNavigation(open, restoreFocus = false) {
  const expanded = mobile.matches && open;
  nav.classList.toggle('navActive', expanded);
  trigger.classList.toggle('active', expanded);
  document.body.classList.toggle('noscroll', expanded);
  trigger.setAttribute('aria-expanded', String(expanded));
  nav.inert = mobile.matches && !expanded;
  if (expanded) closeButton.focus();
  else if (restoreFocus && mobile.matches) trigger.focus();
}

trigger.addEventListener('click', () => {
  setNavigation(!nav.classList.contains('navActive'));
});
closeButton.addEventListener('click', () => setNavigation(false, true));
nav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => setNavigation(false, true));
});
nav.addEventListener('keydown', event => {
  if (!mobile.matches || !nav.classList.contains('navActive')) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    setNavigation(false, true);
  }
  if (event.key === 'Tab') {
    const controls = [...nav.querySelectorAll('a, button')];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
mobile.addEventListener('change', () => setNavigation(false));
setNavigation(false);
