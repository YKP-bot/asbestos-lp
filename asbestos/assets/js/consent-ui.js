/* Load after analytics.js (both scripts may use defer). No analytics requests originate here. */
(() => {
  'use strict';
  const HOST_ID = 'sakurai-analytics-consent-ui';
  const API_EVENT = 'sakurai:analytics-consent';
  const READY_EVENT = 'sakurai:analytics-ready';

  function initialize() {
    const analytics = window.sakuraiAnalytics;
    if (document.getElementById(HOST_ID) || !document.body || !analytics
      || typeof analytics.getConsent !== 'function' || typeof analytics.setConsent !== 'function'
      || typeof analytics.isConfigured !== 'function') return;
    try { if (!analytics.isConfigured()) return; } catch { return; }

    const readConsent = () => {
      try {
        const status = analytics.getConsent();
        return status === 'granted' || status === 'denied' ? status : 'unknown';
      } catch { return 'unknown'; }
    };
    let consent = readConsent();
    let panelOpen = consent === 'unknown';
    let openedByUser = false;
    let dismissed = false;
    let returnFocus = null;
    let frame = 0;
    let busy = false;
    const host = document.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({mode: 'open'});
    shadow.innerHTML = `
      <style>
        :host { all: initial; position: fixed; inset: 0 auto auto 0; width: 0; height: 0; z-index: 1800; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", "Yu Gothic", Meiryo, sans-serif; color: #0b2f4f; font-size: 14px; line-height: 1.7; text-align: left; direction: ltr; }
        *, *::before, *::after { box-sizing: border-box; }
        [hidden] { display: none !important; }
        .panel { position: fixed; left: var(--consent-left, 12px); bottom: var(--consent-bottom, 12px); width: var(--consent-width, calc(100vw - 24px)); max-width: 440px; max-height: var(--consent-max-height, calc(100vh - 120px)); overflow: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; margin: 0; padding: 18px; border: 1px solid #b6cbd5; border-top: 3px solid #13b5aa; border-radius: 16px; background: #fff; box-shadow: 0 8px 32px rgba(11,47,79,.18); color: #0b2f4f; font: inherit; }
        .heading { display: flex; align-items: flex-start; gap: 12px; }
        h2 { flex: 1; margin: 0; padding: 6px 0 0; font: inherit; font-size: 17px; font-weight: 700; line-height: 1.5; }
        p { margin: 12px 0 0; overflow-wrap: anywhere; }
        button, summary, a { -webkit-tap-highlight-color: transparent; }
        button { appearance: none; -webkit-appearance: none; margin: 0; font: inherit; cursor: pointer; color: #0b2f4f; background: #fff; }
        button:focus-visible, summary:focus-visible, a:focus-visible, h2:focus-visible { outline: 3px solid #0b2f4f; outline-offset: 3px; }
        .close { flex: 0 0 40px; width: 40px; height: 40px; padding: 0; border: 1px solid #b6cbd5; border-radius: 10px; font-size: 26px; line-height: 1; }
        .note { font-size: 13px; color: #314e66; }
        .status { margin-top: 10px; font-size: 13px; font-weight: 600; }
        .actions { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 10px; margin-top: 16px; }
        .choice { min-height: 46px; padding: 10px 8px; border: 1.5px solid #0b2f4f; border-radius: 10px; font-weight: 700; font-size: 14px; line-height: 1.5; }
        .choice:hover, .close:hover { background: #eff9f8; }
        .choice:disabled { cursor: wait; opacity: .65; }
        .error { margin-top: 10px; color: #a31818; font-size: 13px; }
        details { margin-top: 14px; font-size: 13px; color: #314e66; }
        summary { cursor: pointer; padding-block: 3px; color: #0b2f4f; text-decoration: underline; text-underline-offset: 3px; }
        details p { margin-top: 9px; }
        .links { display: grid; gap: 7px; margin: 10px 0 0; padding: 0; list-style: none; }
        a { color: #0b2f4f; text-decoration: underline; text-underline-offset: 3px; overflow-wrap: anywhere; }
        .settings { position: fixed; left: var(--consent-left, 12px); bottom: var(--consent-settings-bottom, 12px); min-height: 40px; padding: 8px 13px; border: 1px solid #b6cbd5; border-radius: 10px; box-shadow: 0 2px 10px rgba(11,47,79,.12); font-size: 12px; font-weight: 600; line-height: 1.5; }
        .settings:hover { background: #eff9f8; }
        @media (max-width: 389px) { .panel { padding: 15px; } h2 { font-size: 16px; } }
        @media (forced-colors: active) { .panel, .settings, .choice, .close { border-color: CanvasText; } }
        @media print { :host { display: none; } }
      </style>
      <section class="panel" role="dialog" aria-modal="false" aria-labelledby="consent-title" aria-describedby="consent-description" hidden>
        <div class="heading">
          <h2 id="consent-title" tabindex="-1">アクセス解析の設定</h2>
          <button class="close" type="button" aria-label="同意せずに設定を閉じる" title="設定を閉じる">×</button>
        </div>
        <p id="consent-description">サイト改善のため、同意した場合のみGoogle AnalyticsでCookie等の識別子、閲覧ページ・操作情報をGoogleに送信します。フォームの入力内容は送信しません。</p>
        <p class="note">拒否してもご利用いただけます。変更・撤回はページ下部の「解析設定」から。</p>
        <p class="status" aria-live="polite" hidden></p>
        <div class="actions">
          <button class="choice" data-consent="denied" type="button">拒否する</button>
          <button class="choice" data-consent="granted" type="button">同意する</button>
        </div>
        <p class="error" role="alert" hidden></p>
        <details>
          <summary>保存期間・Googleの情報の取り扱い</summary>
          <p>解析情報はGoogleに送信されます。氏名・電話番号・メールアドレス・相談本文はアクセス解析へ送信しません。広告には利用しません。</p>
          <p>同意・拒否の選択は、この端末に180日間保存します。共有端末ではご自身の選択を確認してください。解析を拒否・停止する操作は、上の「拒否する」だけで行えます。</p>
          <ul class="links">
            <li><a href="https://policies.google.com/technologies/partner-sites?hl=ja" target="_blank" rel="noopener noreferrer">Googleによるパートナーサイト情報の利用（別タブ）</a></li>
            <li><a href="https://tools.google.com/dlpage/gaoptout?hl=ja" target="_blank" rel="noopener noreferrer">Google Analyticsのブラウザ用オプトアウト（別タブ）</a></li>
          </ul>
        </details>
      </section>
      <button class="settings" type="button" aria-haspopup="dialog" aria-expanded="false" hidden>解析設定</button>
    `;
    const panel = shadow.querySelector('.panel');
    const heading = shadow.querySelector('h2');
    const settings = shadow.querySelector('.settings');
    const close = shadow.querySelector('.close');
    const status = shadow.querySelector('.status');
    const error = shadow.querySelector('.error');
    const choices = [...shadow.querySelectorAll('[data-consent]')];
    document.body.append(host);

    const visibleRect = (element) => {
      if (!element || !element.getClientRects().length) return null;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return null;
      return element.getBoundingClientRect();
    };
    const viewport = () => {
      const v = window.visualViewport;
      return {left: v?.offsetLeft || 0, top: v?.offsetTop || 0, width: v?.width || window.innerWidth, height: v?.height || window.innerHeight};
    };
    const blockers = () => [...document.querySelectorAll('.fixed-cta, .article-follow-cta--floating, .article-reading-tools, .reading-tools, [data-analytics-ui-obstacle]')];
    const bottomClearance = (v, left, width) => {
      let clearance = 12;
      for (const element of blockers()) {
        const rect = visibleRect(element);
        if (!rect || !['fixed','sticky'].includes(getComputedStyle(element).position)) continue;
        const overlapsX = rect.left < left + width && rect.right > left;
        if (overlapsX && rect.top >= v.top + v.height * .4 && rect.top < v.top + v.height && rect.bottom > v.top) {
          clearance = Math.max(clearance, v.top + v.height - rect.top + 12);
        }
      }
      return clearance;
    };
    const isEditing = () => {
      const element = document.activeElement;
      return element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName));
    };
    const isSuppressed = () => {
      const v = viewport();
      return Boolean(document.querySelector('.site-header.is-menu-open, body.is-nav-open, body.nav-open, body.is-search-open, dialog[open]'))
        || (isEditing() && v.height < window.innerHeight * .75);
    };
    const footerInView = (v) => {
      const footer = document.querySelector('.site-footer, .seo-footer, footer');
      if (!footer) return true;
      const rect = visibleRect(footer);
      return Boolean(rect && rect.top < v.top + v.height && rect.bottom > v.top);
    };

    function render() {
      frame = 0;
      const v = viewport();
      const width = Math.min(440, Math.max(0, v.width - 24));
      const left = v.left + (v.width >= 1024 ? v.width - width - 12 : 12);
      const bottom = bottomClearance(v, left, width);
      let top = 12;
      for (const element of document.querySelectorAll('.site-header, .seo-header')) {
        const rect = visibleRect(element);
        if (rect && ['fixed','sticky'].includes(getComputedStyle(element).position) && rect.top <= v.top + 8 && rect.bottom > v.top) {
          top = Math.max(top, rect.bottom - v.top + 12);
        }
      }
      const viewportBottomOffset = Math.max(0, window.innerHeight - v.top - v.height);
      host.style.setProperty('--consent-left', `${left}px`);
      host.style.setProperty('--consent-width', `${width}px`);
      host.style.setProperty('--consent-bottom', `${viewportBottomOffset + bottom}px`);
      host.style.setProperty('--consent-max-height', `${Math.max(0, v.height - top - bottom)}px`);
      const chipWidth = Math.max(86, settings.getBoundingClientRect().width);
      host.style.setProperty('--consent-settings-bottom', `${viewportBottomOffset + bottomClearance(v, left, chipWidth)}px`);
      const suppressed = isSuppressed();
      panel.hidden = !panelOpen || suppressed;
      settings.hidden = panelOpen || suppressed || !footerInView(v);
      settings.setAttribute('aria-expanded', String(panelOpen && !suppressed));
      status.hidden = consent === 'unknown';
      status.textContent = consent === 'granted' ? '現在の設定：同意（アクセス解析を許可）' : consent === 'denied' ? '現在の設定：拒否（アクセス解析は停止中）' : '';
      close.setAttribute('aria-label', consent === 'unknown' ? '同意せずに設定を閉じる' : '現在の設定を変えずに閉じる');
    }
    function scheduleRender() { if (!frame) frame = requestAnimationFrame(render); }
    function openSettings() {
      consent = readConsent();
      returnFocus = shadow.activeElement || document.activeElement;
      panelOpen = true;
      openedByUser = true;
      dismissed = false;
      error.hidden = true;
      render();
      if (!panel.hidden) heading.focus({preventScroll: true});
    }
    function closePanel() {
      const focusTarget = openedByUser ? returnFocus : null;
      panelOpen = false;
      dismissed = true;
      openedByUser = false;
      render();
      if (focusTarget?.isConnected && (focusTarget !== settings || !settings.hidden)) {
        focusTarget.focus({preventScroll: true});
      }
    }
    settings.addEventListener('click', openSettings);
    close.addEventListener('click', closePanel);
    shadow.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && panelOpen) {
        event.preventDefault();
        event.stopPropagation();
        closePanel();
      }
    });
    for (const button of choices) {
      button.addEventListener('click', () => {
        if (busy) return;
        busy = true;
        choices.forEach(choice => { choice.disabled = true; });
        let applied = false;
        try { applied = analytics.setConsent(button.dataset.consent) === true; } catch { /* Fail closed; never assume consent was saved. */ }
        busy = false;
        choices.forEach(choice => { choice.disabled = false; });
        consent = readConsent();
        if (applied) closePanel();
        else {
          error.textContent = '設定を保存できませんでした。もう一度お試しください。';
          error.hidden = false;
          render();
        }
      });
    }
    document.addEventListener(API_EVENT, () => {
      consent = readConsent();
      if (consent === 'unknown' && !dismissed) panelOpen = true;
      else if (consent !== 'unknown' && !openedByUser) panelOpen = false;
      scheduleRender();
    });
    window.addEventListener('resize', scheduleRender, {passive: true});
    window.addEventListener('scroll', scheduleRender, {passive: true});
    window.addEventListener('pageshow', scheduleRender);
    window.visualViewport?.addEventListener('resize', scheduleRender, {passive: true});
    window.visualViewport?.addEventListener('scroll', scheduleRender, {passive: true});
    document.addEventListener('focusin', scheduleRender);
    document.addEventListener('focusout', scheduleRender);
    document.addEventListener('transitionend', (event) => {
      if (event.target instanceof Element && event.target.matches('.fixed-cta, .article-follow-cta--floating, .article-reading-tools, .reading-tools')) scheduleRender();
    });
    if ('MutationObserver' in window) {
      const observed = new WeakSet();
      const observeObstacles = () => {
        for (const element of document.querySelectorAll('.site-header, .seo-header, .article-follow-cta--floating, .article-reading-tools, .reading-tools')) {
          if (!observed.has(element)) {
            observed.add(element);
            observer.observe(element, {attributes: true, attributeFilter: ['class','style']});
          }
        }
      };
      const observer = new MutationObserver(() => { observeObstacles(); scheduleRender(); });
      observer.observe(document.body, {attributes: true, attributeFilter: ['class'], childList: true});
      observeObstacles();
    }
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(scheduleRender);
      for (const element of document.querySelectorAll('.site-header, .seo-header, .fixed-cta, .article-follow-cta--floating')) observer.observe(element);
    }
    window.sakuraiConsentUI = Object.freeze({open: openSettings, close: closePanel});
    render(); // Intentionally no initial focus transfer, scroll lock, backdrop or modal trap.
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once: true});
  else initialize();
  document.addEventListener(READY_EVENT, initialize, {once: true});
})();
