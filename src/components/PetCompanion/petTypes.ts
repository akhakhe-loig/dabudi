// Публичные типы компонента-питомца.

export type PetPose =
  | "idle"
  | "arms-up"
  | "arms-middle"
  | "arms-down"
  | "sleep";

export type PetAction =
  | "wave-left"
  | "wave-right"
  | "celebrate"
  | "blink"
  | "surprised";

export type PetSide = "left" | "right";

export type PetPosition = "bottom-left" | "bottom-right" | "inline";

/**
 * Полный набор параметров рига на один кадр. Углы — в градусах,
 * смещения — в долях размера компонента (0.02 = 2%), чтобы поза
 * одинаково выглядела и на 80px, и на 360px.
 */
export interface PetRigPose {
  bodyX: number;
  bodyY: number;
  bodyRotation: number;
  bodyScaleX: number;
  bodyScaleY: number;
  leftArmRotation: number;
  leftArmX: number;
  leftArmY: number;
  rightArmRotation: number;
  rightArmX: number;
  rightArmY: number;
  /** 0 — глаза открыты, 1 — полностью закрыты. */
  eyesClosed: number;
}

/** Слои рига. Порядок в массиве LAYER_ORDER задаёт порядок отрисовки. */
export type PetLayerName =
  | "shadow"
  | "arm-left"
  | "body"
  | "arm-right"
  | "eyes-closed";

export type PetAssetStatus = "loading" | "layered" | "fallback" | "empty";

export interface PetAssetState {
  status: PetAssetStatus;
  /** URL каждого успешно загруженного слоя. Отсутствие ключа = слой не загрузился. */
  layers: Partial<Record<PetLayerName, string>>;
  /** URL исходника, если он загрузился (используется в fallback-режиме). */
  sourceUrl?: string;
  missing: PetLayerName[];
}

export interface PetCompanionProps {
  /** Сторона квадрата компонента в пикселях, 80–360. По умолчанию 180. */
  size?: number;
  position?: PetPosition;
  initialPose?: PetPose;
  interactive?: boolean;
  followPointer?: boolean;
  draggable?: boolean;
  /** Зарезервировано под звук: сейчас питомец молчит при любом значении. */
  muted?: boolean;
  className?: string;
  onClick?: () => void;
  /** Подпись для скринридера. Учитывается только при interactive. */
  ariaLabel?: string;
}

export interface PetCompanionHandle {
  setPose(pose: PetPose): void;
  play(action: PetAction): Promise<void>;
  blink(): void;
  wave(side?: PetSide): Promise<void>;
  celebrate(): Promise<void>;
  sleep(): void;
  wake(): void;
  /** Текущая поза — удобно для тестов и отладочного демо. */
  getPose(): PetPose;
}

/** Состояния конечного автомата. */
export type PetMachineState =
  | "idle"
  | "arms-up"
  | "arms-middle"
  | "arms-down"
  | "waving-left"
  | "waving-right"
  | "celebrating"
  | "sleeping"
  | "transitioning";
