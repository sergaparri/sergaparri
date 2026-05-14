import { loadPartials } from './modules/partials.js';
import { initNavigation } from './modules/navigation.js';
import { initRevealAnimations } from './modules/animations.js';
import { initContactForm } from './modules/forms.js';
import { initGalleryCarousel } from './modules/gallery.js';
import { initUI } from './modules/ui.js';

// Entry point for the portfolio.
// Loads reusable HTML sections first, then wires up the interactive behavior.
async function bootstrap() {
  await loadPartials();
  initGalleryCarousel();
  initUI();
  initNavigation();
  initRevealAnimations();
  initContactForm();
}

bootstrap().catch((error) => {
  console.error(error);
});
