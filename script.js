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

const consultationContextStorageKey = "ASBESTOS_CONSULTATION_CONTEXT_V1";
const consultationDiagnosticStorageKey = "ASBESTOS_CHECK_HANDOFF_V1";
const consultationContextMaxAge = 30 * 60 * 1000;
const consultationAllowedIntents = new Set([
  "survey", "cost", "procedure", "construction", "contractor", "local",
  "default", "check", "general"
]);
const consultationAllowedCtaLocations = new Set([
  "article-early", "article-follow-desktop", "article-follow-floating",
  "article-end", "footer", "prefecture", "prefecture-early", "municipality", "check-result",
  "page-end", "other"
]);
const consultationSafeSlug = (value) => (
  typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,95}$/.test(value)
    ? value
    : ""
);
const consultationSafePath = (value) => (
  typeof value === "string" && /^\/asbestos\/(?:[a-z0-9-]+\/)*$/i.test(value)
    ? value
    : ""
);
const consultationSourceForPath = (value) => {
  const sourcePath = consultationSafePath(value);
  if (!sourcePath) return null;
  const segments = sourcePath.split("/").filter(Boolean);
  if (segments[0] !== "asbestos" || segments.length > 4) return null;

  if (segments.length === 1) return { sourcePath, content: "home" };
  if (segments[1] === "column") {
    if (segments.length === 2) return { sourcePath, content: "column" };
    if (segments[2] === "category" && segments.length === 4) {
      return { sourcePath, content: consultationSafeSlug(`category-${segments[3]}`) };
    }
    if (segments.length === 3) return { sourcePath, content: consultationSafeSlug(segments[2]) };
    return null;
  }
  if (segments[1] === "area") {
    if (segments.length === 2) return { sourcePath, content: "area" };
    if (segments.length === 3) return { sourcePath, content: consultationSafeSlug(`area-${segments[2]}`) };
    if (segments.length === 4) return { sourcePath, content: consultationSafeSlug(`area-${segments[2]}-${segments[3]}`) };
    return null;
  }
  if (segments.length === 2 && ["faq", "check"].includes(segments[1])) {
    return { sourcePath, content: segments[1] };
  }
  return null;
};
const clearSessionValue = (key) => {
  try {
    window.sessionStorage.removeItem(key);
  } catch (_error) {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
};
const validateConsultationContext = (value) => {
  if (!value || value.src !== "asbestos_navi") return null;
  const content = consultationSafeSlug(value.content);
  const source = consultationSourceForPath(value.sourcePath);
  if (!content || !consultationAllowedIntents.has(value.intent)
    || !consultationAllowedCtaLocations.has(value.cta)
    || !source || source.content !== content) return null;
  return {
    src: "asbestos_navi",
    content,
    intent: value.intent,
    cta: value.cta,
    sourcePath: source.sourcePath
  };
};
const readConsultationContext = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = validateConsultationContext({
      src: params.get("src"),
      content: params.get("content"),
      intent: params.get("intent"),
      cta: params.get("cta"),
      sourcePath: params.get("path")
    });
    if (fromQuery) return fromQuery;
  } catch (_error) {
    // A malformed query must never be copied into the form.
  }

  try {
    const raw = window.sessionStorage.getItem(consultationContextStorageKey);
    if (!raw || raw.length > 2048) {
      if (raw) clearSessionValue(consultationContextStorageKey);
      return null;
    }
    const stored = JSON.parse(raw);
    const now = Date.now();
    if (stored?.version !== 1 || !Number.isFinite(stored.createdAt)
      || stored.createdAt > now + 60 * 1000
      || now - stored.createdAt > consultationContextMaxAge) {
      clearSessionValue(consultationContextStorageKey);
      return null;
    }
    const context = validateConsultationContext(stored);
    if (!context) clearSessionValue(consultationContextStorageKey);
    return context;
  } catch (_error) {
    clearSessionValue(consultationContextStorageKey);
    return null;
  }
};

const contactForm = document.querySelector(".contact-form");
const consultationContext = readConsultationContext();
if (consultationContext) {
  window.setTimeout(
    () => clearSessionValue(consultationContextStorageKey),
    consultationContextMaxAge + 1000
  );
}

if (contactForm) {
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const defaultButtonText = submitButton ? submitButton.textContent : "";
  const verificationError = contactForm.querySelector(".form-verification-error");
  const telInput = contactForm.querySelector('input[name="tel"]');
  const emailInput = contactForm.querySelector('input[name="email"]');
  const telStatus = contactForm.querySelector('[data-contact-field="tel"] [data-required-status]');
  const emailStatus = contactForm.querySelector('[data-contact-field="email"] [data-required-status]');
  const contactMethodInputs = [...contactForm.querySelectorAll('input[name="contact_method"]')];
  let isSubmitting = false;

  const setRequiredStatus = (input, statusNode, required, label, optional = false) => {
    if (!input || !statusNode) return;
    input.required = required;
    input.setAttribute("aria-required", String(required));
    statusNode.textContent = label;
    statusNode.classList.toggle("optional", optional);
  };

  const syncContactRequirements = () => {
    if (!telInput || !emailInput) return;
    const method = contactMethodInputs.find((input) => input.checked)?.value || "";
    telInput.setCustomValidity("");
    emailInput.setCustomValidity("");

    if (method === "電話") {
      setRequiredStatus(telInput, telStatus, true, "必須");
      setRequiredStatus(emailInput, emailStatus, false, "任意", true);
      return;
    }
    if (method === "メール") {
      setRequiredStatus(telInput, telStatus, false, "任意", true);
      setRequiredStatus(emailInput, emailStatus, true, "必須");
      return;
    }
    if (method === "どちらでも可") {
      setRequiredStatus(telInput, telStatus, false, "どちらか必須");
      setRequiredStatus(emailInput, emailStatus, false, "どちらか必須");
      if (!telInput.value.trim() && !emailInput.value.trim()) {
        telInput.setCustomValidity("電話番号またはメールアドレスのどちらか一方をご入力ください。");
      }
      return;
    }

    // Progressive-enhancement fallback: before a method is selected, retain
    // the original conservative requirement on both fields.
    setRequiredStatus(telInput, telStatus, true, "必須");
    setRequiredStatus(emailInput, emailStatus, true, "必須");
  };

  contactMethodInputs.forEach((input) => input.addEventListener("change", syncContactRequirements));
  telInput?.addEventListener("input", syncContactRequirements);
  emailInput?.addEventListener("input", syncContactRequirements);
  syncContactRequirements();

  if (consultationContext) {
    const hiddenValues = {
      lead_source: consultationContext.src,
      lead_content: consultationContext.content,
      lead_intent: consultationContext.intent,
      lead_cta: consultationContext.cta,
      lead_source_path: consultationContext.sourcePath
    };
    Object.entries(hiddenValues).forEach(([name, value]) => {
      const field = contactForm.querySelector(`input[type="hidden"][name="${name}"]`);
      if (field) field.value = value || "";
    });
  }

  const showVerificationError = (message) => {
    if (!verificationError) return;
    verificationError.textContent = message;
    verificationError.hidden = false;
    verificationError.focus();
  };

  const resetVerification = () => {
    // Tokens are single-use. Keep the enquiry fields, but require a fresh challenge on retry.
    try {
      if (typeof window.grecaptcha?.reset === "function") window.grecaptcha.reset();
    } catch {
      // A blocked or unloaded Google widget must not prevent restoring the submit button.
    }
    contactForm.querySelectorAll('[name="g-recaptcha-response"]').forEach((field) => {
      field.value = "";
    });
  };

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    contactForm.classList.remove("is-sent", "is-error");
    if (verificationError) verificationError.hidden = true;
    syncContactRequirements();

    if (!contactForm.checkValidity()) {
      contactForm.reportValidity();
      return;
    }

    const formData = new FormData(contactForm);
    // This is only a UX check. Netlify must also validate the token server-side.
    if (!String(formData.get("g-recaptcha-response") || "").trim()) {
      const widgetLoaded = !!contactForm.querySelector('.form-verification-widget iframe');
      showVerificationError(widgetLoaded
        ? "「私はロボットではありません」にチェックしてください。認証の有効期限が切れた場合は、もう一度チェックしてください。"
        : "認証を読み込めませんでした。通信環境や広告ブロック設定をご確認のうえページを再読み込みするか、お電話にてお問い合わせください。");
      return;
    }

    isSubmitting = true;
    contactForm.setAttribute("aria-busy", "true");
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "送信中...";
    }

    try {
      const response = await fetch("/", {
        method: "POST",
        // Netlify redirects rejected CAPTCHA submissions back to the form.
        // Do not follow that redirect and mistake the resulting HTML 200 for success.
        redirect: "error",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData).toString(),
      });

      if (!response.ok) {
        throw new Error(`Form submission failed: ${response.status}`);
      }

      contactForm.reset();
      syncContactRequirements();
      contactForm.classList.add("is-sent");
      try {
        contactForm.dispatchEvent(new CustomEvent("sakurai:consultation-result", {
          bubbles: true,
          detail: { status: "success" }
        }));
      } catch {
        // Optional analytics must not change the successful submission state.
      }
    } catch (error) {
      console.error(error);
      contactForm.classList.add("is-error");
      try {
        contactForm.dispatchEvent(new CustomEvent("sakurai:consultation-result", {
          bubbles: true,
          detail: { status: "failure" }
        }));
      } catch {
        // Optional analytics must not interrupt error recovery.
      }
    } finally {
      resetVerification();
      isSubmitting = false;
      contactForm.removeAttribute("aria-busy");
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = defaultButtonText;
      }
    }
  });

  contactForm.addEventListener("sakurai:consultation-result", (event) => {
    if (event.detail?.status !== "success") return;
    clearSessionValue(consultationContextStorageKey);
    clearSessionValue(consultationDiagnosticStorageKey);
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
  "a[href='#contact']:not(.mobile-contact-primary):not(.footer-cta)",
  ".contact-copy",
  24
);

setupMobileCtaScroll(
  ".contact-section .mobile-contact-primary[href='#contact'], .footer-contact .footer-cta[href='#contact']",
  ".contact-form",
  12
);

let cancelInitialMobileContactHashAlignment = () => {};

// Native cross-page fragment navigation places #contact behind the fixed
// mobile header. Align the contact intro exactly like same-page CTA clicks,
// and keep it aligned while responsive assets finish laying out.
const alignInitialMobileContactHash = () => {
  if (
    window.location.hash !== "#contact" ||
    !window.matchMedia("(max-width:640px)").matches
  ) {
    return;
  }

  const target = document.querySelector(".contact-copy");
  if (!target) return;

  let userInterrupted = false;
  let layoutObserver = null;
  const stopAutomaticAlignment = () => {
    userInterrupted = true;
    if (layoutObserver) layoutObserver.disconnect();
  };
  cancelInitialMobileContactHashAlignment = stopAutomaticAlignment;

  ["touchstart", "pointerdown", "wheel", "keydown"].forEach((eventName) => {
    window.addEventListener(eventName, stopAutomaticAlignment, {
      once: true,
      passive: true
    });
  });

  const align = () => {
    if (userInterrupted || window.location.hash !== "#contact") return;

    const scrolledHeaderHeight = 68;
    const targetGap = 24;
    const targetTop = Math.max(
      0,
      getLayoutDocumentTop(target) - scrolledHeaderHeight - targetGap
    );

    window.scrollTo({ top: targetTop, behavior: "auto" });
  };

  const alignAfterLayout = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(align);
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(align).catch(() => {});
    }

    window.setTimeout(() => {
      if (layoutObserver) layoutObserver.disconnect();
    }, 500);
  };

  // Keep the destination pinned while responsive images settle, then stop
  // observing as soon as loading is complete (or the visitor interacts).
  align();
  if ("ResizeObserver" in window) {
    layoutObserver = new ResizeObserver(align);
    layoutObserver.observe(document.body);
  }

  if (document.readyState === "complete") {
    alignAfterLayout();
  } else {
    window.addEventListener("load", alignAfterLayout, { once: true });
  }
};

alignInitialMobileContactHash();

// Carry a short-lived assessment summary from /asbestos/check/ into the
// inquiry form. sessionStorage keeps the handoff in the current tab only.
(() => {
  const storageKey = consultationDiagnosticStorageKey;
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
  let handoffCreatedAt = 0;

  try {
    const raw = window.sessionStorage.getItem(storageKey);

    if (!raw || raw.length > maxRawLength) {
      if (raw) clearSessionValue(storageKey);
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
      clearSessionValue(storageKey);
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
      clearSessionValue(storageKey);
      return;
    }

    handoffCreatedAt = parsed.createdAt;
    handoff = {
      recommendationScore,
      similarity,
      confidence,
      summary: normalizeSingleLine(parsed.result.summary, 160),
      inputs: isRecord(parsed.inputs) ? parsed.inputs : {}
    };
  } catch (_error) {
    handoff = null;
    clearSessionValue(storageKey);
  }

  if (!handoff || !contactForm) return;
  window.setTimeout(() => clearSessionValue(storageKey), Math.max(
    1000,
    maxAgeMilliseconds - (Date.now() - handoffCreatedAt) + 1000
  ));

  // A valid check result intentionally lands on the form, not the intro.
  cancelInitialMobileContactHashAlignment();

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

// Use only an allow-listed topic to provide a short, editable starting point.
// The article slug remains in hidden attribution fields and is never rendered.
(() => {
  if (!contactForm || !consultationContext) return;
  const messageField = contactForm.querySelector("textarea[name='message']");
  if (!messageField || messageField.value.trim()) return;
  const inquiryByIntent = {
    survey: "この建物に必要な調査範囲と分析方法について相談したいです。",
    cost: "この建物のアスベスト調査費用と見積りについて相談したいです。",
    procedure: "アスベスト調査と届出の進め方について相談したいです。",
    construction: "アスベスト調査から工事までの進め方について相談したいです。",
    contractor: "アスベスト調査の依頼先と対応範囲について相談したいです。",
    local: "建物所在地に応じたアスベスト調査と届出について相談したいです。",
    check: "簡易チェック結果をもとに、正式なアスベスト調査について相談したいです。",
    default: "この建物に必要なアスベスト調査について相談したいです。",
    general: "この建物に必要なアスベスト調査について相談したいです。"
  };
  messageField.value = inquiryByIntent[consultationContext.intent] || inquiryByIntent.general;
  messageField.dispatchEvent(new Event("input", { bubbles:true }));
})();
