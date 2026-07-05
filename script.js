// ======================================================
// SAKURAI LP JavaScript
// 軽量アニメーション・ヘッダー制御
// ======================================================

const header = document.querySelector(".site-header");

window.addEventListener("scroll", () => {
  if (window.scrollY > 40) {
    header.classList.add("is-scrolled");
  } else {
    header.classList.remove("is-scrolled");
  }
});

const revealTargets = document.querySelectorAll(
  ".section-heading, .reason-card, .flow-card, .building-grid div, .stat-card, .contact-form, .solution-card, .law-box"
);

revealTargets.forEach((el) => {
  el.classList.add("reveal");
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  },
  {
    threshold: 0.15,
  }
);

revealTargets.forEach((el) => observer.observe(el));