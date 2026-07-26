// Единственное место, где живут числа рига. Углы, плечи и тайминги
// настраиваются здесь — компоненты и хуки не должны содержать magic numbers.
//
// Быстрая калибровка под реальные PNG: открыть PetDemo, подвигать ползунки
// (углы рук и смещение плеч), скопировать готовый JSON и вставить в
// SOURCE, ARM_ORIGINS и POSES ниже.

import type { PetLayerName, PetPose, PetRigPose } from "./petTypes";

/** Система координат исходного изображения. */
export const SOURCE = {
  width: 287,
  height: 290,
  /** Центр тела — вокруг него считаются наклон и «дыхание». */
  bodyCenter: { x: 143, y: 161 },
  /** Плечо левой для зрителя руки. */
  leftShoulder: { x: 88, y: 121 },
  /** Плечо правой для зрителя руки. */
  rightShoulder: { x: 191, y: 121 },
  leftEye: { x: 109, y: 103 },
  rightEye: { x: 154, y: 104 },
} as const;

export const ASPECT_RATIO = `${SOURCE.width} / ${SOURCE.height}`;

/** Имена файлов слоёв внутри публичной папки. */
export const ASSET_DIR = "pet";
export const SOURCE_FILE = "source.png";
export const LAYER_FILES: Record<PetLayerName, string> = {
  shadow: "shadow.png",
  "arm-left": "arm-left.png",
  body: "body.png",
  "arm-right": "arm-right.png",
  "eyes-closed": "eyes-closed.png",
};

/** Порядок отрисовки снизу вверх. Левая рука за телом, правая — перед. */
export const LAYER_ORDER: PetLayerName[] = [
  "shadow",
  "arm-left",
  "body",
  "arm-right",
  "eyes-closed",
];

/**
 * Точка вращения каждой руки в процентах от габарита компонента —
 * пересчитана из координат плеча, поэтому масштабируется вместе с size.
 */
const asPercent = (value: number, total: number) => `${(value / total) * 100}%`;

export const ARM_ORIGINS: Record<"arm-left" | "arm-right", string> = {
  "arm-left": `${asPercent(SOURCE.leftShoulder.x, SOURCE.width)} ${asPercent(
    SOURCE.leftShoulder.y,
    SOURCE.height,
  )}`,
  "arm-right": `${asPercent(SOURCE.rightShoulder.x, SOURCE.width)} ${asPercent(
    SOURCE.rightShoulder.y,
    SOURCE.height,
  )}`,
};

export const BODY_ORIGIN = `${asPercent(
  SOURCE.bodyCenter.x,
  SOURCE.width,
)} ${asPercent(SOURCE.bodyCenter.y, SOURCE.height)}`;

/** Нулевая поза: всё в исходном положении. */
export const NEUTRAL_RIG: PetRigPose = {
  bodyX: 0,
  bodyY: 0,
  bodyRotation: 0,
  bodyScaleX: 1,
  bodyScaleY: 1,
  leftArmRotation: 0,
  leftArmX: 0,
  leftArmY: 0,
  rightArmRotation: 0,
  rightArmX: 0,
  rightArmY: 0,
  eyesClosed: 0,
};

/**
 * Углы поз.
 *
 * Знаки проверены визуально на слоях, где руки подняты вверх и разведены
 * (как на исходной фотографии). В CSS положительный угол вращает по часовой
 * стрелке, поэтому ОПУСКАЕТ руку вдоль тела: для левой — отрицательный угол,
 * для правой — положительный. Если ваши PNG экспортированы в другой позе или
 * зеркально, знаки меняются здесь, в одном месте; подобрать их удобно
 * ползунками в PetDemo.
 */
export const POSES: Record<PetPose, PetRigPose> = {
  idle: { ...NEUTRAL_RIG },
  "arms-up": { ...NEUTRAL_RIG },
  "arms-middle": {
    ...NEUTRAL_RIG,
    leftArmRotation: -30,
    rightArmRotation: 30,
  },
  "arms-down": {
    ...NEUTRAL_RIG,
    leftArmRotation: -68,
    rightArmRotation: 68,
    leftArmY: 0.03,
    rightArmY: 0.03,
  },
  sleep: {
    ...NEUTRAL_RIG,
    leftArmRotation: -72,
    rightArmRotation: 72,
    leftArmY: 0.035,
    rightArmY: 0.035,
    bodyRotation: -3,
    bodyY: 0.012,
    eyesClosed: 1,
  },
};

/**
 * Переход между позами: мягкий overshoot примерно на 2–3 градуса.
 * Ключи min/max — того же вида, что у остальных диапазонов, их читает
 * randomBetween.
 */
export const POSE_TRANSITION = {
  min: 450,
  max: 700,
  /** Параметр easeOutBack; 1.1 даёт перелёт ~4.5% от величины хода. */
  overshoot: 1.1,
} as const;

/** Непрерывное «дыхание». Значения — границы, из которых берётся каждый цикл. */
export const IDLE = {
  bodyCycle: { min: 3000, max: 4500 },
  /** Подъём тела в долях размера компонента. */
  bodyLift: { min: 0.012, max: 0.02 },
  scaleY: { min: 1.012, max: 1.018 },
  /** Компенсация ширины, чтобы объём выглядел постоянным. */
  scaleXCompensation: 0.55,
  bodyRotation: { min: 0.6, max: 1.1 },
  /** Отставание рук от тела в долях цикла. */
  armLagLeft: 0.16,
  armLagRight: 0.24,
  armRotation: { min: 1, max: 2 },
  /** Правая рука живёт на своём периоде, чтобы движение не было зеркальным. */
  armCycleSkewLeft: 1.0,
  armCycleSkewRight: 1.27,
} as const;

export const BLINK = {
  closeMs: { min: 80, max: 100 },
  holdMs: { min: 55, max: 90 },
  openMs: { min: 100, max: 140 },
  intervalMs: { min: 2500, max: 6000 },
  /** Примерно каждое пятое моргание — двойное. */
  doubleChance: 0.2,
  doubleGapMs: { min: 100, max: 180 },
  /** В режиме reduced-motion моргаем реже и мягче. */
  reducedIntervalMs: { min: 6000, max: 11000 },
} as const;

export const WAVE = {
  swings: { min: 3, max: 4 },
  amplitude: { min: 10, max: 16 },
  /** Каждый следующий мах слабее предыдущего. */
  decay: 0.78,
  duration: { min: 900, max: 1400 },
  /** Если рука ниже этого угла — сначала поднимаем её к средней позе. */
  liftThreshold: 20,
  liftMs: 260,
  /** Насколько вторая рука и корпус подхватывают движение. */
  sympathyArm: 0.16,
  sympathyBody: 0.12,
} as const;

export const CELEBRATE = {
  duration: 1300,
  lift: 0.05,
  scale: 1.04,
  hops: 2,
  armRaise: 14,
} as const;

export const CLICK_REACTION = {
  duration: 420,
  squash: 0.97,
  stretch: 1.04,
  /** Не чаще одного случайного действия за этот интервал. */
  actionCooldownMs: 1200,
  celebrateChance: 0.3,
} as const;

export const POINTER = {
  bodyRotation: 2,
  /** Максимальный сдвиг в пикселях при size = 180. */
  translatePx: 3,
  armRotation: 1,
  /** Коэффициент сглаживания за кадр (при 60fps). */
  lerp: 0.09,
  /** Радиус, на котором реакция достигает максимума. */
  falloffPx: 420,
} as const;

export const DRAG = {
  thresholdPx: 6,
  storageKey: "pet-companion:position:v1",
  marginPx: 8,
} as const;

export const SHADOW = {
  /** Насколько тень сжимается на единицу подъёма (подъём нормируется по IDLE.bodyLift.max). */
  scalePerLift: 0.12,
  /** Насколько бледнеет на ту же единицу подъёма. */
  opacityPerLift: 0.3,
  baseOpacity: 0.85,
} as const;

export const SIZE = {
  min: 80,
  max: 360,
  default: 180,
} as const;

export const REDUCED_MOTION_POSE_MS = 90;

/** easeOutBack с настраиваемым перелётом. */
export function easeOutBack(t: number, overshoot = POSE_TRANSITION.overshoot) {
  const c3 = overshoot + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + overshoot * u * u;
}

export function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const lerp = (from: number, to: number, t: number) =>
  from + (to - from) * t;

export const randomBetween = (range: { min: number; max: number }) =>
  range.min + Math.random() * (range.max - range.min);

export const clampSize = (size: number) =>
  clamp(Math.round(size), SIZE.min, SIZE.max);
