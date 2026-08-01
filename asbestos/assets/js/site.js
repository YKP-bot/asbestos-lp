const button = document.querySelector('.mobile-nav-button');
const nav = document.querySelector('.seo-nav');
const navCategoryMenu = document.querySelector('.nav-category-menu');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const preferredScrollBehavior = () => reducedMotionQuery.matches ? 'auto' : 'smooth';

const applyMotionPreference = () => {
  document.documentElement.style.scrollBehavior = reducedMotionQuery.matches ? 'auto' : '';
};

applyMotionPreference();
reducedMotionQuery.addEventListener?.('change', applyMotionPreference);

if (button && nav) {
  const navOverlay = document.createElement('button');
  navOverlay.className = 'mobile-nav-overlay';
  navOverlay.type = 'button';
  navOverlay.hidden = true;
  navOverlay.setAttribute('aria-label', 'メニューを閉じる');
  document.body.append(navOverlay);

  let navIsOpen = false;

  const navFocusableItems = () => [...nav.querySelectorAll('a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')]
    .filter((item) => !item.hidden && item.getClientRects().length);

  const closeMobileNav = ({ restoreFocus = false } = {}) => {
    if (!navIsOpen) return;
    navIsOpen = false;
    navCategoryMenu?.removeAttribute('open');
    nav.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    navOverlay.hidden = true;
    document.body.classList.remove('is-nav-open', 'nav-open');
    if (restoreFocus && button.isConnected) button.focus({ preventScroll: true });
  };

  const openMobileNav = () => {
    if (navIsOpen) return;
    navIsOpen = true;
    nav.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    navOverlay.hidden = false;
    document.body.classList.add('is-nav-open', 'nav-open');
    window.requestAnimationFrame(() => navFocusableItems()[0]?.focus({ preventScroll: true }));
  };

  button.addEventListener('click', () => {
    if (navIsOpen) closeMobileNav({ restoreFocus: true });
    else openMobileNav();
  });

  navOverlay.addEventListener('click', () => closeMobileNav({ restoreFocus: true }));

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      closeMobileNav();
    });
  });

  document.addEventListener('click', (event) => {
    if (navIsOpen && !nav.contains(event.target) && !button.contains(event.target) && event.target !== navOverlay) {
      closeMobileNav({ restoreFocus: true });
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!navIsOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMobileNav({ restoreFocus: true });
      return;
    }

    if (event.key !== 'Tab') return;
    const focusableItems = navFocusableItems();
    if (!focusableItems.length) {
      event.preventDefault();
      button.focus();
      return;
    }

    const firstItem = focusableItems[0];
    const lastItem = focusableItems.at(-1);
    if (event.shiftKey && document.activeElement === firstItem) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault();
      firstItem.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (navIsOpen && getComputedStyle(button).display === 'none') closeMobileNav();
  }, { passive: true });
}

if (navCategoryMenu) {
  document.addEventListener('click', (event) => {
    if (navCategoryMenu.open && !navCategoryMenu.contains(event.target)) {
      navCategoryMenu.removeAttribute('open');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') navCategoryMenu.removeAttribute('open');
  });
}

const categoryButtons = [...document.querySelectorAll('[data-column-category]')];
const articleGrid = document.querySelector('#columnArticleGrid');

if (categoryButtons.length && articleGrid) {
  const articleCards = [...articleGrid.querySelectorAll('.media-card')];
  const heading = document.querySelector('#columnResultHeading');
  const empty = document.querySelector('#columnEmpty');
  articleCards.forEach((card, index) => { card.dataset.originalOrder = String(index); });

  const categoriesFor = (card) => {
    try { return JSON.parse(card.dataset.categories || '[]'); }
    catch { return [card.dataset.mainCategory].filter(Boolean); }
  };

  const selectCategory = (requestedCategory, updateUrl = true) => {
    const available = categoryButtons.map((item) => item.dataset.columnCategory);
    const category = available.includes(requestedCategory) ? requestedCategory : 'すべて';
    categoryButtons.forEach((item) => {
      const current = item.dataset.columnCategory === category;
      item.classList.toggle('is-current', current);
      item.setAttribute('aria-pressed', String(current));
    });

    const matching = articleCards.filter((card) => category === 'すべて' || categoriesFor(card).includes(category));
    const matchingSet = new Set(matching);
    matching.sort((a, b) => {
      if (category !== 'すべて') {
        const primaryDifference = Number(b.dataset.mainCategory === category) - Number(a.dataset.mainCategory === category);
        if (primaryDifference) return primaryDifference;
      }
      return Number(a.dataset.originalOrder) - Number(b.dataset.originalOrder);
    });
    matching.forEach((card) => articleGrid.append(card));
    articleCards.forEach((card) => { card.hidden = !matchingSet.has(card); });
    if (heading) heading.textContent = category === 'すべて' ? '注目の記事' : `${category}の記事`;
    if (empty) empty.hidden = matching.length > 0;

    if (updateUrl) {
      const url = new URL(window.location.href);
      if (category === 'すべて') url.searchParams.delete('category');
      else url.searchParams.set('category', category);
      window.history.replaceState({}, '', url);
    }
  };

  categoryButtons.forEach((item) => item.addEventListener('click', () => selectCategory(item.dataset.columnCategory)));
  selectCategory(new URL(window.location.href).searchParams.get('category') || 'すべて', false);
}

const categorySortControls = document.querySelector('[data-category-sort-controls]');
const categoryArticleGrid = document.querySelector('[data-category-article-grid]');

if (categorySortControls && categoryArticleGrid) {
  const sortButtons = [...categorySortControls.querySelectorAll('[data-category-sort]')];
  const categoryCards = [...categoryArticleGrid.querySelectorAll('[data-category-sort-card]')];
  const categorySortStatus = document.querySelector('[data-category-sort-status]');

  const applyCategorySort = (requestedMode, updateUrl = true) => {
    const mode = requestedMode === 'latest' ? 'latest' : 'relevance';
    const sortedCards = [...categoryCards].sort((a, b) => {
      if (mode === 'latest') {
        const publishedDifference = String(b.dataset.published || '').localeCompare(String(a.dataset.published || ''));
        const modifiedDifference = String(b.dataset.modified || '').localeCompare(String(a.dataset.modified || ''));
        if (publishedDifference || modifiedDifference) return publishedDifference || modifiedDifference;
      }
      return Number(a.dataset.relevanceOrder) - Number(b.dataset.relevanceOrder);
    });

    sortedCards.forEach((card) => categoryArticleGrid.append(card));
    categoryArticleGrid.dataset.activeSort = mode;
    sortButtons.forEach((button) => {
      const current = button.dataset.categorySort === mode;
      button.classList.toggle('is-current', current);
      button.setAttribute('aria-pressed', String(current));
    });
    if (categorySortStatus) categorySortStatus.textContent = `${mode === 'latest' ? '新着順' : '関連度順'}で表示しています。`;

    if (updateUrl) {
      const url = new URL(window.location.href);
      if (mode === 'latest') url.searchParams.set('sort', 'latest');
      else url.searchParams.delete('sort');
      window.history.replaceState({}, '', url);
    }
  };

  sortButtons.forEach((button) => {
    button.addEventListener('click', () => applyCategorySort(button.dataset.categorySort));
  });
  applyCategorySort(new URL(window.location.href).searchParams.get('sort'), false);
}

const siteSearchDialog = document.querySelector('#site-search-dialog');
const siteSearchTriggers = [...document.querySelectorAll('[data-search-open]')];

if (siteSearchDialog && siteSearchTriggers.length) {
  const searchForm = siteSearchDialog.querySelector('.site-search-form');
  const searchInput = siteSearchDialog.querySelector('#site-search-input');
  const searchClose = siteSearchDialog.querySelector('[data-search-close]');
  const searchSuggestions = siteSearchDialog.querySelector('[data-search-suggestions]');
  const searchStatus = siteSearchDialog.querySelector('#site-search-status');
  const searchResults = siteSearchDialog.querySelector('#site-search-results');
  const suggestionButtons = [...siteSearchDialog.querySelectorAll('[data-search-suggestion]')];
  let searchIndexPromise;
  let lastSearchTrigger;
  let searchTimer;
  let searchSequence = 0;

  const normalizeSearchText = (value) => String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ja-JP')
    .replace(/\s+/g, ' ')
    .trim();

  const loadSearchIndex = () => {
    if (!searchIndexPromise) {
      searchIndexPromise = fetch(siteSearchDialog.dataset.searchIndex, { credentials: 'same-origin' })
        .then((response) => {
          if (!response.ok) throw new Error(`検索データを取得できませんでした（${response.status}）`);
          return response.json();
        })
        .then((items) => items.map((item) => ({
          ...item,
          searchTitle: normalizeSearchText(item.title),
          searchDescription: normalizeSearchText(item.description),
          searchCategories: normalizeSearchText((item.categories || [item.category]).join(' ')),
          searchBody: normalizeSearchText(item.text)
        })));
    }
    return searchIndexPromise;
  };

  const createSearchResult = (item) => {
    const link = document.createElement('a');
    link.className = 'site-search-result';
    link.href = item.url;

    const image = document.createElement('img');
    image.src = item.thumbnail;
    image.alt = '';
    image.loading = 'lazy';

    const copy = document.createElement('span');
    copy.className = 'site-search-result-copy';

    const meta = document.createElement('span');
    meta.className = 'site-search-result-meta';
    const category = document.createElement('b');
    category.textContent = item.category;
    const date = document.createElement('time');
    date.dateTime = item.published;
    date.textContent = item.published.replaceAll('-', '.');
    meta.append(category, date);

    const title = document.createElement('strong');
    title.textContent = item.title;
    const description = document.createElement('small');
    description.textContent = item.description;
    copy.append(meta, title, description);

    const arrow = document.createElement('span');
    arrow.className = 'site-search-result-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '›';

    link.append(image, copy, arrow);
    link.addEventListener('click', () => {
      if (siteSearchDialog.open) siteSearchDialog.close();
    });
    return link;
  };

  const renderSearchResults = async () => {
    const query = searchInput.value.trim();
    const currentSequence = ++searchSequence;
    searchResults.replaceChildren();

    if (!query) {
      searchSuggestions.hidden = false;
      searchStatus.textContent = 'キーワードを入力すると、関連記事を表示します。';
      return;
    }

    searchSuggestions.hidden = true;
    searchStatus.textContent = '検索しています…';

    try {
      const items = await loadSearchIndex();
      if (currentSequence !== searchSequence) return;

      const normalizedQuery = normalizeSearchText(query);
      const tokens = normalizedQuery.split(' ').filter(Boolean);
      const matches = items
        .map((item) => {
          const searchable = `${item.searchTitle} ${item.searchDescription} ${item.searchCategories} ${item.searchBody}`;
          if (!tokens.every((token) => searchable.includes(token))) return null;

          let score = 0;
          tokens.forEach((token) => {
            if (item.searchTitle.includes(token)) score += 12;
            if (item.searchCategories.includes(token)) score += 7;
            if (item.searchDescription.includes(token)) score += 4;
            if (item.searchBody.includes(token)) score += 1;
          });
          if (item.searchTitle.includes(normalizedQuery)) score += 16;
          if (item.searchCategories.includes(normalizedQuery)) score += 8;
          return { item, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score || b.item.published.localeCompare(a.item.published));

      if (!matches.length) {
        searchStatus.textContent = `「${query}」に一致する記事はありませんでした。`;
        const empty = document.createElement('p');
        empty.className = 'site-search-no-results';
        empty.textContent = '言葉を短くするか、別のキーワードをお試しください。';
        searchResults.append(empty);
        return;
      }

      searchStatus.textContent = `「${query}」の検索結果：${matches.length}件${matches.length > 10 ? '（上位10件を表示）' : ''}`;
      searchResults.append(...matches.slice(0, 10).map(({ item }) => createSearchResult(item)));
    } catch {
      if (currentSequence !== searchSequence) return;
      searchStatus.textContent = '検索データを読み込めませんでした。';
      const fallback = document.createElement('a');
      fallback.className = 'site-search-fallback';
      fallback.href = searchForm.action;
      fallback.textContent = '記事一覧から探す ›';
      searchResults.append(fallback);
    }
  };

  const openSiteSearch = (trigger) => {
    lastSearchTrigger = trigger;
    if (!siteSearchDialog.open) siteSearchDialog.showModal();
    document.body.classList.add('is-search-open');
    window.setTimeout(() => {
      searchInput.focus();
      searchInput.select();
    }, 0);
    loadSearchIndex().catch(() => {});
  };

  siteSearchTriggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      if (typeof siteSearchDialog.showModal !== 'function') return;
      event.preventDefault();
      openSiteSearch(trigger);
    });
  });

  searchClose.addEventListener('click', () => siteSearchDialog.close());
  siteSearchDialog.addEventListener('click', (event) => {
    if (event.target === siteSearchDialog) siteSearchDialog.close();
  });
  siteSearchDialog.addEventListener('close', () => {
    document.body.classList.remove('is-search-open');
    if (lastSearchTrigger?.isConnected) lastSearchTrigger.focus();
  });

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    window.clearTimeout(searchTimer);
    renderSearchResults();
  });

  searchInput.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(renderSearchResults, 90);
  });

  suggestionButtons.forEach((suggestion) => {
    suggestion.addEventListener('click', () => {
      searchInput.value = suggestion.dataset.searchSuggestion;
      renderSearchResults();
      searchInput.focus();
    });
  });

  const initialQuery = new URL(window.location.href).searchParams.get('q');
  if (initialQuery && /\/column\/?$/.test(window.location.pathname) && typeof siteSearchDialog.showModal === 'function') {
    searchInput.value = initialQuery;
    openSiteSearch(siteSearchTriggers[0]);
    renderSearchResults();
  }
}

const openFaqFromHash = () => {
  if (!window.location.hash) return;

  let targetId;
  try {
    targetId = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return;
  }

  const target = document.getElementById(targetId);
  if (!(target instanceof HTMLDetailsElement) || !target.matches('.faq-page-list details[data-faq-target]')) return;

  document.querySelectorAll('.faq-page-list details[data-faq-target][open]').forEach((item) => {
    if (item !== target) item.open = false;
  });
  target.open = true;

  window.requestAnimationFrame(() => {
    target.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
    target.querySelector('summary')?.focus({ preventScroll: true });
  });
};

openFaqFromHash();
window.addEventListener('hashchange', openFaqFromHash);

const prefectureSearch = document.querySelector('[data-prefecture-search]');
const prefectureSearchStatus = document.querySelector('[data-prefecture-search-status]');

if (prefectureSearch && prefectureSearchStatus) {
  const prefectureItems = [...document.querySelectorAll('[data-prefecture-item]')];
  const prefectureRegions = [...document.querySelectorAll('.prefecture-region')];
  const normalizePrefectureQuery = (value) => String(value || '').normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase('ja-JP');

  prefectureSearch.addEventListener('input', () => {
    const query = normalizePrefectureQuery(prefectureSearch.value);
    let visibleCount = 0;

    prefectureItems.forEach((item) => {
      const visible = !query || normalizePrefectureQuery(item.dataset.prefectureName).includes(query);
      item.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    prefectureRegions.forEach((region) => {
      region.hidden = !region.querySelector('[data-prefecture-item]:not([hidden])');
    });

    prefectureSearchStatus.textContent = query
      ? `「${prefectureSearch.value.trim()}」に一致する地域：${visibleCount}件`
      : '47都道府県を表示しています';
  });
}

const municipalityDirectory = document.querySelector('[data-municipality-directory]');

if (municipalityDirectory) {
  const municipalitySearch = municipalityDirectory.querySelector('[data-municipality-search]');
  const municipalitySearchStatus = municipalityDirectory.querySelector('[data-municipality-search-status]');
  const municipalityItems = [...municipalityDirectory.querySelectorAll('[data-municipality-item]')];
  const municipalityGroups = [...municipalityDirectory.querySelectorAll('[data-municipality-group]')];
  const municipalityCount = Number(municipalityDirectory.dataset.municipalityCount) || municipalityItems.length;
  const municipalityDirectoryKey = municipalityDirectory.dataset.municipalityDirectory || 'regional';
  const mobileMunicipalityGroups = window.matchMedia('(max-width: 640px)');
  const manuallyOpenedMunicipalityGroups = new WeakSet();
  const normalizeMunicipalityQuery = (value) => String(value || '')
    .normalize('NFKC')
    .replace(/[ヶヵ]/g, 'ケ')
    .replace(/\s+/g, '')
    .toLocaleLowerCase('ja-JP');

  const setMunicipalityGroupOpen = (group, open) => {
    const button = group.querySelector('[data-municipality-toggle]');
    const groupName = group.querySelector('h3')?.textContent.trim() || '自治体一覧';
    group.classList.toggle('is-open', open);
    if (!button) return;
    button.textContent = open ? '−' : '+';
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', `${groupName}を${open ? '閉じる' : '開く'}`);
  };

  municipalityGroups.forEach((group, index) => {
    const header = group.querySelector(':scope > header');
    const groupName = group.querySelector('h3')?.textContent.trim() || '自治体一覧';
    const contentId = `${municipalityDirectoryKey}-municipality-group-content-${index + 1}`;
    const description = group.querySelector(':scope > p');
    const grid = group.querySelector(':scope > .tokyo-municipality-grid');
    if (!header || !description || !grid) return;

    grid.id = contentId;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tokyo-municipality-toggle';
    button.dataset.municipalityToggle = '';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', contentId);
    button.setAttribute('aria-label', `${groupName}を開く`);
    button.textContent = '+';
    group.classList.add('is-collapsible');
    header.append(button);

    button.addEventListener('click', () => {
      const open = !group.classList.contains('is-open');
      if (open) manuallyOpenedMunicipalityGroups.add(group);
      else manuallyOpenedMunicipalityGroups.delete(group);
      setMunicipalityGroupOpen(group, open);
    });
  });

  const openMunicipalityGroupFromHash = () => {
    if (!mobileMunicipalityGroups.matches || !window.location.hash) return;
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    if (!target?.matches('[data-municipality-group]') || !municipalityDirectory.contains(target)) return;
    manuallyOpenedMunicipalityGroups.add(target);
    setMunicipalityGroupOpen(target, true);
  };

  openMunicipalityGroupFromHash();
  window.addEventListener('hashchange', openMunicipalityGroupFromHash);

  const filterMunicipalities = () => {
    const currentSearchValue = municipalitySearch?.value || '';
    const query = normalizeMunicipalityQuery(currentSearchValue);
    let visibleCount = 0;

    municipalityItems.forEach((item) => {
      const visible = !query || normalizeMunicipalityQuery(item.dataset.municipalityName).includes(query);
      item.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    municipalityGroups.forEach((group) => {
      const hasVisibleItem = Boolean(group.querySelector('[data-municipality-item]:not([hidden])'));
      group.hidden = !hasVisibleItem;
      if (!mobileMunicipalityGroups.matches) return;
      if (query && hasVisibleItem) setMunicipalityGroupOpen(group, true);
      else if (!query && !manuallyOpenedMunicipalityGroups.has(group)) setMunicipalityGroupOpen(group, false);
    });

    if (municipalitySearchStatus) {
      municipalitySearchStatus.textContent = query
        ? `「${currentSearchValue.trim()}」に一致する自治体：${visibleCount}件`
        : `${municipalityCount}自治体を表示しています`;
    }
  };

  municipalitySearch?.addEventListener('input', filterMunicipalities);
  const handleMunicipalityBreakpointChange = () => {
    filterMunicipalities();
    openMunicipalityGroupFromHash();
  };
  if (typeof mobileMunicipalityGroups.addEventListener === 'function') {
    mobileMunicipalityGroups.addEventListener('change', handleMunicipalityBreakpointChange);
  } else if (typeof mobileMunicipalityGroups.addListener === 'function') {
    mobileMunicipalityGroups.addListener(handleMunicipalityBreakpointChange);
  }
}

const articleDetail = document.querySelector('.article-detail');

if (articleDetail) {
  const articleTitle = articleDetail.querySelector('h1')?.textContent.trim() || document.title;
  const canonicalUrl = document.querySelector('link[rel="canonical"]')?.href || window.location.href.split('#')[0];
  const articleMeta = articleDetail.querySelector('.article-meta');
  const articleToc = articleDetail.querySelector('.toc');
  const articleBody = articleDetail.querySelector('.article-body');
  const mobileArticleQuery = window.matchMedia('(max-width: 640px)');
  const compactArticleQuery = window.matchMedia('(max-width: 440px)');
  const printableDetails = [...articleDetail.querySelectorAll('details')];
  let printableDetailStates = [];

  window.addEventListener('beforeprint', () => {
    printableDetailStates = printableDetails.map((item) => item.open);
    printableDetails.forEach((item) => { item.open = true; });
  });
  window.addEventListener('afterprint', () => {
    printableDetails.forEach((item, index) => { item.open = printableDetailStates[index]; });
  });

  const copyText = async (text) => {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    if (!copied) throw new Error('copy failed');
  };

  if (articleMeta) {
    const articleActions = document.createElement('div');
    articleActions.className = 'article-actions';
    articleActions.setAttribute('aria-label', '記事の操作');

    const actionStatus = document.createElement('p');
    actionStatus.className = 'article-action-status';
    actionStatus.setAttribute('aria-live', 'polite');

    const createActionButton = (label, dataAttribute) => {
      const actionButton = document.createElement('button');
      actionButton.className = 'article-action-button';
      actionButton.type = 'button';
      actionButton.textContent = label;
      actionButton.setAttribute(dataAttribute, '');
      return actionButton;
    };

    const shareButton = createActionButton('共有', 'data-article-share');
    const copyButton = createActionButton('URLをコピー', 'data-article-copy');
    const printButton = createActionButton('印刷', 'data-article-print');
    let statusTimer;

    const announceAction = (message) => {
      window.clearTimeout(statusTimer);
      actionStatus.textContent = message;
      statusTimer = window.setTimeout(() => {
        actionStatus.textContent = '';
      }, 5000);
    };

    shareButton.addEventListener('click', async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: articleTitle, text: articleTitle, url: canonicalUrl });
          announceAction('共有メニューを開きました。');
        } catch (error) {
          if (error?.name !== 'AbortError') announceAction('共有できませんでした。URLコピーボタンをご利用ください。');
        }
        return;
      }

      try {
        await copyText(canonicalUrl);
        announceAction('共有用URLをコピーしました。');
      } catch {
        announceAction('URLをコピーできませんでした。');
      }
    });

    copyButton.addEventListener('click', async () => {
      try {
        await copyText(canonicalUrl);
        copyButton.classList.add('is-complete');
        copyButton.textContent = 'コピー済み';
        announceAction('記事のURLをコピーしました。');
        window.setTimeout(() => {
          copyButton.classList.remove('is-complete');
          copyButton.textContent = 'URLをコピー';
        }, 2400);
      } catch {
        announceAction('URLをコピーできませんでした。');
      }
    });

    printButton.addEventListener('click', () => window.print());
    articleActions.append(shareButton, copyButton, printButton, actionStatus);
    articleMeta.insertAdjacentElement('afterend', articleActions);
  }

  let expandArticleToc = () => {};

  if (articleToc) {
    const tocList = articleToc.querySelector('ol');
    const tocItems = tocList ? [...tocList.children] : [];

    if (tocList) {
      if (!articleToc.id) articleToc.id = 'article-toc';
      if (!tocList.id) tocList.id = 'article-toc-list';
      const tocToggle = document.createElement('button');
      tocToggle.className = 'article-toc-toggle';
      tocToggle.type = 'button';
      tocToggle.setAttribute('aria-controls', tocList.id);

      let tocExpandedByUser = false;

      const setTocExpanded = (expanded, userInitiated = false) => {
        const shouldCollapse = mobileArticleQuery.matches && !expanded && tocItems.length > 5;
        const initialVisibleCount = compactArticleQuery.matches ? 0 : 5;
        tocItems.forEach((item, index) => {
          item.hidden = shouldCollapse && index >= initialVisibleCount;
        });
        tocToggle.hidden = !mobileArticleQuery.matches || tocItems.length <= 5;
        tocToggle.classList.toggle('is-expanded', !shouldCollapse);
        tocToggle.setAttribute('aria-expanded', String(!shouldCollapse));
        tocToggle.textContent = shouldCollapse
          ? initialVisibleCount
            ? `目次をすべて見る（全${tocItems.length}項目）`
            : `目次を開く（全${tocItems.length}項目）`
          : '目次を閉じる';
        if (userInitiated) tocExpandedByUser = !shouldCollapse;
      };

      expandArticleToc = () => setTocExpanded(true);

      tocToggle.addEventListener('click', () => {
        const expanded = tocToggle.getAttribute('aria-expanded') === 'true';
        setTocExpanded(!expanded, true);
      });

      articleToc.append(tocToggle);
      setTocExpanded(!mobileArticleQuery.matches);
      mobileArticleQuery.addEventListener?.('change', () => {
        setTocExpanded(!mobileArticleQuery.matches || tocExpandedByUser);
      });
      compactArticleQuery.addEventListener?.('change', () => {
        setTocExpanded(!mobileArticleQuery.matches || tocExpandedByUser);
      });
    }
  }

  document.querySelectorAll('.article-table-wrap').forEach((tableWrap, index) => {
    const table = tableWrap.querySelector('table');
    if (!table) return;

    const tableBlock = tableWrap.closest('.article-table-block') || tableWrap;
    const sectionHeading = tableBlock.closest('section')?.querySelector('h2');
    const visibleCaption = tableBlock.querySelector('.table-caption');
    const tableName = visibleCaption?.textContent.trim() || sectionHeading?.textContent.trim() || `記事内の表${index + 1}`;
    let hint = tableBlock.querySelector('.table-scroll-hint, .article-table-scroll-hint');
    const hintId = hint?.id || `table-scroll-hint-${index + 1}`;
    if (!hint) {
      hint = document.createElement('p');
      hint.className = 'table-scroll-hint';
      hint.textContent = '表は横にスクロールできます';
      tableBlock.prepend(hint);
    }
    hint.id = hintId;
    hint.hidden = true;

    tableWrap.setAttribute('role', 'region');
    tableWrap.setAttribute('aria-label', `${tableName}の表`);
    table.querySelectorAll('thead th').forEach((heading) => heading.setAttribute('scope', 'col'));

    const updateTableState = () => {
      const maxScrollLeft = Math.max(0, tableWrap.scrollWidth - tableWrap.clientWidth);
      const scrollable = maxScrollLeft > 2;
      const atStart = tableWrap.scrollLeft <= 2;
      const atEnd = tableWrap.scrollLeft >= maxScrollLeft - 2;

      tableWrap.dataset.scrollable = String(scrollable);
      tableWrap.dataset.scrollPosition = !scrollable ? 'none' : atStart ? 'start' : atEnd ? 'end' : 'middle';
      tableWrap.classList.toggle('is-scrollable', scrollable);
      tableWrap.classList.toggle('is-scroll-start', scrollable && atStart);
      tableWrap.classList.toggle('is-scroll-middle', scrollable && !atStart && !atEnd);
      tableWrap.classList.toggle('is-scroll-end', scrollable && atEnd);
      tableWrap.tabIndex = scrollable ? 0 : -1;
      hint.hidden = !scrollable;

      if (scrollable) {
        tableWrap.setAttribute('aria-describedby', hintId);
        table.setAttribute('aria-describedby', hintId);
      } else {
        tableWrap.removeAttribute('aria-describedby');
        table.removeAttribute('aria-describedby');
      }
    };

    tableWrap.addEventListener('scroll', () => {
      tableWrap.classList.add('has-scrolled');
      updateTableState();
    }, { passive: true });

    tableWrap.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || tableWrap.dataset.scrollable !== 'true') return;
      event.preventDefault();
      const maxScrollLeft = tableWrap.scrollWidth - tableWrap.clientWidth;
      const left = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? maxScrollLeft
          : tableWrap.scrollLeft + (event.key === 'ArrowRight' ? 96 : -96);
      tableWrap.scrollTo({ left, behavior: preferredScrollBehavior() });
    });

    if ('ResizeObserver' in window) new ResizeObserver(updateTableState).observe(tableWrap);
    window.addEventListener('load', updateTableState, { once: true });
    updateTableState();
  });

  if (articleBody) {
    const articleSections = [...articleBody.querySelectorAll('section > h2[id]')];
    const sideToc = document.querySelector('[data-article-side-toc]');
    const sideTocLinks = sideToc ? [...sideToc.querySelectorAll('[data-article-toc-link]')] : [];
    const currentSectionLabel = sideToc?.querySelector('[data-article-current-section]');
    const readingProgress = document.createElement('div');
    const readingProgressBar = document.createElement('span');
    readingProgress.className = 'article-reading-progress';
    readingProgress.setAttribute('aria-hidden', 'true');
    readingProgressBar.className = 'article-reading-progress-bar';
    readingProgress.append(readingProgressBar);

    const readingTools = document.createElement('nav');
    readingTools.className = 'article-reading-tools';
    readingTools.setAttribute('aria-label', '記事を読むための補助操作');

    const tocButton = document.createElement('button');
    tocButton.className = 'article-reading-button article-reading-toc-button';
    tocButton.type = 'button';
    tocButton.textContent = '目次';

    const topButton = document.createElement('button');
    topButton.className = 'article-reading-button article-reading-top';
    topButton.type = 'button';
    topButton.textContent = '上へ';

    if (articleToc) {
      tocButton.setAttribute('aria-controls', articleToc.id || 'article-toc');
      tocButton.addEventListener('click', () => {
        expandArticleToc();
        articleToc.scrollIntoView({ block: 'start', behavior: preferredScrollBehavior() });
        window.setTimeout(() => {
          articleToc.querySelector('a, button')?.focus({ preventScroll: true });
        }, reducedMotionQuery.matches ? 0 : 350);
      });
    } else {
      tocButton.hidden = true;
    }

    topButton.addEventListener('click', () => {
      articleDetail.scrollIntoView({ block: 'start', behavior: preferredScrollBehavior() });
      window.setTimeout(() => {
        const articleHeading = articleDetail.querySelector('h1');
        if (articleHeading) {
          articleHeading.tabIndex = -1;
          articleHeading.focus({ preventScroll: true });
        }
      }, reducedMotionQuery.matches ? 0 : 350);
    });

    readingTools.append(tocButton, topButton);
    document.body.prepend(readingProgress);
    document.body.append(readingTools);

    let progressFrame;
    const updateReadingProgress = () => {
      progressFrame = undefined;
      const articleRect = articleDetail.getBoundingClientRect();
      const articleTop = window.scrollY + articleRect.top;
      const articleBottom = articleTop + articleDetail.offsetHeight;
      const progressRange = Math.max(1, articleBottom - articleTop - window.innerHeight);
      const progress = Math.min(1, Math.max(0, (window.scrollY - articleTop) / progressRange));
      const readingEndThreshold = articleBottom - Math.min(320, window.innerHeight * .38);
      const toolsVisible = window.scrollY > articleTop + Math.min(480, window.innerHeight * .55)
        && window.scrollY < readingEndThreshold;
      const headingThreshold = Math.max(96, window.innerHeight * .22);
      let activeHeading;
      articleSections.forEach((heading) => {
        if (heading.getBoundingClientRect().top <= headingThreshold) activeHeading = heading;
      });

      readingProgress.style.setProperty('--reading-progress', `${progress * 100}%`);
      readingProgressBar.style.width = `${progress * 100}%`;
      readingProgress.classList.toggle('is-active', progress > 0 && progress < 1);
      readingTools.classList.toggle('is-visible', toolsVisible);
      sideTocLinks.forEach((link) => {
        const current = Boolean(activeHeading && link.dataset.articleTocLink === activeHeading.id);
        link.classList.toggle('is-current', current);
        if (current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      if (currentSectionLabel) currentSectionLabel.textContent = activeHeading?.textContent.trim() || '記事のはじめ';
    };

    const requestProgressUpdate = () => {
      if (!progressFrame) progressFrame = window.requestAnimationFrame(updateReadingProgress);
    };

    window.addEventListener('scroll', requestProgressUpdate, { passive: true });
    window.addEventListener('resize', requestProgressUpdate, { passive: true });
    window.addEventListener('hashchange', requestProgressUpdate);
    window.addEventListener('load', requestProgressUpdate, { once: true });
    updateReadingProgress();
    window.setTimeout(requestProgressUpdate, 0);
    window.setTimeout(requestProgressUpdate, 250);
  }
}
