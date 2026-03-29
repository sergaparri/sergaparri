export function initUI() {
  const year = document.querySelector('#year');
  const projectCount = document.querySelector('#project-count');
  const projectCards = document.querySelectorAll('.projects-grid .project-card');
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const themeHint = document.querySelector('[data-theme-hint]');
  const themeStorageKey = 'serg-portfolio-theme';

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  if (projectCount) {
    projectCount.textContent = `+${projectCards.length}`;
  }

  const applyTheme = (theme) => {
    const isLight = theme === 'light';

    document.body.classList.toggle('light-mode', isLight);

    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(isLight));
      themeToggle.setAttribute(
        'aria-label',
        isLight ? 'Switch portfolio to dark mode' : 'Switch portfolio to light mode'
      );
    }

    if (themeHint) {
      themeHint.textContent = isLight ? 'Dark mode' : 'Light mode';
    }

    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // Ignore storage failures and keep the selected theme for this session.
    }
  };

  let savedTheme = null;

  try {
    savedTheme = localStorage.getItem(themeStorageKey);
  } catch {
    savedTheme = null;
  }

  const preferredTheme =
    savedTheme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

  applyTheme(preferredTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      applyTheme(document.body.classList.contains('light-mode') ? 'dark' : 'light');
    });
  }
}
