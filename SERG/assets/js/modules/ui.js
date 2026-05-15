const THEME_STORAGE_KEY = 'serg-portfolio-theme';

function setTextContent(selector, value) {
  const node = document.querySelector(selector);

  if (node) {
    node.textContent = value;
  }
}

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures and keep the selected theme for this session.
  }
}

function getPreferredTheme() {
  const savedTheme = readStoredTheme();

  if (savedTheme) {
    return savedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme, themeToggle, themeHint) {
  const isLight = theme === 'light';

  document.body.classList.toggle('light-mode', isLight);

  if (themeToggle) {
    themeToggle.setAttribute('aria-pressed', String(isLight));
    themeToggle.setAttribute(
      'aria-label',
      isLight ? 'Switch portfolio to dark mode' : 'Switch portfolio to light mode'
    );
    themeToggle.dataset.themeState = isLight ? 'light' : 'dark';
  }

  if (themeHint) {
    themeHint.textContent = isLight ? 'Dark mode' : 'Light mode';
  }

  writeStoredTheme(theme);
}

export function initUI() {
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const themeHint = document.querySelector('[data-theme-hint]');

  setTextContent('#year', new Date().getFullYear());
  setTextContent('#project-count', `+${document.querySelectorAll('.projects-grid .project-card').length}`);

  applyTheme(getPreferredTheme(), themeToggle, themeHint);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      applyTheme(document.body.classList.contains('light-mode') ? 'dark' : 'light', themeToggle, themeHint);
    });
  }
}
