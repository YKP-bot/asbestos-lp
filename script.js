// ======================================================
// SAKURAI LP JavaScript
// ヘッダー制御・スクロールアニメーション
// ======================================================

// Header scroll effect
const header = document.querySelector(".site-header");
const mobileMenuButton = document.querySelector(".mobile-menu-button");
const mobileMenu = document.querySelector(".global-nav");

window.addEventListener("scroll", () => {
  if (window.scrollY > 40) {
    header.classList.add("is-scrolled");
  } else {
    header.classList.remove("is-scrolled");
  }
});

if (header && mobileMenuButton && mobileMenu) {
  mobileMenu.id = mobileMenu.id || "global-nav";
  mobileMenuButton.setAttribute("aria-controls", mobileMenu.id);
  mobileMenuButton.setAttribute("aria-expanded", "false");
  mobileMenuButton.setAttribute("aria-label", "メニューを開く");
  mobileMenu.setAttribute("aria-hidden", "true");

  const closeMobileMenu = () => {
    header.classList.remove("is-menu-open");
    mobileMenuButton.setAttribute("aria-expanded", "false");
    mobileMenuButton.setAttribute("aria-label", "メニューを開く");
    mobileMenu.setAttribute("aria-hidden", "true");
  };

  mobileMenuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = header.classList.toggle("is-menu-open");
    mobileMenuButton.setAttribute("aria-expanded", String(isOpen));
    mobileMenuButton.setAttribute("aria-label", isOpen ? "メニューを閉じる" : "メニューを開く");
    mobileMenu.setAttribute("aria-hidden", String(!isOpen));
  });

  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });

  document.addEventListener("click", (event) => {
    if (
      window.matchMedia("(max-width:640px)").matches &&
      header.classList.contains("is-menu-open") &&
      !header.contains(event.target)
    ) {
      closeMobileMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width:640px)").matches) {
      closeMobileMenu();
    }
  });
}


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

const contactForm = document.querySelector(".contact-form");

if (contactForm) {
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const defaultButtonText = submitButton ? submitButton.textContent : "";

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!contactForm.checkValidity()) {
      contactForm.reportValidity();
      return;
    }

    contactForm.classList.remove("is-sent", "is-error");

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "送信中...";
    }

    try {
      const formData = new FormData(contactForm);
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData).toString(),
      });

      if (!response.ok) {
        throw new Error(`Form submission failed: ${response.status}`);
      }

      contactForm.reset();
      contactForm.classList.add("is-sent");
    } catch (error) {
      console.error(error);
      contactForm.classList.add("is-error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = defaultButtonText;
      }
    }
  });
}

// Smartphone navigation: align each section heading below the fixed header.
const mobileAnchorHeadings = {
  "#flow": ".flow-copy .section-kicker",
  "#reason": ".reason-heading .section-kicker",
  "#cost": ".cost-copy .section-kicker",
  "#works": ".works-intro .section-kicker",
  "#faq": ".faq-section .section-heading h2"
};

document.querySelectorAll(".global-nav a[href^='#'], .footer-nav a[href^='#']").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (!window.matchMedia("(max-width:640px)").matches) return;

    const hash = link.getAttribute("href");
    const headingSelector = mobileAnchorHeadings[hash];
    const section = headingSelector ? document.querySelector(hash) : null;
    const heading = section ? section.querySelector(headingSelector) : null;

    if (!heading) return;

    event.preventDefault();

    const scrolledHeaderHeight = 68;
    const headingGap = 36;
    let headingDocumentTop = 0;
    let offsetElement = heading;

    while (offsetElement) {
      headingDocumentTop += offsetElement.offsetTop;
      offsetElement = offsetElement.offsetParent;
    }

    const targetTop = Math.max(
      0,
      headingDocumentTop - scrolledHeaderHeight - headingGap
    );

    window.history.pushState(null, "", hash);
    window.scrollTo({ top:targetTop, behavior:"smooth" });
  });
});

// Smartphone CTA navigation: use separate stops for the contact intro and form.
const getLayoutDocumentTop = (element) => {
  let documentTop = 0;
  let offsetElement = element;

  while (offsetElement) {
    documentTop += offsetElement.offsetTop;
    offsetElement = offsetElement.offsetParent;
  }

  return documentTop;
};

const setupMobileCtaScroll = (selector, targetSelector, targetGap) => {
  document.querySelectorAll(selector).forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!window.matchMedia("(max-width:640px)").matches) return;

      const target = document.querySelector(targetSelector);
      if (!target) return;

      event.preventDefault();

      const scrolledHeaderHeight = 68;
      const targetTop = Math.max(
        0,
        getLayoutDocumentTop(target) - scrolledHeaderHeight - targetGap
      );

      window.history.pushState(null, "", "#contact");
      window.scrollTo({ top:targetTop, behavior:"smooth" });
    });
  });
};

setupMobileCtaScroll(
  ".hero-actions .btn-primary[href='#contact'], .law-button[href='#contact'], .problem-section .solution-card a[href='#contact'], .cost-section .cost-info > a[href='#contact'], .fixed-cta a:first-child[href='#contact']",
  ".contact-copy",
  24
);

setupMobileCtaScroll(
  ".contact-section .mobile-contact-primary[href='#contact'], .footer-contact .footer-cta[href='#contact']",
  ".contact-form",
  12
);
