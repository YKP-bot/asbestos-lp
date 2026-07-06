// ======================================================
// SAKURAI LP JavaScript
// ヘッダー制御・スクロールアニメーション
// ======================================================

// Header scroll effect
const header = document.querySelector(".site-header");

window.addEventListener("scroll", () => {
  if (window.scrollY > 40) {
    header.classList.add("is-scrolled");
  } else {
    header.classList.remove("is-scrolled");
  }
});


// Scroll reveal animation
const revealItems = document.querySelectorAll(
  ".law-box, .section-heading, .problem-grid, .reason-grid, .flow-grid, .cost-panel, .building-grid, .works-grid, .faq-grid, .contact-grid"
);

revealItems.forEach((item) => {
  item.classList.add("reveal-item");
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold:0.14
});

revealItems.forEach((item) => {
  revealObserver.observe(item);
});