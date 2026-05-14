const galleryImages = [
  '1000005462.webp',
  '1000005534.png',
  '1000005555.png',
  '1000005557.png',
  '1000005559.png',
  '1000005560.jpg',
  '1000005562.png',
  '1000005563.png',
  '1000005564.png',
  '1000005565.png',
  '1000005567.png',
  '1000005572.png',
  '1000005574.jpg',
  '1000005575.png',
  '1000005577.png',
  '1000005580.jpg',
  '1000005581.png',
  '1000005582.png',
  '1000005583.png',
  '1000005584.png',
  '1000005586.png',
  '1000005587.png',
  '1000005588.jpg',
  '1000005589.png',
  '1000005590.png',
  '1000005591.png',
  '1000005592.png',
  '1000005593.png',
  '1000005596.png',
  '1000005597.png',
  '1000005599.png',
  '1000005603.png',
  '1000005609.png',
  '1000005610.png',
  '1000005611.png',
  '1000005613.png',
  '1000005614.png',
  '1000005620.png',
  '1000005688.png',
];

export function initGalleryCarousel() {
  const track = document.querySelector('[data-gallery-track]');
  const stage = document.querySelector('[data-gallery-stage]');
  const modal = document.querySelector('[data-gallery-modal]');
  const modalImage = document.querySelector('[data-gallery-modal-image]');
  const modalCaption = document.querySelector('[data-gallery-modal-caption]');
  const closeButton = document.querySelector('[data-gallery-close]');
  const prevButton = document.querySelector('[data-gallery-prev]');
  const nextButton = document.querySelector('[data-gallery-next]');

  if (!track || !stage) return;

  const sourcePrefix = 'assets/images/gallery/';
  const galleryMeta = galleryImages.map((filename, index) => ({
    filename,
    alt: `Digital art piece ${index + 1}`,
  }));

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const total = galleryMeta.length;
  let activeIndex = 0;
  let autoplayId = null;
  let isHovering = false;
  let isKeyboardActive = false;
  let isModalOpen = false;

  const createCard = (item, index) => {
    const card = document.createElement('article');
    card.className = 'gallery-card';
    card.tabIndex = -1;
    card.dataset.galleryIndex = String(index);
    card.dataset.position = 'hidden';

    const img = document.createElement('img');
    img.src = `${sourcePrefix}${item.filename}`;
    img.alt = item.alt;
    img.loading = index < 5 ? 'eager' : 'lazy';
    card.appendChild(img);

    card.addEventListener('click', () => openPreview(index));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPreview(index);
      }
    });

    return card;
  };

  const cards = galleryMeta.map((item, index) => createCard(item, index));
  cards.forEach((card) => track.appendChild(card));

  const wrapIndex = (index) => (index + total) % total;

  const getRelativeDistance = (index) => {
    let distance = index - activeIndex;
    if (distance > total / 2) distance -= total;
    if (distance < -total / 2) distance += total;
    return distance;
  };

  const setPosition = (card, position) => {
    card.dataset.position = position;
    card.classList.toggle('is-current', position === 'current');
    card.classList.toggle('is-side', position === 'prev' || position === 'next');
    card.classList.toggle('is-far', position === 'far-prev' || position === 'far-next');
    card.classList.toggle('is-hidden', position === 'hidden');
    card.setAttribute('aria-hidden', position === 'hidden' ? 'true' : 'false');
    card.tabIndex = position === 'hidden' ? -1 : 0;
  };

  const updateCarousel = () => {
    cards.forEach((card, index) => {
      const distance = getRelativeDistance(index);
      let position = 'hidden';

      if (distance === 0) {
        position = 'current';
      } else if (distance === -1) {
        position = 'prev';
      } else if (distance === 1) {
        position = 'next';
      } else if (distance === -2) {
        position = 'far-prev';
      } else if (distance === 2) {
        position = 'far-next';
      }

      setPosition(card, position);
    });
  };

  const openPreview = (index) => {
    if (!modal || !modalImage || !modalCaption) return;

    const item = galleryMeta[wrapIndex(index)];
    modalImage.src = `${sourcePrefix}${item.filename}`;
    modalImage.alt = item.alt;
    modalCaption.textContent = item.alt;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gallery-modal-open');
    isModalOpen = true;
    syncAutoplay();
  };

  const closePreview = () => {
    if (!modal || !modalImage || !modalCaption) return;

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    modalImage.removeAttribute('src');
    modalImage.alt = '';
    modalCaption.textContent = '';
    document.body.classList.remove('gallery-modal-open');
    isModalOpen = false;
    syncAutoplay();
  };

  const goTo = (index) => {
    activeIndex = wrapIndex(index);
    updateCarousel();
  };

  const goNext = () => {
    goTo(activeIndex + 1);
  };

  const goPrev = () => {
    goTo(activeIndex - 1);
  };

  const clearAutoplay = () => {
    if (autoplayId !== null) {
      window.clearTimeout(autoplayId);
      autoplayId = null;
    }
  };

  const scheduleAutoplay = () => {
    clearAutoplay();

    if (prefersReducedMotion.matches || isHovering || isKeyboardActive || isModalOpen) {
      return;
    }

    autoplayId = window.setTimeout(() => {
      goNext();
      scheduleAutoplay();
    }, 4200);
  };

  const syncAutoplay = () => {
    scheduleAutoplay();
  };

  prevButton?.addEventListener('click', () => {
    goPrev();
    syncAutoplay();
  });

  nextButton?.addEventListener('click', () => {
    goNext();
    syncAutoplay();
  });

  stage.addEventListener('mouseenter', () => {
    isHovering = true;
    syncAutoplay();
  });

  stage.addEventListener('mouseleave', () => {
    isHovering = false;
    syncAutoplay();
  });

  stage.addEventListener('focusin', () => {
    isKeyboardActive = true;
    syncAutoplay();
  });

  stage.addEventListener('focusout', (event) => {
    if (!stage.contains(event.relatedTarget)) {
      isKeyboardActive = false;
      syncAutoplay();
    }
  });

  closeButton?.addEventListener('click', closePreview);

  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      closePreview();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal?.classList.contains('is-open')) {
      closePreview();
      return;
    }

    if (event.key === 'ArrowLeft' && !modal?.classList.contains('is-open')) {
      goPrev();
      syncAutoplay();
    }

    if (event.key === 'ArrowRight' && !modal?.classList.contains('is-open')) {
      goNext();
      syncAutoplay();
    }
  });

  prefersReducedMotion.addEventListener('change', syncAutoplay);
  document.addEventListener('visibilitychange', syncAutoplay);

  updateCarousel();
  scheduleAutoplay();
}
