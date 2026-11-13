/* SAKURAI: opt-in analytics. No Google tag is loaded before valid consent.
 * GA4 enhanced measurement and Google signals must also be disabled in its UI.
 * This module never reads form values, FormData, link text, or document.title.
 */
(() => {
  'use strict';
  if (window.sakuraiAnalytics) return;

  const ORIGIN = 'https://lp.sakuraigr.co.jp';
  const KEY = 'sakurai.analytics-consent.v1';
  const LAYER = 'sakuraiAnalyticsDataLayer';
  const TTL = 180 * 24 * 60 * 60 * 1000;
  const script = document.currentScript;
  const id = script && script.getAttribute('data-measurement-id');
  const validId = typeof id === 'string' && /^G-[A-Z0-9]{6,20}$/.test(id);
  const disableKey = validId ? `ga-disable-${id}` : null;
  const productionHost = window.location.protocol === 'https:' && window.location.hostname === 'lp.sakuraigr.co.jp' && !window.location.port;
  const denied = { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', functionality_storage: 'denied', personalization_storage: 'denied', security_storage: 'denied' };
  const granted = { ...denied, analytics_storage: 'granted' };
  const allowedEvents = new Set([
    'page_view', 'consultation_cta_view', 'consultation_cta_click',
    'consultation_lp_arrival', 'phone_click', 'consultation_form_start',
    'consultation_submit_success', 'consultation_submit_failure', 'generate_lead'
  ]);
  const locations = new Set([
    'article-early', 'article-follow-desktop', 'article-follow-floating',
    'article-end', 'footer', 'prefecture', 'prefecture-early', 'municipality', 'check-result',
    'page-end', 'sticky', 'header', 'hero', 'law', 'checkpoint', 'reason',
    'process', 'cost', 'works', 'faq', 'contact', 'other'
  ]);
  const variants = new Set([
    'survey', 'cost', 'procedure', 'construction', 'contractor', 'local',
    'default', 'check', 'general'
  ]);
  const pageTypes = new Set(['lp', 'home', 'column', 'category', 'article', 'area', 'prefecture', 'municipality', 'faq', 'check', 'other']);
  const contextKey = 'ASBESTOS_CONSULTATION_CONTEXT_V1';
  const contextTtl = 30 * 60 * 1000;
  let consent = { status: 'unknown', expiresAt: 0 };
  let expiryTimer = null;
  let tagStarted = false;
  let tagLoaded = false;
  let configured = false;
  let failed = false;
  let pageViewSent = false;
  let formStarted = false;
  let pendingSubmit = false;
  let lpArrivalSent = false;
  let page = null;
  let canonicalPath = '';
  let landingContext = null;
  const viewedCtas = new WeakSet();
  let ctaObserver = null;
  let contactCtas = [];
  if (disableKey) window[disableKey] = true;

  const safely = (fn) => (...args) => { try { return fn(...args); } catch (_) { return false; } };
  const safeSlug = (value) => typeof value === 'string'
    && /^[a-z0-9][a-z0-9-]{0,95}$/.test(value)
    ? value
    : '';
  const classifyPath = (pathname) => {
    if (pathname === '/') return { page_type: 'lp', content_slug: 'lp' };
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] !== 'asbestos') return { page_type: 'other', content_slug: 'other' };
    if (segments[1] === 'column' && segments[2] === 'category') {
      return { page_type: 'category', content_slug: safeSlug(`category-${segments[3] || 'index'}`) || 'category' };
    }
    if (segments[1] === 'column' && segments[2] === 'ranking') {
      return { page_type: 'column', content_slug: 'ranking' };
    }
    if (segments[1] === 'column' && segments[2]) {
      return { page_type: 'article', content_slug: safeSlug(segments[2]) || 'article' };
    }
    if (segments[1] === 'column') return { page_type: 'column', content_slug: 'column' };
    if (segments[1] === 'area' && segments[3]) {
      return { page_type: 'municipality', content_slug: safeSlug(`area-${segments[2]}-${segments[3]}`) || 'area' };
    }
    if (segments[1] === 'area' && segments[2]) {
      return { page_type: 'prefecture', content_slug: safeSlug(`area-${segments[2]}`) || 'area' };
    }
    if (segments[1] === 'area') return { page_type: 'area', content_slug: 'area' };
    if (segments[1] === 'check') return { page_type: 'check', content_slug: 'check' };
    if (segments[1] === 'faq') return { page_type: 'faq', content_slug: 'faq' };
    return { page_type: 'home', content_slug: 'home' };
  };
  const sanitizeEventDimensions = (dimensions = {}) => {
    const safe = {};
    if (locations.has(dimensions.cta_location)) safe.cta_location = dimensions.cta_location.replace(/-/g, '_');
    if (variants.has(dimensions.cta_variant)) safe.cta_variant = dimensions.cta_variant;
    if (variants.has(dimensions.cta_intent)) safe.cta_intent = dimensions.cta_intent;
    if (pageTypes.has(dimensions.source_page_type)) safe.source_page_type = dimensions.source_page_type;
    const sourceContent = safeSlug(dimensions.source_content_slug);
    if (sourceContent) safe.source_content_slug = sourceContent;
    return safe;
  };
  const removeStoredConsent = () => { try { window.localStorage.removeItem(KEY); } catch (_) {} };
  const readConsent = () => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return { status: 'unknown', expiresAt: 0 };
      const value = JSON.parse(raw);
      const now = Date.now();
      if (value && value.version === 1 && ['granted', 'denied'].includes(value.status)
        && Number.isFinite(value.updatedAt) && Number.isFinite(value.expiresAt)
        && value.updatedAt <= now && value.expiresAt > now
        && value.expiresAt > value.updatedAt && value.expiresAt - value.updatedAt <= TTL) {
        return { status: value.status, expiresAt: value.expiresAt };
      }
    } catch (_) {}
    removeStoredConsent();
    return { status: 'unknown', expiresAt: 0 };
  };
  const clearCookies = () => {
    if (!validId) return;
    // Never enumerate cookie values or delete cookies belonging to other tools.
    for (const name of ['sakurai_ga', `sakurai_ga_${id.slice(2)}`]) {
      for (const domain of ['', '; Domain=lp.sakuraigr.co.jp', '; Domain=.lp.sakuraigr.co.jp']) {
        try { document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure${domain}`; } catch (_) {}
      }
    }
  };
  const command = function () {
    const layer = window[LAYER];
    if (!layer || typeof layer.push !== 'function') throw new Error('Analytics queue unavailable');
    layer.push(arguments);
  };
  const notifyConsent = () => {
    try { document.dispatchEvent(new CustomEvent('sakurai:analytics-consent', { detail: { status: consent.status } })); } catch (_) {}
  };
  const stop = () => {
    if (disableKey) window[disableKey] = true;
    pendingSubmit = false;
    // The disable switch is set before the consent command, including when the
    // vendor script is already present. An already-sent request cannot be undone.
    if (tagStarted) {
      try {
        if (!tagLoaded && Array.isArray(window[LAYER])) window[LAYER].length = 0;
        command('consent', 'update', { ...denied });
      } catch (_) {}
    }
    clearCookies();
  };
  const expire = () => {
    if (consent.status !== 'unknown' && consent.expiresAt <= Date.now()) {
      consent = { status: 'unknown', expiresAt: 0 };
      removeStoredConsent();
      stop();
      notifyConsent();
    }
  };
  const scheduleExpiry = () => {
    if (expiryTimer !== null) window.clearTimeout(expiryTimer);
    expiryTimer = null;
    if (consent.status === 'unknown') return;
    expiryTimer = window.setTimeout(safely(() => {
      expire();
      scheduleExpiry();
    }), Math.min(Math.max(consent.expiresAt - Date.now(), 1), 2147483647));
  };
  const canSend = () => {
    expire();
    return productionHost && !!page && validId && consent.status === 'granted' && tagLoaded && configured && !failed && window[disableKey] === false;
  };
  const send = (eventName, dimensions = {}) => {
    if (!allowedEvents.has(eventName) || !canSend()) return false;
    try {
      const params = { ...page, ...sanitizeEventDimensions(dimensions), send_to: id };
      command('event', eventName, params);
      return true;
    } catch (_) {
      failed = true;
      stop();
      return false;
    }
  };
  const activate = () => {
    expire();
    if (!productionHost || !page || !validId || consent.status !== 'granted' || failed || !tagLoaded) return;
    window[disableKey] = false;
    try {
      command('set', { ...page, allow_google_signals: false, allow_ad_personalization_signals: false, ads_data_redaction: true, url_passthrough: false, send_page_view: false });
      command('consent', 'update', { ...granted });
      if (!configured) {
        command('config', id, {
          ...page,
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          cookie_domain: 'none',
          cookie_path: '/',
          cookie_prefix: 'sakurai',
          cookie_expires: Math.max(1, Math.floor((consent.expiresAt - Date.now()) / 1000)),
          cookie_update: false,
          cookie_flags: 'SameSite=Lax;Secure'
        });
        configured = true;
      }
      if (!pageViewSent) pageViewSent = send('page_view');
      if (landingContext && !lpArrivalSent) {
        lpArrivalSent = send('consultation_lp_arrival', landingContext);
      }
      scanVisibleCtas();
    } catch (_) { failed = true; stop(); }
  };
  const start = () => {
    if (!productionHost || !page || !validId || consent.status !== 'granted' || failed) return;
    if (tagStarted) { if (tagLoaded) activate(); return; }
    // Do not attach to another tag's layer or overwrite a pre-existing queue.
    if (window[LAYER]) { failed = true; return; }
    try {
      window[LAYER] = [];
      command('consent', 'default', { ...denied });
      command('set', {
        ...page, send_page_view: false, allow_google_signals: false,
        allow_ad_personalization_signals: false, ads_data_redaction: true, url_passthrough: false
      });
      command('js', new Date());
      const tag = document.createElement('script');
      tag.async = true;
      tag.referrerPolicy = 'no-referrer';
      tag.src = `https://www.googletagmanager.com/gtag/js?id=${id}&l=${LAYER}`;
      tag.onload = safely(() => { tagLoaded = true; activate(); });
      tag.onerror = safely(() => { failed = true; stop(); });
      tagStarted = true;
      document.head.appendChild(tag);
    } catch (_) { failed = true; stop(); }
  };
  const setConsent = safely((status) => {
    if (status !== 'granted' && status !== 'denied') return false;
    expire();
    if (status === consent.status) return true;
    const updatedAt = Date.now();
    consent = { status, expiresAt: updatedAt + TTL };
    try { window.localStorage.setItem(KEY, JSON.stringify({ version: 1, status, updatedAt, expiresAt: consent.expiresAt })); } catch (_) {}
    if (status === 'denied') stop(); else start();
    scheduleExpiry();
    notifyConsent();
    return true;
  });

  // Accept only the published site's self-canonical static path. There is no
  // fallback to location.href, which could contain an email or search query.
  try {
    const canonicalNode = document.querySelector('link[rel="canonical"]');
    const canonical = new URL(canonicalNode.getAttribute('href'));
    const actual = window.location;
    const normalizedPath = actual.pathname.endsWith('/') ? actual.pathname : `${actual.pathname}/`;
    if (canonical.origin === ORIGIN && !canonical.username && !canonical.password
      && /^\/(?:[a-z0-9-]+\/)*$/i.test(canonical.pathname) && canonical.pathname === normalizedPath) {
      canonicalPath = canonical.pathname;
      const pageInfo = classifyPath(canonicalPath);
      let referrer = '';
      try { const ref = new URL(document.referrer); if (['https:', 'http:'].includes(ref.protocol)) referrer = ref.origin; } catch (_) {}
      page = {
        page_location: `${ORIGIN}${canonical.pathname}`,
        page_referrer: referrer,
        // Keep the URL query-free and the referrer origin-only. Explicit
        // campaign overrides would suppress referrer-based attribution.
        page_title: 'SAKURAI',
        ...pageInfo
      };
    }
  } catch (_) {}

  const inferSourcePageType = (content) => {
    if (content === 'home') return 'home';
    if (content === 'column') return 'column';
    if (content === 'faq') return 'faq';
    if (content === 'check') return 'check';
    if (content.startsWith('category-')) return 'category';
    if (content.startsWith('area-')) return content.split('-').length >= 3 ? 'municipality' : 'prefecture';
    return 'article';
  };
  const sourceForPath = (value) => {
    if (typeof value !== 'string' || !/^\/asbestos\/(?:[a-z0-9-]+\/)*$/i.test(value)) return null;
    const segments = value.split('/').filter(Boolean);
    if (segments[0] !== 'asbestos' || segments.length > 4) return null;
    if (segments.length === 1) return { pageType: 'home', content: 'home' };
    if (segments[1] === 'column') {
      if (segments.length === 2) return { pageType: 'column', content: 'column' };
      if (segments[2] === 'category' && segments.length === 4) {
        return { pageType: 'category', content: safeSlug(`category-${segments[3]}`) };
      }
      if (segments.length === 3 && segments[2] === 'ranking') {
        return { pageType: 'column', content: 'ranking' };
      }
      if (segments.length === 3) return { pageType: 'article', content: safeSlug(segments[2]) };
      return null;
    }
    if (segments[1] === 'area') {
      if (segments.length === 2) return { pageType: 'area', content: 'area' };
      if (segments.length === 3) return { pageType: 'prefecture', content: safeSlug(`area-${segments[2]}`) };
      if (segments.length === 4) return { pageType: 'municipality', content: safeSlug(`area-${segments[2]}-${segments[3]}`) };
      return null;
    }
    if (segments.length === 2 && ['faq', 'check'].includes(segments[1])) {
      return { pageType: segments[1], content: segments[1] };
    }
    return null;
  };
  const validatedLandingContext = (value) => {
    if (!value || value.src !== 'asbestos_navi') return null;
    const content = safeSlug(value.content);
    const source = sourceForPath(value.sourcePath);
    if (!content || !variants.has(value.intent) || !locations.has(value.cta)
      || !source || source.content !== content) return null;
    const sourcePageType = pageTypes.has(source.pageType) ? source.pageType : inferSourcePageType(content);
    return {
      cta_location: value.cta,
      cta_variant: value.intent,
      cta_intent: value.intent,
      source_page_type: sourcePageType,
      source_content_slug: content
    };
  };
  const readLandingContext = () => {
    if (canonicalPath !== '/') return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = validatedLandingContext({
        src: params.get('src'),
        content: params.get('content'),
        intent: params.get('intent'),
        cta: params.get('cta'),
        sourcePath: params.get('path')
      });
      if (fromQuery) return fromQuery;
    } catch (_) {}
    try {
      const raw = window.sessionStorage.getItem(contextKey);
      if (!raw || raw.length > 2048) return null;
      const stored = JSON.parse(raw);
      const now = Date.now();
      if (stored?.version !== 1 || !Number.isFinite(stored.createdAt)
        || stored.createdAt > now + 60000 || now - stored.createdAt > contextTtl) return null;
      return validatedLandingContext(stored);
    } catch (_) {
      return null;
    }
  };
  landingContext = readLandingContext();

  window.sakuraiAnalytics = Object.freeze({
    version: 1,
    setConsent,
    isConfigured: () => !!page && validId,
    getConsent: safely(() => { expire(); return consent.status; })
  });

  const locationFor = (anchor) => {
    const declared = anchor.getAttribute('data-cta-location');
    if (locations.has(declared)) return declared;
    for (const [selector, name] of [
      ['.fixed-cta', 'sticky'], ['.site-header', 'header'], ['.site-footer', 'footer'],
      ['.hero', 'hero'], ['.law-section', 'law'], ['.problem-section', 'checkpoint'],
      ['#reason', 'reason'], ['#flow', 'process'], ['#cost', 'cost'],
      ['#works', 'works'], ['#faq', 'faq'], ['#contact', 'contact']
    ]) { if (anchor.closest(selector)) return name; }
    return 'other';
  };
  const variantFor = (anchor) => {
    const declared = anchor.closest('[data-cta-variant]')?.getAttribute('data-cta-variant');
    if (variants.has(declared)) return declared;
    if (page?.page_type === 'prefecture' || page?.page_type === 'municipality') return 'local';
    if (page?.page_type === 'check') return 'check';
    return 'general';
  };
  const ctaDimensionsFor = (anchor) => {
    const variant = variantFor(anchor);
    return {
      cta_location: locationFor(anchor),
      cta_variant: variant,
      cta_intent: variant
    };
  };
  const isContactDestination = (anchor) => {
    try {
      const url = new URL(anchor.getAttribute('href') || '', window.location.href);
      return url.origin === ORIGIN && url.pathname === '/' && url.hash === '#contact';
    } catch (_) {
      return false;
    }
  };
  const scanVisibleCtas = () => {
    if (!canSend()) return;
    contactCtas.forEach((anchor) => {
      if (viewedCtas.has(anchor)) return;
      const rect = anchor.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0
        && rect.bottom > 0 && rect.right > 0
        && rect.top < window.innerHeight && rect.left < window.innerWidth;
      if (visible && send('consultation_cta_view', ctaDimensionsFor(anchor))) {
        viewedCtas.add(anchor);
        ctaObserver?.unobserve(anchor);
      }
    });
  };
  contactCtas = [...document.querySelectorAll('a[href]')].filter(isContactDestination);
  if ('IntersectionObserver' in window) {
    ctaObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const anchor = entry.target;
        if (!entry.isIntersecting || viewedCtas.has(anchor)) return;
        if (send('consultation_cta_view', ctaDimensionsFor(anchor))) {
          viewedCtas.add(anchor);
          ctaObserver.unobserve(anchor);
        }
      });
    }, { threshold: 0.35 });
    contactCtas.forEach((anchor) => ctaObserver.observe(anchor));
  }
  document.addEventListener('click', safely((event) => {
    if (!event.isTrusted || !canSend()) return;
    const anchor = event.target && event.target.closest && event.target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (typeof href !== 'string') return;
    if (href.startsWith('tel:')) send('phone_click', { cta_location: locationFor(anchor) });
    else if (isContactDestination(anchor)) send('consultation_cta_click', ctaDimensionsFor(anchor));
  }), { capture: true, passive: true });

  const isContactForm = (node) => !!node && typeof node.matches === 'function' && node.matches('form.contact-form');
  const onInput = safely((event) => {
    if (!event.isTrusted || formStarted || !canSend()) return;
    const target = event.target;
    if (!target || !['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
    if (target.getAttribute('type') === 'hidden') return;
    if (target.closest && isContactForm(target.closest('form.contact-form'))) {
      formStarted = send('consultation_form_start', landingContext || {});
    }
  });
  document.addEventListener('input', onInput, { capture: true, passive: true });
  document.addEventListener('change', onInput, { capture: true, passive: true });
  document.addEventListener('submit', safely((event) => {
    if (isContactForm(event.target)) pendingSubmit = !!event.isTrusted && canSend();
  }), { capture: true, passive: true });
  document.addEventListener('sakurai:consultation-result', safely((event) => {
    if (!pendingSubmit || !isContactForm(event.target) || !canSend()) return;
    const status = event.detail && event.detail.status;
    if (status !== 'success' && status !== 'failure') return;
    pendingSubmit = false;
    const dimensions = landingContext || {};
    send(`consultation_submit_${status}`, dimensions);
    if (status === 'success') send('generate_lead', dimensions);
  }));
  window.addEventListener('storage', safely((event) => {
    if (event.key !== KEY && event.key !== null) return;
    consent = readConsent();
    if (consent.status === 'granted') start(); else stop();
    scheduleExpiry();
    notifyConsent();
  }));
  document.addEventListener('visibilitychange', safely(expire));

  consent = readConsent();
  if (consent.status === 'granted') start(); else stop();
  scheduleExpiry();
})();
