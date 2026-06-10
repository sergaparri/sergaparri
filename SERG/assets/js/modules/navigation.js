export function initNavigation() {
  const menuToggle = document.querySelector('.menu-toggle');
  const siteNav = document.querySelector('.site-nav');
  const navClose = document.querySelector('[data-nav-close]');
  const navLinks = document.querySelectorAll('.site-nav a');

  if (!menuToggle || !siteNav) return;

  function closeMenu() {
    siteNav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  }

  menuToggle.addEventListener('click', () => {
    const isOpen = siteNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('menu-open', isOpen);
  });

  navClose?.addEventListener('click', closeMenu);

  navLinks.forEach((link) => link.addEventListener('click', closeMenu));

  document.addEventListener('click', (event) => {
    if (!siteNav.contains(event.target) && !menuToggle.contains(event.target)) {
      closeMenu();
    }
  });

  siteNav.addEventListener('click', (event) => {
    if (event.target === siteNav) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && siteNav.classList.contains('open')) {
      closeMenu();
    }
  });

  const sections = document.querySelectorAll('section[id]');
  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          navLinks.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
          });
        });
      },
      { threshold: 0.45 }
    );

    sections.forEach((section) => navObserver.observe(section));
  }
}
