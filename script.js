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
  ".law-box, .section-heading, .problem-grid, .problem-list li, .solution-card, .reason-heading, .reason-card, .reason-cta, .flow-layout, .flow-card, .cost-panel, .cost-info, .works-layout, .works-intro, .stat-card, .faq-grid, .contact-grid"
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

// FAQ accordion animation
document.querySelectorAll(".faq-grid details").forEach((details) => {
  const summary = details.querySelector("summary");

  summary.addEventListener("click", (event) => {
    event.preventDefault();

    if (details.dataset.animating === "true") return;
    details.dataset.animating = "true";

    const startHeight = `${details.offsetHeight}px`;

    if (details.open) {
      const endHeight = `${summary.offsetHeight}px`;
      details.style.height = startHeight;

      requestAnimationFrame(() => {
        details.style.height = endHeight;
        details.classList.add("is-closing");
      });

      window.setTimeout(() => {
        details.open = false;
        details.style.height = "";
        details.classList.remove("is-closing");
        details.dataset.animating = "false";
      }, 320);
      return;
    }

    details.open = true;
    const endHeight = `${details.offsetHeight}px`;
    details.style.height = startHeight;

    requestAnimationFrame(() => {
      details.style.height = endHeight;
    });

    window.setTimeout(() => {
      details.style.height = "";
      details.dataset.animating = "false";
    }, 320);
  });
});
