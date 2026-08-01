(() => {
  'use strict';

  const MAX_PHOTOS = 4;
  const MAX_FILE_SIZE = 30 * 1024 * 1024;
  const HANDOFF_KEY = 'ASBESTOS_CHECK_HANDOFF_V1';
  const UNKNOWN_VALUES = new Set(['', 'unknown', '不明', 'わからない']);
  const SCORE_LABELS = ['最低', '低', '中', '高', '最高'];
  const SCORE_MESSAGES = [
    '調査不要ではありませんが、画像と入力情報で判断する限り、類似する特徴は極めて少ない結果です。',
    '類似する特徴は少ない結果ですが、画像だけで石綿含有を否定することはできません。',
    '対象建材になり得る特徴が一部あります。工事前に資格者へ確認することをおすすめします。',
    '類似する特徴または注意すべき条件が複数あります。正式な事前調査を強くおすすめします。',
    '確認を優先すべき要素が強く重なっています。建材に触れず、速やかに資格者へ相談してください。'
  ];

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const average = (values) => values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
  const isUnknown = (value) => UNKNOWN_VALUES.has(String(value ?? '').trim());
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

  const ready = (callback) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
    else callback();
  };

  ready(() => {
    document.querySelectorAll('[data-check-app]').forEach(initCheckApp);
  });

  function initCheckApp(root) {
    if (root.dataset.checkReady === 'true') return;
    root.dataset.checkReady = 'true';

    const query = (selector) => root.querySelector(selector);
    const queryAll = (selector) => [...root.querySelectorAll(selector)];
    const consentDialog = document.querySelector('[data-check-consent]');
    const consentAccept = consentDialog?.querySelector('[data-check-consent-accept]');
    const consentCancel = consentDialog?.querySelector('[data-check-consent-cancel]');
    const photoInputs = queryAll('[data-check-photo-input]');
    const photoGrid = query('[data-check-photo-grid]');
    const photoStatus = query('[data-check-photo-status]');
    const errorBoxes = queryAll('[data-check-error]');
    const nextButton = query('[data-check-next]');
    const backButton = query('[data-check-back]');
    const analyzeButton = query('[data-check-analyze]');
    const resetButton = query('[data-check-reset]');
    const progress = query('[data-check-progress]');
    const detailsForm = query('[data-check-details]');
    const lpLink = query('[data-check-lp-link]');
    const steps = queryAll('[data-check-step]');
    const stepNavItems = queryAll('[data-check-step-indicator], [data-check-indicator]');
    const resultScore = query('[data-result-score]');
    const resultSimilarity = query('[data-result-similarity]');
    const resultConfidence = query('[data-result-confidence]');
    const resultMessage = query('[data-result-message]');
    const resultReason = query('[data-result-reason]');
    const state = {
      accepted: false,
      analyzing: false,
      photos: [],
      activeStep: 'upload',
      lastResult: null
    };

    try {
      sessionStorage.removeItem(HANDOFF_KEY);
    } catch {
      // Storage can be unavailable in private browsing. The checker still works.
    }

      initializeConsent();
    initializePhotoControls();
    initializeDetailRows();
    initializeNavigation();
    initializeAIProgress();
    updatePhotoView();
    showStep('upload');

    function initializeConsent() {
      if (!consentDialog) {
        state.accepted = true;
        root.classList.add('is-consented');
        root.dataset.checkState = 'ready';
        return;
      }

      consentDialog.addEventListener('cancel', (event) => {
        event.preventDefault();
      });

      consentAccept?.addEventListener('click', (event) => {
        event.preventDefault();
        state.accepted = true;
        root.classList.add('is-consented');
        root.dataset.checkState = 'ready';
        closeConsent();
        window.AsbestosImageAI?.warmup?.().catch(() => {
          // Analysis automatically falls back to local image features if loading fails.
        });
        query('[data-photo-source], [data-check-photo-input]')?.focus({ preventScroll: true });
      });

      queryAll('[data-check-start]').forEach((trigger) => {
        trigger.addEventListener('click', () => {
          if (!state.accepted) {
            if (typeof consentDialog.showModal === 'function') {
              if (!consentDialog.open) consentDialog.showModal();
            } else {
              consentDialog.hidden = false;
              consentDialog.classList.add('is-open');
              consentAccept?.focus({ preventScroll: true });
            }
            return;
          }
          query('.check-flow, [data-check-step="upload"]')?.scrollIntoView({
            behavior: reducedMotion() ? 'auto' : 'smooth',
            block: 'start'
          });
        });
      });

      consentCancel?.addEventListener('click', () => {
        const homePath = root.dataset.checkHome || `${normalizeBasePath(root.dataset.basePath)}/`;
        window.location.assign(homePath);
      });

      window.requestAnimationFrame(() => {
        if (typeof consentDialog.showModal === 'function') {
          if (!consentDialog.open) consentDialog.showModal();
        } else {
          consentDialog.hidden = false;
          consentDialog.classList.add('is-open');
          consentDialog.setAttribute('role', 'dialog');
          consentDialog.setAttribute('aria-modal', 'true');
          consentAccept?.focus({ preventScroll: true });
        }
      });
    }

    function closeConsent() {
      if (typeof consentDialog?.close === 'function' && consentDialog.open) consentDialog.close();
      else if (consentDialog) {
        consentDialog.hidden = true;
        consentDialog.classList.remove('is-open');
      }
    }

    function initializePhotoControls() {
      photoInputs.forEach((input) => {
        input.addEventListener('change', async () => {
          await addPhotos([...input.files || []]);
          input.value = '';
        });
      });

      queryAll('[data-photo-source]').forEach((trigger) => {
        trigger.addEventListener('click', (event) => {
          if (trigger.tagName === 'LABEL' && trigger.htmlFor) return;
          event.preventDefault();
          const source = trigger.dataset.photoSource;
          const input = photoInputs.find((candidate) =>
            candidate.dataset.photoSource === source
            || candidate.dataset.checkPhotoInput === source
            || candidate.dataset.photoInputKind === source
          ) || photoInputs[0];
          input?.click();
        });
      });

      window.addEventListener('pagehide', () => {
        releaseAllObjectUrls();
        state.photos = [];
        photoInputs.forEach((input) => { input.value = ''; });
      });
    }

    async function addPhotos(files) {
      clearError();
      if (!files.length) return;

      const remaining = MAX_PHOTOS - state.photos.length;
      if (remaining <= 0) {
        showError(`写真は最大${MAX_PHOTOS}枚まで追加できます。`);
        return;
      }

      const existing = new Set(state.photos.map(({ file }) => fileIdentity(file)));
      const accepted = [];
      let rejected = 0;

      for (const file of files.slice(0, remaining)) {
        if (!isSupportedImage(file) || file.size > MAX_FILE_SIZE || existing.has(fileIdentity(file))) {
          rejected += 1;
          continue;
        }
        existing.add(fileIdentity(file));
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          url: URL.createObjectURL(file)
        });
      }

      state.photos.push(...accepted);
      updatePhotoView();

      if (files.length > remaining) {
        showError(`写真は最大${MAX_PHOTOS}枚です。先に選んだ${remaining}枚を追加しました。`);
      } else if (rejected) {
        showError('重複した写真、未対応の画像、または30MBを超える画像は追加できません。');
      }
    }

    function updatePhotoView() {
      if (photoGrid) {
        photoGrid.replaceChildren();
        state.photos.forEach((photo, index) => {
          const card = document.createElement('figure');
          card.className = 'check-photo-card';

          const image = document.createElement('img');
          image.className = 'check-photo-preview';
          image.src = photo.url;
          image.alt = `選択した建材写真 ${index + 1}枚目`;
          image.decoding = 'async';

          const number = document.createElement('figcaption');
          number.className = 'check-photo-number';
          number.textContent = `${index + 1}枚目`;

          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'check-photo-remove';
          remove.dataset.photoRemove = photo.id;
          remove.setAttribute('aria-label', `${index + 1}枚目の写真を削除`);
          remove.innerHTML = '<span aria-hidden="true">×</span>';
          remove.addEventListener('click', () => removePhoto(photo.id));

          card.append(image, number, remove);
          photoGrid.append(card);
        });
      }

      const count = state.photos.length;
      if (photoStatus) {
        photoStatus.textContent = count
          ? `${count} / ${MAX_PHOTOS}枚を選択中${count < MAX_PHOTOS ? `（あと${MAX_PHOTOS - count}枚追加できます）` : ''}`
          : '写真を1枚以上選択してください';
      }
      nextButton?.toggleAttribute('disabled', count === 0);
      analyzeButton?.toggleAttribute('disabled', count === 0 || state.analyzing);
      queryAll('[data-photo-source]').forEach((button) => button.toggleAttribute('disabled', count >= MAX_PHOTOS));
      root.classList.toggle('has-photos', count > 0);
    }

    function removePhoto(id) {
      const index = state.photos.findIndex((photo) => photo.id === id);
      if (index < 0) return;
      URL.revokeObjectURL(state.photos[index].url);
      state.photos.splice(index, 1);
      state.lastResult = null;
      updatePhotoView();
      if (!state.photos.length && state.activeStep !== 'upload') showStep('upload');
    }

    function releaseAllObjectUrls() {
      state.photos.forEach((photo) => {
        if (photo.url) URL.revokeObjectURL(photo.url);
        photo.url = '';
      });
    }

    function initializeDetailRows() {
      queryAll('[data-detail-row]').forEach((row) => {
        const editor = row.querySelector('[data-detail-editor]');
        const editTrigger = row.querySelector('[data-detail-edit]') || row.querySelector('[data-detail-summary]');
        const controls = [...row.querySelectorAll('input, select, textarea')];
        const closeTrigger = row.querySelector('[data-detail-close]');
        const clearTrigger = row.querySelector('[data-detail-clear]');

        updateDetailSummary(row);

        const open = () => {
          if (!editor) return;
          queryAll('[data-detail-row].is-editing').forEach((otherRow) => {
            if (otherRow !== row) closeDetailRow(otherRow);
          });
          if (row.tagName === 'DETAILS') row.open = true;
          else editor.hidden = false;
          row.classList.add('is-editing');
          editTrigger?.setAttribute('aria-expanded', 'true');
          window.requestAnimationFrame(() => controls.find((control) => !control.disabled)?.focus({ preventScroll: true }));
        };

        editTrigger?.addEventListener('click', (event) => {
          event.preventDefault();
          open();
        });

        if (row.tagName === 'DETAILS') {
          row.addEventListener('toggle', () => {
            row.classList.toggle('is-editing', row.open);
            editTrigger?.setAttribute('aria-expanded', String(row.open));
          });
        }

        controls.forEach((control) => {
          control.addEventListener('input', () => updateDetailSummary(row));
          control.addEventListener('change', () => updateDetailSummary(row));
        });

        closeTrigger?.addEventListener('click', () => closeDetailRow(row));
        clearTrigger?.addEventListener('click', () => {
          controls.forEach((control) => {
            if (control.type === 'radio' || control.type === 'checkbox') control.checked = false;
            else control.value = '';
            control.dispatchEvent(new Event('change', { bubbles: true }));
          });
          closeDetailRow(row);
        });
      });
    }

    function closeDetailRow(row) {
      const editor = row.querySelector('[data-detail-editor]');
      const editTrigger = row.querySelector('[data-detail-edit]') || row.querySelector('[data-detail-summary]');
      if (row.tagName === 'DETAILS') row.open = false;
      else if (editor) editor.hidden = true;
      row.classList.remove('is-editing');
      editTrigger?.setAttribute('aria-expanded', 'false');
      updateDetailSummary(row);
      editTrigger?.focus({ preventScroll: true });
    }

    function updateDetailSummary(row) {
      const summary = row.querySelector('[data-detail-summary]');
      if (!summary) return;
      const readableValues = [...row.querySelectorAll('input, select, textarea')]
        .map(readableControlValue)
        .filter((value) => !isUnknown(value));
      summary.textContent = readableValues.length ? readableValues.join('・') : 'わからない';
      row.classList.toggle('has-value', readableValues.length > 0);
    }

    function initializeNavigation() {
      nextButton?.addEventListener('click', () => {
        if (!state.photos.length) {
          showError('判定する建材の写真を1枚以上選択してください。');
          return;
        }
        clearError();
        showStep('details');
      });

      backButton?.addEventListener('click', () => showStep('upload'));
      analyzeButton?.addEventListener('click', runAnalysis);
      resetButton?.addEventListener('click', resetCheck);

      lpLink?.addEventListener('click', (event) => {
        if (!state.lastResult) {
          event.preventDefault();
          showError('先に調査推奨度を確認してください。');
          return;
        }
        saveHandoff();
        if (!lpLink.getAttribute('href')) {
          event.preventDefault();
          window.location.assign(`${window.location.origin}/#contact`);
        }
      });
    }

    function initializeAIProgress() {
      window.addEventListener('asbestos-ai-progress', (event) => {
        if (!state.analyzing) return;
        const detail = event.detail || {};
        const normalizedProgress = normalizeProbability(detail.progress);
        const percent = normalizedProgress === null
          ? 24
          : Math.round(16 + (normalizedProgress * 54));
        const label = detail.phase === 'ready'
          ? '画像判定機能の準備ができました'
          : '画像判定機能を準備しています';
        updateProgress(percent, label);
      });
    }

    function showStep(name) {
      state.activeStep = name;
      steps.forEach((step) => {
        const active = step.dataset.checkStep === name;
        step.hidden = !active;
        step.classList.toggle('is-active', active);
      });
      stepNavItems.forEach((item) => {
        const names = ['upload', 'details', 'result'];
        const currentIndex = names.indexOf(name);
        const itemIndex = names.indexOf(item.dataset.checkStepIndicator || item.dataset.checkIndicator);
        item.classList.toggle('is-current', itemIndex === currentIndex);
        item.classList.toggle('is-complete', itemIndex >= 0 && itemIndex < currentIndex);
        if (itemIndex === currentIndex) item.setAttribute('aria-current', 'step');
        else item.removeAttribute('aria-current');
      });
      root.dataset.activeStep = name;
    }

    async function runAnalysis() {
      if (state.analyzing) return;
      if (!state.photos.length) {
        showError('判定する建材の写真を1枚以上選択してください。');
        showStep('upload');
        return;
      }

      state.analyzing = true;
      state.lastResult = null;
      clearError();
      analyzeButton?.setAttribute('aria-busy', 'true');
      updatePhotoView();
      updateProgress(2, '画像を準備しています');
      root.classList.add('is-analyzing');
      await nextFrame();

      try {
        const analyses = [];
        for (let index = 0; index < state.photos.length; index += 1) {
          updateProgress(
            Math.round(8 + ((index + 0.35) / state.photos.length) * 70),
            `${index + 1}枚目の画像を確認しています`
          );
          analyses.push(await analyzePhoto(state.photos[index].file, index));
          await nextFrame();
        }

        updateProgress(86, '入力情報と照合しています');
        const details = collectDetails();
        const result = buildAssessment(analyses, details);
        state.lastResult = { ...result, details };
        renderResult(result);
        releaseAllObjectUrls();
        state.photos = [];
        photoInputs.forEach((input) => { input.value = ''; });
        updatePhotoView();
        updateProgress(100, '判定が完了しました');
        showStep('result');
        query('[data-check-step="result"]')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      } catch (error) {
        console.error('[Asbestos check]', error);
        showError('画像の処理中に問題が発生しました。画像を選び直して、もう一度お試しください。');
      } finally {
        state.analyzing = false;
        analyzeButton?.removeAttribute('aria-busy');
        root.classList.remove('is-analyzing');
        updatePhotoView();
      }
    }

    function updateProgress(value, message) {
      if (!progress) return;
      progress.hidden = false;
      progress.setAttribute('aria-valuenow', String(value));
      const label = progress.querySelector('[data-check-progress-label]') || progress.querySelector('p');
      const bar = progress.querySelector('[data-check-progress-bar]') || progress.querySelector('span');
      if (label) label.textContent = message;
      else progress.setAttribute('aria-label', message);
      if (bar) {
        bar.style.setProperty('--check-progress', `${value}%`);
        bar.style.setProperty('width', `${value}%`);
      }
    }

    async function analyzePhoto(file, imageIndex) {
      let drawable;
      let temporaryUrl = '';
      try {
        ({ drawable, temporaryUrl } = await decodeImage(file));
        const width = drawable.width || drawable.naturalWidth;
        const height = drawable.height || drawable.naturalHeight;
        if (!width || !height) throw new Error('Image dimensions are unavailable');

        const maxSide = 288;
        const scale = Math.min(1, maxSide / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
        if (!context) throw new Error('Canvas is unavailable');
        context.drawImage(drawable, 0, 0, canvas.width, canvas.height);

        const features = extractImageFeatures(
          context.getImageData(0, 0, canvas.width, canvas.height),
          width,
          height
        );
        const face = await detectProminentFace(canvas);
        const adapterResult = await runAIAdapter({ file, features, imageIndex });
        return interpretImage(features, adapterResult, face);
      } catch (error) {
        return {
          usable: false,
          reason: '画像を読み込めませんでした。別の写真をお試しください。',
          quality: 0,
          visualSimilarity: 0,
          adapterUsed: false,
          error: String(error?.message || error)
        };
      } finally {
        if (typeof drawable?.close === 'function') drawable.close();
        if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
      }
    }

    async function decodeImage(file) {
      if ('createImageBitmap' in window) {
        try {
          const drawable = await createImageBitmap(file, { imageOrientation: 'from-image' });
          return { drawable, temporaryUrl: '' };
        } catch {
          try {
            const drawable = await createImageBitmap(file);
            return { drawable, temporaryUrl: '' };
          } catch {
            // Continue to the broadly supported HTMLImageElement fallback.
          }
        }
      }

      const temporaryUrl = URL.createObjectURL(file);
      const drawable = new Image();
      drawable.decoding = 'async';
      drawable.src = temporaryUrl;
      if (typeof drawable.decode === 'function') await drawable.decode();
      else {
        await new Promise((resolve, reject) => {
          drawable.onload = resolve;
          drawable.onerror = reject;
        });
      }
      return { drawable, temporaryUrl };
    }

    function extractImageFeatures(imageData, sourceWidth, sourceHeight) {
      const { data, width, height } = imageData;
      const pixels = width * height;
      const luminance = new Float32Array(pixels);
      const histogram = new Uint32Array(32);
      let sum = 0;
      let sumSquared = 0;
      let saturationSum = 0;
      let neutralPixels = 0;
      let bluePixels = 0;
      let blackPixels = 0;
      let whitePixels = 0;

      for (let pixel = 0, offset = 0; pixel < pixels; pixel += 1, offset += 4) {
        const red = data[offset];
        const green = data[offset + 1];
        const blue = data[offset + 2];
        const light = (red * 0.2126) + (green * 0.7152) + (blue * 0.0722);
        const maxChannel = Math.max(red, green, blue);
        const minChannel = Math.min(red, green, blue);
        const saturation = maxChannel ? (maxChannel - minChannel) / maxChannel : 0;
        luminance[pixel] = light;
        histogram[Math.min(31, Math.floor(light / 8))] += 1;
        sum += light;
        sumSquared += light * light;
        saturationSum += saturation;
        if (saturation < 0.2) neutralPixels += 1;
        if (blue > red * 1.14 && blue > green * 1.06 && blue > 90 && saturation > 0.2) bluePixels += 1;
        if (light < 8) blackPixels += 1;
        if (light > 247) whitePixels += 1;
      }

      const mean = sum / pixels;
      const deviation = Math.sqrt(Math.max(0, (sumSquared / pixels) - (mean * mean)));
      let entropy = 0;
      histogram.forEach((count) => {
        if (!count) return;
        const probability = count / pixels;
        entropy -= probability * Math.log2(probability);
      });
      entropy /= 5;

      let gradientTotal = 0;
      let laplacianTotal = 0;
      let laplacianSquared = 0;
      let edgePixels = 0;
      let flatColorPixels = 0;
      let sampledPixels = 0;
      for (let y = 1; y < height - 1; y += 2) {
        for (let x = 1; x < width - 1; x += 2) {
          const index = (y * width) + x;
          const offset = index * 4;
          const rightOffset = (index + 1) * 4;
          const lowerOffset = (index + width) * 4;
          const horizontal = luminance[index + 1] - luminance[index - 1];
          const vertical = luminance[index + width] - luminance[index - width];
          const gradient = Math.sqrt((horizontal * horizontal) + (vertical * vertical));
          const laplacian = (luminance[index] * 4)
            - luminance[index - 1]
            - luminance[index + 1]
            - luminance[index - width]
            - luminance[index + width];
          gradientTotal += gradient;
          laplacianTotal += laplacian;
          laplacianSquared += laplacian * laplacian;
          if (gradient > 22) edgePixels += 1;
          const rightDifference = Math.max(
            Math.abs(data[offset] - data[rightOffset]),
            Math.abs(data[offset + 1] - data[rightOffset + 1]),
            Math.abs(data[offset + 2] - data[rightOffset + 2])
          );
          const lowerDifference = Math.max(
            Math.abs(data[offset] - data[lowerOffset]),
            Math.abs(data[offset + 1] - data[lowerOffset + 1]),
            Math.abs(data[offset + 2] - data[lowerOffset + 2])
          );
          if (rightDifference <= 5 && lowerDifference <= 5) flatColorPixels += 1;
          sampledPixels += 1;
        }
      }

      const gradientMean = sampledPixels ? gradientTotal / sampledPixels : 0;
      const laplacianMean = sampledPixels ? laplacianTotal / sampledPixels : 0;
      const laplacianVariance = sampledPixels
        ? Math.max(0, (laplacianSquared / sampledPixels) - (laplacianMean * laplacianMean))
        : 0;
      const edgeDensity = sampledPixels ? edgePixels / sampledPixels : 0;
      const flatColorRatio = sampledPixels ? flatColorPixels / sampledPixels : 0;
      const resolutionScore = clamp(Math.sqrt(sourceWidth * sourceHeight) / 1250);
      const focusScore = clamp(
        (Math.log10(laplacianVariance + 1) - 0.72) / 1.75
        + clamp((gradientMean - 2) / 25) * 0.25
      );
      const exposureScore = clamp(
        1
        - (Math.max(0, 24 - mean) / 24)
        - (Math.max(0, mean - 232) / 23)
        - ((blackPixels + whitePixels) / pixels) * 0.55
      );
      const neutralRatio = neutralPixels / pixels;
      const blueRatio = bluePixels / pixels;
      const saturation = saturationSum / pixels;
      const textureBalance = clamp(1 - (Math.abs(edgeDensity - 0.16) / 0.2));
      const roughness = clamp((gradientMean - 3) / 25);
      const visualSimilarity = clamp(
        0.12
        + (neutralRatio * 0.23)
        + (entropy * 0.2)
        + (roughness * 0.24)
        + (textureBalance * 0.14)
        + ((1 - saturation) * 0.08)
        - (blueRatio * 0.3),
        0.06,
        0.91
      );

      return {
        width: sourceWidth,
        height: sourceHeight,
        meanBrightness: mean,
        brightnessDeviation: deviation,
        saturation,
        neutralRatio,
        blueRatio,
        blackRatio: blackPixels / pixels,
        whiteRatio: whitePixels / pixels,
        entropy,
        edgeDensity,
        flatColorRatio,
        gradientMean,
        laplacianVariance,
        resolutionScore,
        focusScore,
        exposureScore,
        quality: clamp((focusScore * 0.45) + (exposureScore * 0.35) + (resolutionScore * 0.2)),
        visualSimilarity,
        likelyBlank: deviation < 2.2 && entropy < 0.1,
        completelyObscured: (blackPixels / pixels) > 0.97 || (whitePixels / pixels) > 0.97,
        severelyBlurred: focusScore < 0.035 && entropy < 0.14 && deviation < 8,
        strongSkyPattern: blueRatio > 0.7 && edgeDensity < 0.055 && entropy < 0.62
      };
    }

    async function detectProminentFace(canvas) {
      if (typeof window.FaceDetector !== 'function') return { detected: false, areaRatio: 0 };
      try {
        const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
        const faces = await detector.detect(canvas);
        const totalArea = canvas.width * canvas.height;
        const areaRatio = faces.reduce((largest, face) => {
          const box = face.boundingBox;
          return Math.max(largest, box ? (box.width * box.height) / totalArea : 0);
        }, 0);
        return { detected: faces.length > 0, areaRatio };
      } catch {
        return { detected: false, areaRatio: 0 };
      }
    }

    async function runAIAdapter(payload) {
      const imageAI = window.AsbestosImageAI;
      if (imageAI && typeof imageAI.analyze === 'function') {
        try {
          updateProgress(
            Math.min(82, 20 + ((payload.imageIndex + 1) * 12)),
            imageAI.ready && typeof imageAI.ready.then === 'function'
              ? '画像判定機能を準備しています'
              : `${payload.imageIndex + 1}枚目を画像AIで確認しています`
          );
          if (imageAI.ready && typeof imageAI.ready.then === 'function') await imageAI.ready;
          updateProgress(
            Math.min(84, 25 + ((payload.imageIndex + 1) * 13)),
            `${payload.imageIndex + 1}枚目を画像AIで確認しています`
          );
          const result = await imageAI.analyze(payload.file, payload.features);
          if (!result || result.available === false) return null;
          const topLabels = Array.isArray(result.topLabels) ? result.topLabels : [];
          const labels = result.materialLabel
            ? [{ label: result.materialLabel, score: result.buildingScore ?? 1 }, ...topLabels]
            : topLabels;
          return {
            ...result,
            materialProbability: result.buildingScore,
            similarity: result.asbestosSimilarity,
            labels
          };
        } catch (error) {
          console.warn('[Asbestos check] Image AI failed; marking the image unavailable.', error);
          return null;
        }
      }

      const adapter = window.AsbestosCheckAIAdapter || window.AsbestosCheckAI;
      const analyze = typeof adapter === 'function'
        ? adapter
        : adapter?.analyzeImage || adapter?.analyze;
      if (typeof analyze !== 'function') return null;

      try {
        const result = await analyze.call(adapter, payload);
        return result && typeof result === 'object' ? result : null;
      } catch (error) {
        console.warn('[Asbestos check] Local AI adapter failed; marking the image unavailable.', error);
        return null;
      }
    }

    function interpretImage(features, adapter, face) {
      const adapterLabels = normalizeAdapterLabels(adapter?.labels || adapter?.predictions);
      const prominentNonMaterial = adapterLabels.find(({ label }) => isNonMaterialLabel(label));
      const adapterMaterialProbability = finiteNumber(adapter?.materialProbability);
      const adapterSimilarity = normalizeProbability(
        adapter?.similarity ?? adapter?.visualSimilarity ?? adapter?.asbestosSimilarity
      );
      const adapterInvalidReason = typeof adapter?.invalidReason === 'string'
        ? adapter.invalidReason.trim()
        : '';
      const explicitUnusable = adapter?.unusable === true
        || adapter?.isMaterial === false
        || (
          adapterMaterialProbability !== null
          && (
            adapterMaterialProbability < 0.1
            || (adapterMaterialProbability < 0.18 && Boolean(prominentNonMaterial))
          )
        );

      let reason = '';
      if (!adapter) {
        reason = '画像判定機能を読み込めませんでした。通信環境を確認して、もう一度お試しください。';
      } else if (features.completelyObscured || features.likelyBlank) {
        reason = '画像が暗すぎる、明るすぎる、または建材の形を確認できません。';
      } else if (features.severelyBlurred) {
        reason = '画像が大きくぼけているため、建材の特徴を確認できません。';
      } else if (features.strongSkyPattern) {
        reason = '空が画像の大部分を占めており、建材を確認できません。';
      } else if (explicitUnusable && adapterInvalidReason) {
        reason = adapterInvalidReason;
      } else if (explicitUnusable && prominentNonMaterial) {
        reason = `${nonMaterialName(prominentNonMaterial.label)}が中心に写っており、建材を確認できません。`;
      } else if (
        face.detected
        && face.areaRatio > 0.16
        && features.edgeDensity < 0.09
        && (adapterMaterialProbability === null || adapterMaterialProbability < 0.32)
      ) {
        reason = '人物が大きく写っており、建材を十分に確認できません。';
      } else if (explicitUnusable && adapterMaterialProbability !== null && adapterMaterialProbability < 0.2) {
        reason = '建材を認識できません。建材が画面の半分以上に写るよう撮影してください。';
      }

      const adapterWeight = adapterSimilarity === null ? 0 : 0.78;
      const visualSimilarity = adapterSimilarity === null
        ? features.visualSimilarity
        : clamp((adapterSimilarity * adapterWeight) + (features.visualSimilarity * (1 - adapterWeight)));
      const adapterConfidence = normalizeProbability(adapter?.confidence);

      return {
        usable: !reason,
        reason,
        quality: features.quality,
        visualSimilarity,
        materialProbability: adapterMaterialProbability,
        adapterConfidence,
        surveyPriority: typeof adapter?.surveyPriority === 'string'
          ? adapter.surveyPriority
          : '',
        adapterUsed: Boolean(adapter),
        features
      };
    }

    function normalizeAdapterLabels(value) {
      if (!Array.isArray(value)) return [];
      return value.map((item) => {
        if (typeof item === 'string') return { label: item, score: 1 };
        return {
          label: String(item?.label || item?.class || ''),
          score: normalizeProbability(item?.score ?? item?.probability) ?? 0
        };
      }).filter(({ label }) => label);
    }

    function isNonMaterialLabel(label) {
      return /(sky|car|automobile|vehicle|bus|truck|motorcycle|person|people|human|face|animal|dog|cat|空|自動車|車両|人物|人間|顔|動物)/i.test(label);
    }

    function nonMaterialName(label) {
      if (/(person|people|human|face|人物|人間|顔)/i.test(label)) return '人物';
      if (/(car|automobile|vehicle|bus|truck|motorcycle|自動車|車両)/i.test(label)) return '車両';
      if (/(sky|空)/i.test(label)) return '空';
      if (/(animal|dog|cat|動物)/i.test(label)) return '動物';
      return '建材以外のもの';
    }

    function buildAssessment(analyses, details) {
      const usable = analyses.filter((analysis) => analysis.usable);
      const unusable = analyses.filter((analysis) => !analysis.usable);
      if (!usable.length) {
        const reason = analyses.map((analysis) => analysis.reason).find(Boolean)
          || '建材を認識できませんでした。明るい場所で建材を大きく撮影してください。';
        return {
          status: 'unavailable',
          score: 0,
          label: '判定不能',
          similarity: '判定不能',
          confidence: '判定不能',
          message: '写真から建材の特徴を確認できませんでした。建材部分が画面の半分以上になるように撮影し直してください。',
          reason
        };
      }

      const similarityValue = weightedAverage(
        usable.map((analysis) => analysis.visualSimilarity),
        usable.map((analysis) => 0.55 + (analysis.quality * 0.45))
      );
      const yearRisk = constructionYearRisk(details.constructionYear, details.renovationYear);
      const workRisk = workPlanRisk(details.workPlan);
      const locationRiskValue = locationRisk(details.location);
      const hasSprayedFibrousPriority = usable.some(
        (analysis) => analysis.surveyPriority === 'sprayed-fibrous'
      );
      const detailRisk = yearRisk + workRisk + locationRiskValue;
      let score = similarityValue >= 0.68 ? 4 : similarityValue >= 0.38 ? 3 : 1;
      if (similarityValue < 0.38 && detailRisk >= 0.35) score = 2;
      if (detailRisk >= 0.75) score += 1;
      if (hasSprayedFibrousPriority) score = 5;
      score = Math.round(clamp(score, 1, 5));
      const similarity = similarityValue >= 0.68 ? '高' : similarityValue >= 0.38 ? '中' : '低';

      const detailCompletion = detailCompletionRatio(details);
      const photoBonus = [0, 0.08, 0.14, 0.2][Math.min(3, usable.length - 1)];
      const similarityValues = usable.map((analysis) => analysis.visualSimilarity);
      const similaritySpread = usable.length > 1
        ? Math.max(...similarityValues) - Math.min(...similarityValues)
        : 0;
      const disagreementPenalty = Math.min(0.16, similaritySpread * 0.35);
      const adapterConfidenceValues = usable
        .map((analysis) => analysis.adapterConfidence)
        .filter((value) => value !== null);
      const adapterBonus = adapterConfidenceValues.length ? average(adapterConfidenceValues) * 0.1 : 0;
      const confidenceValue = clamp(
        (average(usable.map((analysis) => analysis.quality)) * 0.55)
        + photoBonus
        + (detailCompletion * 0.28)
        + adapterBonus
        - disagreementPenalty
        - (unusable.length * 0.05)
      );
      const confidence = confidenceValue >= 0.72 ? '高' : confidenceValue >= 0.43 ? '中' : '低';
      const excludedNote = unusable.length
        ? `${unusable.length}枚は建材を十分に確認できなかったため、確認できた${usable.length}枚で判定しました。`
        : '';

      return {
        status: 'complete',
        score,
        label: SCORE_LABELS[score - 1],
        similarity,
        confidence,
        message: SCORE_MESSAGES[score - 1],
        reason: excludedNote,
        metrics: {
          similarity: Number(similarityValue.toFixed(3)),
          confidence: Number(confidenceValue.toFixed(3)),
          usablePhotos: usable.length,
          excludedPhotos: unusable.length
        }
      };
    }

    function renderResult(result) {
      if (resultScore) renderWarningMeter(resultScore, result.score, result.label);
      if (resultSimilarity) {
        resultSimilarity.textContent = result.similarity;
        resultSimilarity.dataset.level = result.similarity;
      }
      if (resultConfidence) {
        resultConfidence.textContent = result.confidence;
        resultConfidence.dataset.level = result.confidence;
      }
      if (resultMessage) resultMessage.textContent = result.message;
      if (resultReason) {
        resultReason.textContent = result.reason || '';
        resultReason.hidden = !result.reason;
      }
      root.classList.toggle('has-unavailable-result', result.status === 'unavailable');
    }

    function renderWarningMeter(container, score, label) {
      container.replaceChildren();
      container.classList.add('check-warning-meter');
      container.dataset.score = String(score);
      container.setAttribute(
        'aria-label',
        score ? `調査推奨度 ${label}、5段階中${score}` : '調査推奨度 判定不能'
      );
      for (let index = 1; index <= 5; index += 1) {
        const icon = document.createElement('span');
        icon.className = 'check-warning-icon';
        icon.classList.toggle('is-active', index <= score);
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = [
          '<svg viewBox="0 0 32 29" focusable="false">',
          '<path d="M14.03 3.3a2.28 2.28 0 0 1 3.94 0l12.04 20.82A2.27 2.27 0 0 1 28.04 27H3.96a2.27 2.27 0 0 1-1.97-3.4L14.03 3.3Z"/>',
          '<path class="check-warning-mark" d="M14.65 9.2h2.7l-.36 9.25h-1.98l-.36-9.25Zm.08 12.03h2.54v2.45h-2.54v-2.45Z"/>',
          '</svg>'
        ].join('');
        container.append(icon);
      }
    }

    function collectDetails() {
      const data = {};
      const fields = [
        'constructionYear',
        'renovationYear',
        'location',
        'environment',
        'workPlan',
        'manufacturer',
        'productName',
        'productNumber'
      ];
      fields.forEach((name) => {
        const controls = detailsForm
          ? [...detailsForm.querySelectorAll(`[name="${name}"]`)]
          : queryAll(`[name="${name}"]`);
        const selected = controls.find((control) => {
          if (control.type === 'radio' || control.type === 'checkbox') return control.checked;
          return true;
        });
        data[name] = selected ? String(selected.value || '').trim() : '';
        data[`${name}Label`] = selected ? readableControlValue(selected) : '';
      });
      return data;
    }

    function constructionYearRisk(constructionYear, renovationYear) {
      const values = [constructionYear, renovationYear].filter((value) => !isUnknown(value));
      if (!values.length) return 0;
      return Math.max(...values.map((value) => {
        const text = String(value);
        const year = Number(text.match(/(?:19|20)\d{2}/)?.[0]);
        if (/before.?1975|1975.*以前|昭和50.*以前/i.test(text) || (year && year <= 1975)) return 1.15;
        if (/1976.?1995|昭和51.*平成7/i.test(text) || (year && year <= 1995)) return 1.02;
        if (/1996.?2006|平成8.*平成18/i.test(text) || (year && year <= 2006)) return 0.82;
        if (/after.?2006|2007.*以降|平成19.*以降/i.test(text) || year > 2006) return 0;
        return 0;
      }));
    }

    function workPlanRisk(value) {
      if (isUnknown(value)) return 0;
      const text = String(value);
      if (/(解体|改修|切断|穴あけ|穴開け|撤去|研磨|破砕|demolition|renovation|cut|drill|remov(?:e|al)|grind)/i.test(text)) return 0.82;
      if (/(予定なし|工事なし|none|no-work)/i.test(text)) return 0.04;
      return 0.3;
    }

    function locationRisk(value) {
      if (isUnknown(value)) return 0;
      const text = String(value);
      if (/(吹付|耐火被覆|保温|断熱|煙突|配管|ダクト|梁|柱|spray|fireproof|insulation|pipe|duct)/i.test(text)) return 0.42;
      if (/(天井|屋根|外壁|軒天|ceiling|roof|exterior)/i.test(text)) return 0.28;
      return 0.16;
    }

    function detailCompletionRatio(details) {
      const grouped = [
        details.constructionYear,
        details.renovationYear,
        details.location,
        details.environment,
        details.workPlan
      ];
      return grouped.filter((value) => !isUnknown(value)).length / grouped.length;
    }

    function saveHandoff() {
      const { details, ...result } = state.lastResult;
      const now = Date.now();
      const productInfo = [
        details.manufacturer,
        details.productName,
        details.productNumber
      ].filter((value) => !isUnknown(value)).join('・').slice(0, 120);

      const payload = {
        version: 1,
        source: 'asbestos-check',
        createdAt: now,
        result: {
          recommendationScore: result.score || null,
          similarity: result.similarity,
          confidence: result.confidence === '判定不能' ? '低' : result.confidence,
          summary: String(result.message || '').slice(0, 160)
        },
        inputs: {
          constructionYear: details.constructionYearLabel || '',
          renovationYear: details.renovationYearLabel || '',
          location: details.locationLabel || '',
          environment: details.environmentLabel || '',
          workPlan: details.workPlanLabel || '',
          productInfo
        }
      };

      try {
        sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
      } catch (error) {
        console.warn('[Asbestos check] The inquiry handoff could not be saved.', error);
      }
    }

    function resetCheck() {
      releaseAllObjectUrls();
      state.photos = [];
      state.lastResult = null;
      detailsForm?.reset();
      queryAll('[data-detail-row]').forEach((row) => {
        closeDetailRowWithoutFocus(row);
        updateDetailSummary(row);
      });
      photoInputs.forEach((input) => { input.value = ''; });
      if (progress) progress.hidden = true;
      if (resultReason) resultReason.hidden = true;
      root.classList.remove('has-unavailable-result');
      clearError();
      updatePhotoView();
      showStep('upload');
      query('[data-check-step="upload"]')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }

    function closeDetailRowWithoutFocus(row) {
      const editor = row.querySelector('[data-detail-editor]');
      const editTrigger = row.querySelector('[data-detail-edit]') || row.querySelector('[data-detail-summary]');
      if (row.tagName === 'DETAILS') row.open = false;
      else if (editor) editor.hidden = true;
      row.classList.remove('is-editing');
      editTrigger?.setAttribute('aria-expanded', 'false');
    }

    function showError(message) {
      if (!errorBoxes.length) return;
      const activeStep = query(`[data-check-step="${state.activeStep}"]`);
      const visibleBox = activeStep?.querySelector('[data-check-error]') || errorBoxes[0];
      errorBoxes.forEach((box) => {
        const active = box === visibleBox;
        box.textContent = active ? message : '';
        box.hidden = !active;
        if (active) box.setAttribute('role', 'alert');
      });
    }

    function clearError() {
      errorBoxes.forEach((box) => {
        box.textContent = '';
        box.hidden = true;
      });
    }
  }

  function readableControlValue(control) {
    if (!control || ((control.type === 'radio' || control.type === 'checkbox') && !control.checked)) return '';
    const value = String(control.value || '').trim();
    if (isUnknown(value)) return '';
    if (control.tagName === 'SELECT') {
      return String(control.selectedOptions?.[0]?.textContent || value).trim();
    }
    return value;
  }

  function isSupportedImage(file) {
    return file?.type?.startsWith('image/')
      || /\.(avif|heic|heif|jpe?g|png|webp)$/i.test(file?.name || '');
  }

  function fileIdentity(file) {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }

  function normalizeBasePath(value) {
    const path = String(value || '/asbestos').trim() || '/asbestos';
    return `/${path.replace(/^\/+|\/+$/g, '')}`;
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeProbability(value) {
    const number = finiteNumber(value);
    if (number === null) return null;
    return clamp(number > 1 ? number / 100 : number);
  }

  function weightedAverage(values, weights) {
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    if (!weightTotal) return average(values);
    return values.reduce((sum, value, index) => sum + (value * weights[index]), 0) / weightTotal;
  }

  function reducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }
})();
