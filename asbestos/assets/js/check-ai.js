/**
 * アスベスト調査推奨度チェック — 端末内画像解析
 *
 * このモジュールが返す値は、石綿含有の有無や含有率ではなく、
 * 写真が建材として認識できるか、および登録済みの建材表現との
 * 画像上の近さを、画面側の判定ロジックへ渡すための補助情報です。
 */

const AI_ASSET_ROOT = new URL("../ai/", import.meta.url);
const MODEL_ID = "tinyclip_vit_39m_16_text_19m";
const CLIP_MAX_SEQUENCE_LENGTH = 77;
const MIN_BUILDING_SCORE = 0.27;

const LABEL_GROUPS = Object.freeze({
  elevatedConcern: [
    "sprayed fibrous fireproofing coating on structural steel or a concrete ceiling",
    "delaminated rough sprayed fireproofing coating peeling away from a ceiling or structural surface",
    "loose fluffy fibrous insulation inside a building cavity",
    "old damaged thermal insulation lagging around a pipe or boiler",
    "damaged fibrous pipe insulation exposed inside a clear plastic glove bag while a worker handles it through built-in gloves",
    "crumbly fibrous residue released from insulation or fireproofing",
    "old lagging splash residue or insulation coating left on concrete metal or pipework"
  ],
  suspectMaterial: [
    "old flat fibre cement board or insulation board used in a building",
    "flat grey fibre cement wall panel being drilled with a power tool inside plastic containment",
    "old flat soffit panel board beneath the eaves of a roof",
    "old corrugated fibre cement roofing sheet or slate roof tile",
    "weathered corrugated fibre cement roofing sheets or slate roof tiles viewed closely from adjacent scaffolding",
    "old square vinyl floor tile or black bitumen flooring adhesive",
    "old textured decorative coating on a ceiling or wall",
    "old wall coating plaster or wallpaper being sampled through a small wet plastic containment sheet",
    "old woven heat resistant rope gasket packing or textile",
    "old ceiling tile acoustic panel or fire resistant board"
  ],
  ordinaryMaterial: [
    "modern mineral wool glass wool or rock wool building insulation",
    "ordinary concrete mortar plaster or stucco surface",
    "modern gypsum plasterboard calcium silicate board or cement board",
    "wood plywood timber or chipboard building material",
    "metal roofing duct pipe or metal building panel",
    "ceramic tile brick stone or glass building finish",
    "modern plastic vinyl or rubber floor covering",
    "modern foam insulation plastic sheet or painted surface",
    "clean smooth uniformly painted structural steel beam with an intact glossy surface during inspection",
    "clean bare stainless steel chimney flue ventilation duct or metal pipe beside a concrete wall"
  ],
  invalidSubject: [
    "a website screenshot app interface text document chart or computer screen",
    "a mobile phone screenshot of a website or social media app",
    "a printed page form receipt book or paper document",
    "a person portrait face clothing body or hand",
    "a laboratory scientist microscope test instrument or small specimen slide without a visible building material",
    "workers protective clothing respirators clipboard or tools without a close-up building material",
    "air monitoring equipment fan duct machine or plastic work enclosure without an exposed building material",
    "a grey air sampling monitor with two white tubes mounted on a black tripod and a worker writing on a clipboard beside a sealed plastic doorway",
    "sealed plastic bags wrapped waste packages pallets or containers with no exposed building material",
    "architects engineers meeting paperwork plans clipboard or office desk",
    "two people in winter coats standing on snowy ground and reviewing architectural drawings in front of a distant building",
    "a distant building exterior skyline wide room or demolition site with no close-up building material",
    "a safety sign warning notice label poster or instruction board",
    "a car truck bicycle vehicle or machine outdoors",
    "open sky clouds sea mountain landscape or vegetation",
    "food animal plant flower furniture appliance or household object",
    "a photograph with no visible building material"
  ]
});

const MATERIAL_NAMES = new Map([
  ["sprayed fibrous fireproofing coating on structural steel or a concrete ceiling", "吹付け材・繊維状被覆"],
  ["delaminated rough sprayed fireproofing coating peeling away from a ceiling or structural surface", "剥離・劣化した吹付け被覆"],
  ["loose fluffy fibrous insulation inside a building cavity", "ルーズフィル・繊維状断熱材"],
  ["old damaged thermal insulation lagging around a pipe or boiler", "配管・ボイラー保温材"],
  ["damaged fibrous pipe insulation exposed inside a clear plastic glove bag while a worker handles it through built-in gloves", "グローブバッグ内の配管保温材"],
  ["crumbly fibrous residue released from insulation or fireproofing", "劣化した繊維状被覆・残さ"],
  ["old lagging splash residue or insulation coating left on concrete metal or pipework", "保温材の飛散付着物・残さ"],
  ["old flat fibre cement board or insulation board used in a building", "ボード状建材"],
  ["flat grey fibre cement wall panel being drilled with a power tool inside plastic containment", "壁・天井のボード状建材"],
  ["old flat soffit panel board beneath the eaves of a roof", "軒天・ボード状建材"],
  ["old corrugated fibre cement roofing sheet or slate roof tile", "波形スレート・屋根材"],
  ["weathered corrugated fibre cement roofing sheets or slate roof tiles viewed closely from adjacent scaffolding", "スレート・屋根材"],
  ["old square vinyl floor tile or black bitumen flooring adhesive", "床タイル・接着剤"],
  ["old textured decorative coating on a ceiling or wall", "仕上塗材・模様付き塗膜"],
  ["old wall coating plaster or wallpaper being sampled through a small wet plastic containment sheet", "壁材・仕上塗材の採取箇所"],
  ["old woven heat resistant rope gasket packing or textile", "ガスケット・パッキン・繊維製品"],
  ["old ceiling tile acoustic panel or fire resistant board", "天井板・吸音板・耐火板"],
  ["modern mineral wool glass wool or rock wool building insulation", "繊維系断熱材"],
  ["ordinary concrete mortar plaster or stucco surface", "コンクリート・モルタル・しっくい"],
  ["modern gypsum plasterboard calcium silicate board or cement board", "ボード状建材"],
  ["wood plywood timber or chipboard building material", "木質建材"],
  ["metal roofing duct pipe or metal building panel", "金属系建材"],
  ["ceramic tile brick stone or glass building finish", "タイル・れんが・石材"],
  ["modern plastic vinyl or rubber floor covering", "床材"],
  ["modern foam insulation plastic sheet or painted surface", "樹脂・塗装・発泡系建材"],
  ["clean smooth uniformly painted structural steel beam with an intact glossy surface during inspection", "塗装された鉄骨・金属部材"],
  ["clean bare stainless steel chimney flue ventilation duct or metal pipe beside a concrete wall", "金属製の煙突・ダクト・配管"]
]);

const ALL_LABELS = Object.freeze([
  ...LABEL_GROUPS.elevatedConcern,
  ...LABEL_GROUPS.suspectMaterial,
  ...LABEL_GROUPS.ordinaryMaterial,
  ...LABEL_GROUPS.invalidSubject
]);
const MATERIAL_LABELS = new Set([
  ...LABEL_GROUPS.elevatedConcern,
  ...LABEL_GROUPS.suspectMaterial,
  ...LABEL_GROUPS.ordinaryMaterial
]);
const SCREENSHOT_LABELS = Object.freeze([
  "a website screenshot app interface text document chart or computer screen",
  "a mobile phone screenshot of a website or social media app",
  "a printed page form receipt book or paper document"
]);

let runtimePromise;
let classifierPromise;

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function isSafari() {
  const userAgent = navigator.userAgent || "";
  const vendor = navigator.vendor || "";
  return (
    vendor.includes("Apple") &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|mercury|brave|Chrome|Android/i.test(userAgent)
  );
}

function emitProgress(detail) {
  window.dispatchEvent(
    new CustomEvent("asbestos-ai-progress", {
      detail: {
        phase: detail?.status || detail?.phase || "loading",
        file: detail?.file || "",
        progress:
          typeof detail?.progress === "number"
            ? clamp(detail.progress / (detail.progress > 1 ? 100 : 1))
            : null
      }
    })
  );
}

async function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = import(
      new URL("runtime/transformers.web.min.js", AI_ASSET_ROOT).href
    ).then((module) => {
      const { env } = module;

      env.allowLocalModels = true;
      env.allowRemoteModels = false;
      env.localModelPath = AI_ASSET_ROOT.href;
      env.useBrowserCache = true;

      const wasmFileBase = isSafari()
        ? "ort-wasm-simd-threaded"
        : "ort-wasm-simd-threaded.asyncify";

      env.backends.onnx.wasm.wasmPaths = {
        // .js is used intentionally so conservative static hosts return a
        // JavaScript MIME type without requiring a custom .mjs mapping.
        mjs: new URL(`runtime/${wasmFileBase}.js`, AI_ASSET_ROOT).href,
        wasm: new URL(`runtime/${wasmFileBase}.wasm`, AI_ASSET_ROOT).href
      };

      // SharedArrayBufferを使えない通常配信でも確実に動く設定を優先する。
      env.backends.onnx.wasm.numThreads =
        self.crossOriginIsolated && (navigator.hardwareConcurrency || 1) > 1
          ? Math.min(4, navigator.hardwareConcurrency)
          : 1;
      env.backends.onnx.wasm.proxy = false;

      return module;
    });
  }

  return runtimePromise;
}

async function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = loadRuntime()
      .then(async ({
        CLIPImageProcessor,
        CLIPModel,
        CLIPTokenizer,
        RawImage
      }) => {
        const localOptions = {
          local_files_only: true,
          progress_callback: emitProgress
        };
        const [tokenizerDefinition, tokenizerConfig, processor, model] =
          await Promise.all([
            loadLocalJson("tokenizer.json"),
            loadLocalJson("tokenizer_config.json"),
            CLIPImageProcessor.from_pretrained(MODEL_ID, localOptions),
            CLIPModel.from_pretrained(MODEL_ID, {
              ...localOptions,
              device: "wasm",
              dtype: "q8"
            })
          ]);
        const tokenizer = new CLIPTokenizer(tokenizerDefinition, tokenizerConfig);
        const prompts = ALL_LABELS.map(
          (label) => `This is a close-up photograph of ${label}`
        );
        const textInputs = tokenizer(prompts, {
          padding: true,
          truncation: true,
          max_length: CLIP_MAX_SEQUENCE_LENGTH
        });

        emitProgress({ status: "ready", progress: 1 });
        return async (canvas) => {
          const image = RawImage.fromCanvas(canvas);
          const imageInputs = await processor(image);
          let output;

          try {
            output = await model({
              ...textInputs,
              pixel_values: imageInputs.pixel_values
            });
            const logitsTensor = output.logits_per_image;
            const logits = Array.from(logitsTensor?.data || [], Number);
            if (
              logitsTensor?.dims?.[0] !== 1 ||
              logitsTensor?.dims?.[1] !== ALL_LABELS.length ||
              logits.length !== ALL_LABELS.length ||
              logits.some((value) => !Number.isFinite(value))
            ) {
              throw new Error("画像判定モデルの出力形式を確認できませんでした。");
            }
            const probabilities = softmax(logits);
            return ALL_LABELS
              .map((label, index) => ({ label, score: probabilities[index] }))
              .sort((left, right) => right.score - left.score);
          } finally {
            disposeTensorRecord(imageInputs);
            disposeTensorRecord(output);
          }
        };
      })
      .catch((error) => {
        classifierPromise = undefined;
        throw error;
      });
  }

  return classifierPromise;
}

async function loadLocalJson(relativePath) {
  const url = new URL(`${MODEL_ID}/${relativePath}`, AI_ASSET_ROOT);
  const response = await fetch(url.href, {
    credentials: "same-origin",
    cache: "force-cache"
  });
  if (!response.ok) {
    throw new Error(
      `AI model metadata could not be loaded (${response.status}: ${relativePath})`
    );
  }
  return response.json();
}

function softmax(values) {
  const maximum = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0) || 1;
  return exponentials.map((value) => value / total);
}

function disposeTensorRecord(record) {
  if (!record || typeof record !== "object") return;
  Object.values(record).forEach((value) => value?.dispose?.());
}

async function decodeToCanvas(file) {
  if (!(file instanceof Blob)) {
    throw new TypeError("画像ファイルを読み込めませんでした。");
  }

  const maxSide = 1280;
  let source;
  let revokeUrl = "";

  try {
    if ("createImageBitmap" in window) {
      source = await createImageBitmap(file, { imageOrientation: "from-image" });
    } else {
      revokeUrl = URL.createObjectURL(file);
      source = await new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("画像を表示できませんでした。"));
        image.src = revokeUrl;
      });
    }

    const originalWidth = source.width || source.naturalWidth;
    const originalHeight = source.height || source.naturalHeight;
    if (!originalWidth || !originalHeight) {
      throw new Error("画像サイズを取得できませんでした。");
    }

    const scale = Math.min(1, maxSide / Math.max(originalWidth, originalHeight));
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", {
      alpha: false,
      willReadFrequently: false
    });
    if (!context) {
      throw new Error("画像を処理できませんでした。");
    }

    context.drawImage(source, 0, 0, width, height);
    return canvas;
  } finally {
    if (source && typeof source.close === "function") {
      source.close();
    }
    if (revokeUrl) {
      URL.revokeObjectURL(revokeUrl);
    }
  }
}

function scoreMap(results) {
  return new Map(
    results.map(({ label, score }) => [
      label,
      Number.isFinite(score) ? clamp(score) : 0
    ])
  );
}

function maxScore(scores, labels) {
  return Math.max(...labels.map((label) => scores.get(label) || 0), 0);
}

function topMaterial(results) {
  const materialLabels = new Set([
    ...LABEL_GROUPS.elevatedConcern,
    ...LABEL_GROUPS.suspectMaterial,
    ...LABEL_GROUPS.ordinaryMaterial
  ]);
  const top = results.find((item) => materialLabels.has(item.label));
  return top ? MATERIAL_NAMES.get(top.label) || "建材" : "";
}

async function analyze(file, imageFeatures = {}) {
  const canvas = await decodeToCanvas(file);
  const classifier = await getClassifier();
  const results = await classifier(canvas);
  const scores = scoreMap(results);

  const elevatedConcernMax = maxScore(scores, LABEL_GROUPS.elevatedConcern);
  const suspectMaterialMax = maxScore(scores, LABEL_GROUPS.suspectMaterial);
  const ordinaryMaterialMax = maxScore(scores, LABEL_GROUPS.ordinaryMaterial);
  const invalidMax = maxScore(scores, LABEL_GROUPS.invalidSubject);
  const concernMax = Math.max(elevatedConcernMax, suspectMaterialMax);
  const materialMax = Math.max(concernMax, ordinaryMaterialMax);
  const buildingScore = materialMax / Math.max(0.000001, materialMax + invalidMax);
  const baseSimilarity =
    concernMax / Math.max(0.000001, concernMax + ordinaryMaterialMax);
  const topFive = results.slice(0, 5);
  const topFiveMaterialCount = topFive.filter(({ label }) =>
    MATERIAL_LABELS.has(label)
  ).length;
  const topLabel = results[0]?.label || "";
  const elevatedConcernDetected =
    LABEL_GROUPS.elevatedConcern.includes(topLabel) &&
    elevatedConcernMax >= ordinaryMaterialMax * 0.82 &&
    elevatedConcernMax >= invalidMax * 0.72;
  const strongDarkInterfacePattern =
    imageFeatures.meanBrightness < 85 &&
    imageFeatures.neutralRatio > 0.86 &&
    imageFeatures.entropy < 0.55 &&
    imageFeatures.edgeDensity > 0.08 &&
    imageFeatures.flatColorRatio > 0.45 &&
    invalidMax >= materialMax * 0.85;
  const strongBrightInterfacePattern =
    imageFeatures.meanBrightness > 205 &&
    imageFeatures.neutralRatio > 0.82 &&
    imageFeatures.saturation < 0.18 &&
    imageFeatures.entropy < 0.48 &&
    imageFeatures.edgeDensity > 0.02 &&
    imageFeatures.flatColorRatio > 0.62 &&
    invalidMax >= materialMax * 0.85;
  const imageAspectRatio =
    Math.max(imageFeatures.width, imageFeatures.height) /
    Math.max(1, Math.min(imageFeatures.width, imageFeatures.height));
  const extremeCropPattern = imageAspectRatio > 4.5;
  // Keep the ordinary material threshold permissive. Workers and tools often
  // appear beside real building materials, so a generic "person" or
  // "no visible material" label alone must not reject the photograph.
  const invalidDominance =
    topFiveMaterialCount <= 2 &&
    invalidMax >= materialMax * 2.05;
  const screenshotScore = maxScore(scores, SCREENSHOT_LABELS);
  const flatInterfacePattern =
    imageFeatures.flatColorRatio > 0.58 &&
    imageFeatures.entropy < 0.55 &&
    screenshotScore >= materialMax * 0.8 &&
    invalidMax >= materialMax * 0.95;
  // Screen/document prompts are calibrated against real site-review captures.
  // The separate invalid margin is intentionally above the highest value seen
  // across the public building-material reference set.
  const screenshotDominance =
    (
      screenshotScore >= materialMax * 1.35 &&
      screenshotScore >= invalidMax * 0.55
    ) ||
    strongDarkInterfacePattern ||
    strongBrightInterfacePattern ||
    flatInterfacePattern;
  const strongFibrousTexturePattern =
    imageFeatures.meanBrightness > 45 &&
    imageFeatures.meanBrightness < 130 &&
    imageFeatures.neutralRatio > 0.88 &&
    imageFeatures.saturation < 0.12 &&
    imageFeatures.entropy > 0.7 &&
    imageFeatures.edgeDensity > 0.38 &&
    imageFeatures.flatColorRatio < 0.3 &&
    imageFeatures.gradientMean > 20;
  // The browser and CPU runtimes can differ slightly around close scores.
  // Require both a close, continuous sprayed-surface texture and supporting
  // elevated-concern labels. A generic insulation label alone must not raise
  // the result to the highest level.
  const sprayedFibrousPriority =
    !screenshotDominance &&
    !invalidDominance &&
    strongFibrousTexturePattern &&
    elevatedConcernMax >= invalidMax * 0.72 &&
    elevatedConcernMax >= ordinaryMaterialMax * 0.72;
  const similarity = sprayedFibrousPriority
    ? Math.max(baseSimilarity, 0.86)
    : elevatedConcernDetected
      ? Math.max(baseSimilarity, 0.76)
      : baseSimilarity;
  const invalidReason = screenshotDominance
    ? "画面またはスクリーンショットが中心に写っており、建材を確認できません。"
    : invalidDominance
      ? "建材以外のものが中心に写っており、建材を十分に確認できません。"
      : extremeCropPattern
        ? "画像の縦横比が極端なため、建材全体を確認できません。建材全体が入る写真をお試しください。"
        : buildingScore < MIN_BUILDING_SCORE
          ? "建材を十分な大きさで確認できません。建材部分を近くから撮影してください。"
          : "";
  const classificationConfidence = clamp(
    0.45
    + (Math.abs(buildingScore - 0.5) * 0.7)
    + (Math.min(0.2, Math.max(0, (results[0]?.score || 0) - (results[1]?.score || 0))) * 0.5)
  );

  const output = {
    available: true,
    buildingScore: clamp(buildingScore),
    asbestosSimilarity: clamp(similarity),
    isMaterial:
      buildingScore >= MIN_BUILDING_SCORE &&
      !invalidDominance &&
      !screenshotDominance &&
      !extremeCropPattern,
    unusable:
      buildingScore < MIN_BUILDING_SCORE ||
      invalidDominance ||
      screenshotDominance ||
      extremeCropPattern,
    invalidReason,
    confidence: classificationConfidence,
    surveyPriority: sprayedFibrousPriority ? "sprayed-fibrous" : "",
    materialLabel: topMaterial(results),
    topLabels: results.slice(0, 5).map(({ label, score }) => ({
      label,
      score: Math.round(score * 10000) / 10000
    })),
    imageFeatures
  };
  return output;
}

async function warmup() {
  await getClassifier();
  return true;
}

window.AsbestosImageAI = Object.freeze({
  version: "2.0.0",
  analyze,
  warmup
});
