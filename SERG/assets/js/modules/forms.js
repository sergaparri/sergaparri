const CONTACT_ENDPOINT = '/api/contact';
const EMAILJS_SERVICE_ID = 'service_serg';
const EMAILJS_TEMPLATE_ID = 'template_3htr47p';
const EMAILJS_PUBLIC_KEY = 'Avc_Or8vNP7ouf8ir';
const MIN_SUBMIT_DELAY_MS = 1500;
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 254;
const MAX_SUBJECT_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 2000;

function normalizeText(value, { preserveNewlines = false, maxLength = Infinity } = {}) {
  let text = String(value ?? '').normalize('NFKC');

  if (preserveNewlines) {
    text = text
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    text = text
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();
  } else {
    text = text
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (Number.isFinite(maxLength)) {
    text = text.slice(0, maxLength);
  }

  return text;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}

function isLikelyEmail(value) {
  if (!value || value.length > MAX_EMAIL_LENGTH) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(value);
}

function isLikelyName(value) {
  return /^[\p{L}\p{M}\p{N}\s.'-]{2,80}$/u.test(value);
}

function getField(form, name) {
  return form.elements.namedItem(name);
}

function clearFieldErrors(form) {
  ['name', 'email', 'subject', 'message'].forEach((fieldName) => {
    const field = getField(form, fieldName);
    if (field) field.setCustomValidity('');
  });
}

function setFieldError(field, message) {
  if (!field) return;
  field.setCustomValidity(message);
}

function buildPayload(form) {
  const name = normalizeText(getField(form, 'name')?.value, { maxLength: MAX_NAME_LENGTH });
  const email = normalizeText(getField(form, 'email')?.value, { maxLength: MAX_EMAIL_LENGTH });
  const subject = normalizeText(getField(form, 'subject')?.value, { maxLength: MAX_SUBJECT_LENGTH });
  const message = normalizeText(getField(form, 'message')?.value, {
    preserveNewlines: true,
    maxLength: MAX_MESSAGE_LENGTH,
  });
  const website = normalizeText(getField(form, 'website')?.value, { maxLength: 120 });
  const formStartedAt = Number(getField(form, 'form_started_at')?.value || 0);

  return {
    name,
    email,
    subject,
    message,
    website,
    formStartedAt,
  };
}

function validatePayload(form, payload) {
  clearFieldErrors(form);

  const nameField = getField(form, 'name');
  const emailField = getField(form, 'email');
  const subjectField = getField(form, 'subject');
  const messageField = getField(form, 'message');

  let isValid = true;

  if (!payload.name) {
    setFieldError(nameField, 'Please enter your name.');
    isValid = false;
  } else if (!isLikelyName(payload.name)) {
    setFieldError(nameField, 'Name can only use letters, numbers, spaces, apostrophes, periods, and hyphens.');
    isValid = false;
  }

  if (!payload.email) {
    setFieldError(emailField, 'Please enter your email address.');
    isValid = false;
  } else if (!isLikelyEmail(payload.email)) {
    setFieldError(emailField, 'Please enter a valid email address.');
    isValid = false;
  }

  if (!payload.subject) {
    setFieldError(subjectField, 'Please enter a subject.');
    isValid = false;
  } else if (payload.subject.length < 2) {
    setFieldError(subjectField, 'Subject must be at least 2 characters long.');
    isValid = false;
  }

  if (!payload.message) {
    setFieldError(messageField, 'Please enter a message.');
    isValid = false;
  } else if (payload.message.length < 10) {
    setFieldError(messageField, 'Message must be at least 10 characters long.');
    isValid = false;
  }

  if (payload.name.length > MAX_NAME_LENGTH) {
    setFieldError(nameField, `Name must be ${MAX_NAME_LENGTH} characters or fewer.`);
    isValid = false;
  }

  if (payload.subject.length > MAX_SUBJECT_LENGTH) {
    setFieldError(subjectField, `Subject must be ${MAX_SUBJECT_LENGTH} characters or fewer.`);
    isValid = false;
  }

  if (payload.message.length > MAX_MESSAGE_LENGTH) {
    setFieldError(messageField, `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
    isValid = false;
  }

  return isValid;
}

function toTransportPayload(payload) {
  return {
    name: escapeHtml(payload.name),
    email: escapeHtml(payload.email),
    subject: escapeHtml(payload.subject),
    message: escapeHtml(payload.message),
    reply_to: escapeHtml(payload.email),
  };
}

function setStatus(statusEl, message, type = '') {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.state = type;
}

function setSubmitting(button, isSubmitting) {
  if (!button) return;
  const defaultLabel = button.dataset.defaultLabel || button.textContent?.trim() || 'Send';
  button.disabled = isSubmitting;
  button.dataset.loading = isSubmitting ? 'true' : 'false';
  button.textContent = isSubmitting ? 'Sending...' : defaultLabel;
  button.dataset.defaultLabel = defaultLabel;
}

async function readJsonSafely(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function sendToBackend(payload, signal) {
  const response = await fetch(CONTACT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
    signal,
  });

  const data = await readJsonSafely(response);

  if (!response.ok) {
    const error = new Error(data?.error || 'Your message could not be sent right now.');
    error.status = response.status;
    error.details = data?.details;
    throw error;
  }

  return data;
}

async function sendThroughEmailJs(payload) {
  if (!window.emailjs) {
    throw new Error('EmailJS is not available.');
  }

  return window.emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    toTransportPayload(payload),
    {
      publicKey: EMAILJS_PUBLIC_KEY,
    }
  );
}

function shouldFallbackToEmailJs(error) {
  return (
    !error ||
    error.name === 'TypeError' ||
    error.name === 'AbortError' ||
    error.status === 404 ||
    error.status === 405 ||
    error.status >= 500
  );
}

export function initContactForm() {
  const contactForm = document.querySelector('#contact-form');
  if (!contactForm) return;

  const statusEl = document.querySelector('#contact-status');
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const startedAtField = getField(contactForm, 'form_started_at');

  if (startedAtField && !startedAtField.value) {
    startedAtField.value = String(Date.now());
  }

  let activeRequest = null;

  contactForm.addEventListener('focusin', () => {
    if (startedAtField && !startedAtField.value) {
      startedAtField.value = String(Date.now());
    }
  });

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (activeRequest) {
      return;
    }

    const payload = buildPayload(contactForm);
    const hiddenTrapFilled = Boolean(payload.website);
    const submissionAgeMs = Number.isFinite(payload.formStartedAt)
      ? Date.now() - payload.formStartedAt
      : Infinity;

    if (hiddenTrapFilled) {
      contactForm.reset();
      if (startedAtField) startedAtField.value = String(Date.now());
      setStatus(statusEl, 'Thanks, your message was processed.', 'success');
      return;
    }

    if (submissionAgeMs < MIN_SUBMIT_DELAY_MS) {
      setStatus(statusEl, 'Please take a moment before sending again.', 'error');
      return;
    }

    if (!validatePayload(contactForm, payload)) {
      setStatus(statusEl, 'Please fix the highlighted fields and try again.', 'error');
      contactForm.reportValidity();
      return;
    }

    const controller = new AbortController();
    activeRequest = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    setSubmitting(submitButton, true);
    setStatus(statusEl, 'Sending message...', 'loading');

    try {
      await sendToBackend(payload, controller.signal);

      contactForm.reset();
      if (startedAtField) startedAtField.value = String(Date.now());
      setStatus(statusEl, 'Message sent successfully.', 'success');
    } catch (error) {
      if (shouldFallbackToEmailJs(error)) {
        try {
          await sendThroughEmailJs(payload);

          contactForm.reset();
          if (startedAtField) startedAtField.value = String(Date.now());
          setStatus(statusEl, 'Message sent successfully.', 'success');
          return;
        } catch (fallbackError) {
          console.error('EmailJS fallback error:', fallbackError);
        }
      } else if (error?.status === 429) {
        setStatus(statusEl, error.message || 'You are sending messages too quickly. Please wait and try again.', 'error');
        return;
      } else if (error?.status >= 400 && error?.status < 500) {
        setStatus(statusEl, error.message || 'Please check your message and try again.', 'error');
        return;
      }

      console.error('Contact form submission error:', error);
      setStatus(statusEl, 'Message service temporarily unavailable. Please try again later.', 'error');
    } finally {
      window.clearTimeout(timeoutId);
      activeRequest = null;
      setSubmitting(submitButton, false);
    }
  });
}
