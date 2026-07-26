// Загрузчик слоёв питомца.
//
// Логика простая и намеренно терпимая к отсутствующим файлам: пробуем
// загрузить все слои; если хотя бы один не пришёл — откатываемся на
// цельный source.png. Если и его нет, компонент просто ничего не рисует,
// но приложение продолжает работать.

import type { PetAssetState, PetLayerName } from "./petTypes";
import { ASSET_DIR, LAYER_FILES, LAYER_ORDER, SOURCE_FILE } from "./petRigConfig";

/** Ошибки, о которых уже сообщили — чтобы не засорять консоль на каждый ремоунт. */
const warned = new Set<string>();

function warnOnce(message: string) {
  if (!import.meta.env.DEV) return;
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[PetCompanion] ${message}`);
}

/** Сбрасывает память о предупреждениях — нужно после hot reload. */
export function resetAssetWarnings() {
  warned.clear();
}

if (import.meta.hot) {
  import.meta.hot.on("vite:beforeUpdate", resetAssetWarnings);
}

export function assetUrl(file: string) {
  const base = import.meta.env.BASE_URL || "/";
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}${ASSET_DIR}/${file}`;
}

function loadImage(url: string, signal?: AbortSignal): Promise<string | null> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(null);
      return;
    }
    if (typeof Image === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      img.onload = null;
      img.onerror = null;
      signal?.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => {
      img.src = "";
      finish(null);
    };
    img.onload = () => finish(url);
    img.onerror = () => finish(null);
    signal?.addEventListener("abort", onAbort, { once: true });
    img.decoding = "async";
    img.src = url;
  });
}

/**
 * Грузит слои и исходник. Возвращает состояние, пригодное для отрисовки:
 * layered — есть все слои, fallback — рисуем source.png, empty — рисовать нечего.
 */
export async function loadPetAssets(
  signal?: AbortSignal,
): Promise<PetAssetState> {
  const entries = await Promise.all(
    LAYER_ORDER.map(async (name) => {
      const url = await loadImage(assetUrl(LAYER_FILES[name]), signal);
      return [name, url] as const;
    }),
  );

  const layers: Partial<Record<PetLayerName, string>> = {};
  const missing: PetLayerName[] = [];
  for (const [name, url] of entries) {
    if (url) layers[name] = url;
    else missing.push(name);
  }

  if (missing.length === 0) {
    return { status: "layered", layers, missing };
  }

  const sourceUrl = await loadImage(assetUrl(SOURCE_FILE), signal);

  if (signal?.aborted) {
    return { status: "loading", layers: {}, missing };
  }

  if (sourceUrl) {
    warnOnce(
      `нет слоёв: ${missing.join(", ")}. Показываю ${SOURCE_FILE} целиком — ` +
        `руки и моргание в этом режиме не анимируются.`,
    );
    return { status: "fallback", layers, sourceUrl, missing };
  }

  warnOnce(
    `не найдено ни одного изображения в /${ASSET_DIR}/. ` +
      `Питомец не отображается; положите ${SOURCE_FILE} или полный набор слоёв.`,
  );
  return { status: "empty", layers, missing };
}
