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
const params = new URLSearchParams(window.location.search);

if (contactForm) {
  const sendStatus = params.get("sent");

  if (sendStatus === "1") {
    contactForm.classList.add("is-sent");
  } else if (sendStatus === "0") {
    contactForm.classList.add("is-error");
  }
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

// Carry a short-lived assessment summary from /asbestos/check/ into the
// inquiry form. sessionStorage keeps the handoff in the current tab only.
(() => {
  const storageKey = "ASBESTOS_CHECK_HANDOFF_V1";
  const maxRawLength = 8192;
  const maxAgeMilliseconds = 10 * 60 * 1000;
  const allowedSimilarity = new Set(["低", "中", "高", "判定不能"]);
  const allowedConfidence = new Set(["低", "中", "高"]);
  const inputLabels = {
    constructionYear: "建築年・施工年",
    renovationYear: "改修年",
    location: "撮影部位・建材種類",
    environment: "屋内・屋外",
    workPlan: "工事予定",
    productInfo: "メーカー・製品情報"
  };

  const isRecord = (value) => (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );

  const normalizeSingleLine = (value, maxLength) => {
    if (typeof value !== "string") return "";

    return value
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  };

  let handoff = null;

  try {
    const raw = window.sessionStorage.getItem(storageKey);

    if (!raw || raw.length > maxRawLength) {
      return;
    }

    const parsed = JSON.parse(raw);
    const now = Date.now();

    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      parsed.source !== "asbestos-check" ||
      !Number.isFinite(parsed.createdAt) ||
      parsed.createdAt > now + 60 * 1000 ||
      now - parsed.createdAt > maxAgeMilliseconds ||
      !isRecord(parsed.result)
    ) {
      return;
    }

    const recommendationScore = parsed.result.recommendationScore;
    const similarity = parsed.result.similarity;
    const confidence = parsed.result.confidence;
    const isScoreValid = (
      recommendationScore === null ||
      (
        Number.isInteger(recommendationScore) &&
        recommendationScore >= 1 &&
        recommendationScore <= 5
      )
    );

    if (
      !isScoreValid ||
      !allowedSimilarity.has(similarity) ||
      !allowedConfidence.has(confidence)
    ) {
      return;
    }

    handoff = {
      recommendationScore,
      similarity,
      confidence,
      summary: normalizeSingleLine(parsed.result.summary, 160),
      inputs: isRecord(parsed.inputs) ? parsed.inputs : {}
    };
  } catch (_error) {
    handoff = null;
  } finally {
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch (_error) {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }

  if (!handoff || !contactForm) return;

  const messageField = contactForm.querySelector("textarea[name='message']");
  if (!messageField) return;

  const scoreText = handoff.recommendationScore === null
    ? "判定不能"
    : [
      ...Array(handoff.recommendationScore).fill("⚠"),
      ...Array(5 - handoff.recommendationScore).fill("△")
    ].join(" ");

  const summaryLines = [
    "【アスベスト調査推奨度チェック結果】",
    `調査推奨度：${scoreText}`,
    `画像上の類似度：${handoff.similarity}`,
    `判定の確信度：${handoff.confidence}`
  ];

  if (handoff.summary) {
    summaryLines.push("", handoff.summary);
  }

  const suppliedInputs = Object.entries(inputLabels)
    .map(([key, label]) => {
      const value = normalizeSingleLine(handoff.inputs[key], 120);
      return value && value !== "わからない" ? `${label}：${value}` : "";
    })
    .filter(Boolean);

  if (suppliedInputs.length > 0) {
    summaryLines.push("", "【入力情報】", ...suppliedInputs);
  }

  summaryLines.push("", "※写真は問い合わせフォームへ引き継がれていません。");

  const assessmentSummary = summaryLines.join("\n");
  const existingMessage = messageField.value.trim();
  messageField.value = existingMessage
    ? `${assessmentSummary}\n\n${existingMessage}`
    : assessmentSummary;
  messageField.dispatchEvent(new Event("input", { bubbles:true }));

  const moveToForm = () => {
    const headerOffset = window.matchMedia("(max-width:640px)").matches ? 80 : 24;
    const targetTop = Math.max(
      0,
      window.scrollY + contactForm.getBoundingClientRect().top - headerOffset
    );
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    window.history.replaceState(null, "", "#contact");
    window.scrollTo({
      top:targetTop,
      behavior:prefersReducedMotion ? "auto" : "smooth"
    });

    window.requestAnimationFrame(() => {
      try {
        messageField.focus({ preventScroll:true });
      } catch (_error) {
        messageField.focus();
      }
    });
  };

  if (document.readyState === "complete") {
    window.requestAnimationFrame(moveToForm);
  } else {
    window.addEventListener("load", () => {
      window.requestAnimationFrame(moveToForm);
    }, { once:true });
  }
})();
