// Mobile navigation toggle
const header = document.getElementById('siteHeader');
const navToggle = document.getElementById('navToggle');

if (navToggle) {
  navToggle.addEventListener('click', () => {
    const isOpen = header.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  document.querySelectorAll('#primaryNav a').forEach((link) => {
    link.addEventListener('click', () => {
      header.classList.remove('nav-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// Scroll-reveal for section headers, cards and price tables
const revealEls = document.querySelectorAll('.reveal');
if (revealEls.length && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i % 4, 3) * 60}ms`;
    io.observe(el);
  });
} else {
  revealEls.forEach((el) => el.classList.add('is-visible'));
}

// Safety net: force-reveal everything after 2.5s regardless, in case an
// element never intersects (e.g. sits above the fold before layout settles).
setTimeout(() => {
  document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => el.classList.add('is-visible'));
}, 2500);

// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Contact form: tries the Azure Function API route first (see /api/contact),
// and falls back to opening the visitor's email client if that route isn't deployed.
const form = document.getElementById('contactForm');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('API not available');
      submitBtn.textContent = 'Message sent';
      form.reset();
    } catch (err) {
      // Fallback: open a pre-filled email so the enquiry is never lost,
      // even before the /api/contact function is wired up to a mail provider.
      const subject = encodeURIComponent(`New enquiry from ${data.firstName || ''} ${data.lastName || ''}`.trim());
      const body = encodeURIComponent(
        `Name: ${data.firstName || ''} ${data.lastName || ''}\nEmail: ${data.email || ''}\nPhone: ${data.phone || ''}\n\n${data.message || ''}`
      );
      window.location.href = `mailto:hello@tehillahdigital.co.uk?subject=${subject}&body=${body}`;
      submitBtn.textContent = originalLabel;
    } finally {
      submitBtn.disabled = false;
      setTimeout(() => { submitBtn.textContent = originalLabel; }, 4000);
    }
  });
}
