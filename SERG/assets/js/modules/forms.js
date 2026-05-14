export function initContactForm() {
  const contactForm = document.querySelector('#contact-form');
  if (!contactForm) return;

  const statusEl = document.querySelector('#contact-status');
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const defaultButtonLabel = submitButton?.textContent?.trim() || 'Send';
  let successResetTimer = null;

  const EMAILJS_SERVICE_ID = 'service_serg';
  const EMAILJS_TEMPLATE_ID = 'template_3htr47p';
  const EMAILJS_PUBLIC_KEY = 'Avc_Or8vNP7ouf8ir';

  if (window.emailjs) {
    window.emailjs.init({
      publicKey: EMAILJS_PUBLIC_KEY,
    });
  }

  const setStatus = (message, type = '') => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.state = type;
  };

  const playSuccessAnimation = () => {
    if (!statusEl) return;

    clearTimeout(successResetTimer);
    statusEl.classList.remove('is-success-pulse');
    statusEl.offsetHeight;
    statusEl.classList.add('is-success-pulse');
    successResetTimer = window.setTimeout(() => {
      statusEl.classList.remove('is-success-pulse');
    }, 1400);
  };

  const sanitizeText = (value) =>
    String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ');

  const stripHtml = (value) =>
    sanitizeText(value).replace(/<[^>]*>/g, '');

  const setSubmitting = (isSubmitting) => {
    if (!submitButton) return;

    submitButton.disabled = isSubmitting;
    submitButton.dataset.loading = isSubmitting ? 'true' : 'false';
    submitButton.textContent = isSubmitting ? 'Sending...' : defaultButtonLabel;
  };

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!window.emailjs) {
      setStatus('EmailJS failed to load. Check the CDN script.', 'error');
      return;
    }

    const payload = {
      name: stripHtml(contactForm.elements.name?.value),
      email: stripHtml(contactForm.elements.email?.value),
      subject: stripHtml(contactForm.elements.subject?.value),
      message: stripHtml(contactForm.elements.message?.value),
    };

    if (!payload.name || !payload.email || !payload.subject || !payload.message) {
      setStatus('Please fill in all fields.', 'error');
      return;
    }

    setSubmitting(true);

    setStatus('Sending message...', 'loading');

    try {
      await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        payload,
        {
          publicKey: EMAILJS_PUBLIC_KEY,
        }
      );

      contactForm.reset();
      setStatus('Message sent successfully.', 'success');
      playSuccessAnimation();
    } catch (error) {
      console.error('EmailJS error:', error);
      setStatus('Failed to send message. Check your EmailJS IDs.', 'error');
    } finally {
      setSubmitting(false);
    }
  });
}
