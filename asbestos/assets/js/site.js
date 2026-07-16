const button = document.querySelector('.mobile-nav-button');
const nav = document.querySelector('.seo-nav');

if (button && nav) {
  button.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
    });
  });
}
