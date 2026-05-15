export async function loadPartials() {
  const placeholders = Array.from(document.querySelectorAll('[data-include]'));

  const results = await Promise.allSettled(
    placeholders.map(async (placeholder) => {
      const path = placeholder.getAttribute('data-include');
      const response = await fetch(path);

      if (!response.ok) {
        throw new Error(`Failed to load partial: ${path}`);
      }

      placeholder.outerHTML = await response.text();
    })
  );

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error(result.reason);
    }
  });
}
