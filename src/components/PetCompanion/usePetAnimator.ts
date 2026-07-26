// Единый контроллер анимации питомца.
//
// Один requestAnimationFrame на компонент. Итоговый кадр — сумма четырёх слоёв:
//
//   pose      базовая поза, к которой едем с мягким overshoot
// + idle      непрерывное «дыхание» с плавающими параметрами циклов
// + action    временное действие (wave/celebrate/...), аддитивное смещение
// + pointer   микрореакция на курсор
//
// Действия аддитивны и никогда не меняют базовую позу — поэтому питомец сам
// возвращается туда, где был до действия, даже если позу сменили посреди него.
//
// React-состояние здесь не обновляется покадрово: значения живут в ref-ах,
// трансформы пишутся прямо в DOM.

import { useEffect, useMemo, useRef } from "react";
import type {
  PetAction,
  PetMachineState,
  PetPose,
  PetRigPose,
  PetSide,
} from "./petTypes";
import {
  BLINK,
  CELEBRATE,
  CLICK_REACTION,
  IDLE,
  NEUTRAL_RIG,
  POINTER,
  POSES,
  POSE_TRANSITION,
  REDUCED_MOTION_POSE_MS,
  SHADOW,
  WAVE,
  clamp,
  easeInOutSine,
  easeOutBack,
  easeOutCubic,
  lerp,
  randomBetween,
} from "./petRigConfig";

export interface PetElements {
  figure: HTMLElement | null;
  body: HTMLElement | null;
  armLeft: HTMLElement | null;
  armRight: HTMLElement | null;
  eyes: HTMLElement | null;
  shadow: HTMLElement | null;
}

export interface AnimatorOptions {
  size: number;
  reducedMotion: boolean;
  followPointer: boolean;
  initialPose: PetPose;
  onStateChange?: (state: PetMachineState) => void;
}

type Timeline = (t: number, base: PetRigPose) => Partial<PetRigPose>;

interface RunningAction {
  name: PetAction | "click";
  timeline: Timeline;
  duration: number;
  startedAt: number;
  resolve: () => void;
}

/** Осциллятор с параметрами, которые меняются на каждом обороте. */
class Oscillator {
  phase = Math.random();
  duration: number;
  amplitude: number;

  constructor(
    private durationRange: { min: number; max: number },
    private amplitudeRange: { min: number; max: number },
    private skew = 1,
  ) {
    this.duration = randomBetween(durationRange) * skew;
    this.amplitude = randomBetween(amplitudeRange);
  }

  advance(deltaMs: number) {
    this.phase += deltaMs / this.duration;
    while (this.phase >= 1) {
      this.phase -= 1;
      // Параметры меняем только на обороте — там амплитудная функция равна
      // нулю, поэтому смена проходит без скачка.
      this.duration = randomBetween(this.durationRange) * this.skew;
      this.amplitude = randomBetween(this.amplitudeRange);
    }
  }

  /** 0 → 1 → 0 с нулевой производной на концах. */
  bell(offset = 0) {
    const p = (this.phase + offset) % 1;
    return (1 - Math.cos(2 * Math.PI * p)) / 2;
  }

  /** -1 → 1 → -1, ноль на концах оборота. */
  wave(offset = 0) {
    const p = (this.phase + offset) % 1;
    return Math.sin(2 * Math.PI * p);
  }
}

const ZERO_DELTA: PetRigPose = {
  bodyX: 0,
  bodyY: 0,
  bodyRotation: 0,
  bodyScaleX: 0,
  bodyScaleY: 0,
  leftArmRotation: 0,
  leftArmX: 0,
  leftArmY: 0,
  rightArmRotation: 0,
  rightArmX: 0,
  rightArmY: 0,
  eyesClosed: 0,
};

function interpolatePose(from: PetRigPose, to: PetRigPose, t: number): PetRigPose {
  return {
    bodyX: lerp(from.bodyX, to.bodyX, t),
    bodyY: lerp(from.bodyY, to.bodyY, t),
    bodyRotation: lerp(from.bodyRotation, to.bodyRotation, t),
    bodyScaleX: lerp(from.bodyScaleX, to.bodyScaleX, t),
    bodyScaleY: lerp(from.bodyScaleY, to.bodyScaleY, t),
    leftArmRotation: lerp(from.leftArmRotation, to.leftArmRotation, t),
    leftArmX: lerp(from.leftArmX, to.leftArmX, t),
    leftArmY: lerp(from.leftArmY, to.leftArmY, t),
    rightArmRotation: lerp(from.rightArmRotation, to.rightArmRotation, t),
    rightArmX: lerp(from.rightArmX, to.rightArmX, t),
    rightArmY: lerp(from.rightArmY, to.rightArmY, t),
    eyesClosed: lerp(from.eyesClosed, to.eyesClosed, t),
  };
}

/**
 * Контроллер живёт вне React: его создаёт хук и отдаёт наружу как объект
 * с императивными методами.
 */
export class PetAnimator {
  private elements: PetElements = {
    figure: null,
    body: null,
    armLeft: null,
    armRight: null,
    eyes: null,
    shadow: null,
  };

  private options: AnimatorOptions;

  private poseName: PetPose;
  private poseFrom: PetRigPose;
  private poseTo: PetRigPose;
  private poseStartedAt = 0;
  private poseDuration = 0;
  private poseCurrent: PetRigPose;

  private bodyOsc = new Oscillator(IDLE.bodyCycle, IDLE.bodyLift);
  private rotOsc = new Oscillator(IDLE.bodyCycle, IDLE.bodyRotation, 1.13);
  private armLeftOsc = new Oscillator(
    IDLE.bodyCycle,
    IDLE.armRotation,
    IDLE.armCycleSkewLeft,
  );
  private armRightOsc = new Oscillator(
    IDLE.bodyCycle,
    IDLE.armRotation,
    IDLE.armCycleSkewRight,
  );

  private action: RunningAction | null = null;
  private blinkValue = 0;
  private blinkQueue: number[] = [];
  private blinkStartedAt = 0;
  private blinkTimer: ReturnType<typeof setTimeout> | null = null;
  private blinkCount = 0;

  private pointerTarget = { x: 0, y: 0 };
  private pointerCurrent = { x: 0, y: 0 };
  private pointerActive = false;

  /**
   * Калибровочный слой: в продакшене всегда нулевой, им пользуется только
   * PetDemo, чтобы вживую подобрать углы и точки плеч под реальные PNG.
   */
  private calibration = {
    leftArmRotation: 0,
    rightArmRotation: 0,
    leftOrigin: "",
    rightOrigin: "",
  };

  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  private rafId: number | null = null;
  private lastFrameAt = 0;
  private sleeping = false;
  private disposed = false;
  private lastClickActionAt = 0;
  private state: PetMachineState = "idle";

  constructor(options: AnimatorOptions) {
    this.options = options;
    this.poseName = options.initialPose;
    const initial = POSES[options.initialPose];
    this.poseFrom = { ...initial };
    this.poseTo = { ...initial };
    this.poseCurrent = { ...initial };
    this.sleeping = options.initialPose === "sleep";
    this.state = this.sleeping ? "sleeping" : this.stateForPose(this.poseName);
  }

  // ---------------------------------------------------------------- жизненный цикл

  attach(elements: PetElements) {
    this.elements = elements;
    this.applyFrame(this.poseCurrent);
  }

  updateOptions(next: Partial<AnimatorOptions>) {
    this.options = { ...this.options, ...next };
    if (!this.options.followPointer) {
      this.pointerTarget = { x: 0, y: 0 };
    }
  }

  /**
   * Запуск кадров. Снимает флаг disposed: в StrictMode React монтирует
   * эффекты дважды (mount → cleanup → mount), и контроллер обязан ожить
   * на втором монтировании, иначе питомец останется мёртвым в dev-режиме.
   */
  start() {
    if (this.rafId !== null) return;
    this.disposed = false;
    this.lastFrameAt = 0;
    this.rafId = requestAnimationFrame(this.frame);
    this.scheduleBlink();
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clearBlinkTimer();
  }

  /**
   * Полная остановка на размонтировании. Контроллер остаётся пригодным к
   * повторному start(), но до него не трогает DOM и не держит таймеров.
   */
  dispose() {
    this.disposed = true;
    this.stop();
    // Незавершённые промисы обязательно резолвим, иначе await повиснет навсегда.
    if (this.action) {
      this.action.resolve();
      this.action = null;
    }
  }

  get isDisposed() {
    return this.disposed;
  }

  // ---------------------------------------------------------------- позы

  private stateForPose(pose: PetPose): PetMachineState {
    if (pose === "sleep") return "sleeping";
    if (pose === "idle") return "idle";
    return pose;
  }

  private setState(state: PetMachineState) {
    if (this.state === state) return;
    this.state = state;
    this.options.onStateChange?.(state);
  }

  getState() {
    return this.state;
  }

  getPose(): PetPose {
    return this.poseName;
  }

  setPose(pose: PetPose) {
    if (this.disposed) return;
    this.poseName = pose;
    this.poseFrom = { ...this.poseCurrent };
    this.poseTo = { ...POSES[pose] };
    this.poseStartedAt = this.now();
    this.poseDuration = this.options.reducedMotion
      ? REDUCED_MOTION_POSE_MS
      : randomBetween(POSE_TRANSITION);
    this.sleeping = pose === "sleep";
    if (this.sleeping) {
      this.pointerTarget = { x: 0, y: 0 };
      this.clearBlinkTimer();
    } else {
      this.scheduleBlink();
    }
    this.setState("transitioning");
    // Если кадры не идут (тесты, скрытая вкладка) — сразу показываем результат.
    if (this.rafId === null) this.renderOnce();
  }

  sleep() {
    this.setPose("sleep");
  }

  wake() {
    if (this.poseName === "sleep") this.setPose("idle");
  }

  isSleeping() {
    return this.sleeping;
  }

  // ---------------------------------------------------------------- действия

  play(action: PetAction): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (action === "blink") {
      this.blink();
      return this.wait(
        BLINK.closeMs.max + BLINK.holdMs.max + BLINK.openMs.max,
      );
    }
    if (this.sleeping) return Promise.resolve();
    return this.runAction(action, this.buildTimeline(action));
  }

  wave(side: PetSide = "right") {
    return this.play(side === "left" ? "wave-left" : "wave-right");
  }

  celebrate() {
    return this.play("celebrate");
  }

  /** Реакция на клик: приседание и подъём, изредка — случайное действие. */
  pressReaction(): Promise<void> {
    if (this.disposed || this.sleeping) return Promise.resolve();
    if (this.options.reducedMotion) return Promise.resolve();

    const now = this.now();
    const canRunExtra = now - this.lastClickActionAt > CLICK_REACTION.actionCooldownMs;
    if (canRunExtra) {
      this.lastClickActionAt = now;
      const extra: PetAction =
        Math.random() < CLICK_REACTION.celebrateChance
          ? "celebrate"
          : Math.random() < 0.5
            ? "wave-left"
            : "wave-right";
      return this.play(extra);
    }
    return this.runAction("click", this.clickTimeline());
  }

  private runAction(
    name: PetAction | "click",
    timeline: Timeline,
    durationOverride?: number,
  ): Promise<void> {
    // Повторный запуск того же действия не должен оставлять питомца в
    // промежуточном состоянии: гасим предыдущее и начинаем заново с нуля.
    if (this.action) {
      this.action.resolve();
      this.action = null;
    }
    const duration = durationOverride ?? this.durationFor(name);
    return new Promise<void>((resolve) => {
      this.action = {
        name,
        timeline,
        duration,
        startedAt: this.now(),
        resolve,
      };
      this.setState(this.stateForAction(name));
      if (this.rafId === null) {
        // Без работающего rAF действие всё равно должно завершиться.
        const timer = setTimeout(() => {
          if (this.action && this.action.resolve === resolve) {
            this.action.resolve();
            this.action = null;
            this.setState(this.stateForPose(this.poseName));
            this.renderOnce();
          }
        }, duration);
        // Таймер снимается вместе с контроллером.
        this.pendingTimers.add(timer);
      }
    });
  }

  private stateForAction(name: PetAction | "click"): PetMachineState {
    switch (name) {
      case "wave-left":
        return "waving-left";
      case "wave-right":
        return "waving-right";
      case "celebrate":
        return "celebrating";
      default:
        return "transitioning";
    }
  }

  private durationFor(name: PetAction | "click") {
    switch (name) {
      case "wave-left":
      case "wave-right":
        return randomBetween(WAVE.duration);
      case "celebrate":
        return CELEBRATE.duration;
      case "surprised":
        return 620;
      default:
        return CLICK_REACTION.duration;
    }
  }

  private buildTimeline(action: PetAction): Timeline {
    switch (action) {
      case "wave-left":
        return this.waveTimeline("left");
      case "wave-right":
        return this.waveTimeline("right");
      case "celebrate":
        return this.celebrateTimeline();
      case "surprised":
        return this.surprisedTimeline();
      default:
        return () => ({});
    }
  }

  /**
   * Мах рукой. Если рука опущена — сначала поднимаем её (аддитивно гасим
   * угол текущей позы), затем 3–4 затухающих маха, затем возврат.
   */
  private waveTimeline(side: PetSide): Timeline {
    const swings = Math.round(randomBetween(WAVE.swings));
    const amplitude = randomBetween(WAVE.amplitude);
    const duration = randomBetween(WAVE.duration);
    const liftPortion = clamp(WAVE.liftMs / duration, 0.08, 0.3);

    return (t, base) => {
      const baseRotation =
        side === "left" ? base.leftArmRotation : base.rightArmRotation;
      // Поднимаем руку только если она заметно опущена.
      const needsLift = Math.abs(baseRotation) > WAVE.liftThreshold;
      const liftOffset = needsLift ? -baseRotation : 0;

      const liftEnv =
        t < liftPortion
          ? easeOutCubic(t / liftPortion)
          : t > 1 - liftPortion
            ? easeOutCubic((1 - t) / liftPortion)
            : 1;

      const swingT = clamp((t - liftPortion) / (1 - 2 * liftPortion), 0, 1);
      const decay = Math.pow(WAVE.decay, swingT * swings);
      const swing =
        Math.sin(swingT * swings * 2 * Math.PI) * amplitude * decay * liftEnv;

      const delta: Partial<PetRigPose> = {};
      if (side === "left") {
        delta.leftArmRotation = liftOffset * liftEnv + swing;
        delta.rightArmRotation = -swing * WAVE.sympathyArm;
      } else {
        delta.rightArmRotation = liftOffset * liftEnv - swing;
        delta.leftArmRotation = swing * WAVE.sympathyArm;
      }
      delta.bodyRotation = swing * WAVE.sympathyBody;
      return delta;
    };
  }

  private celebrateTimeline(): Timeline {
    return (t) => {
      // 0–0.22 руки вверх и подъём, 0.22–0.82 два подскока, дальше возврат.
      const raiseEnv =
        t < 0.22
          ? easeOutCubic(t / 0.22)
          : t > 0.82
            ? easeOutCubic((1 - t) / 0.18)
            : 1;

      const hopT = clamp((t - 0.22) / 0.6, 0, 1);
      const hop =
        hopT > 0 && hopT < 1
          ? Math.abs(Math.sin(hopT * CELEBRATE.hops * Math.PI)) *
            (1 - hopT * 0.35)
          : 0;

      const lift = (CELEBRATE.lift * 0.45 + CELEBRATE.lift * 0.55 * hop) * raiseEnv;
      const scale = (CELEBRATE.scale - 1) * raiseEnv;

      // Двойное моргание ближе к концу — короткий «ой, здорово».
      const blinkA = t > 0.62 && t < 0.68 ? 1 : 0;
      const blinkB = t > 0.72 && t < 0.78 ? 1 : 0;

      return {
        bodyY: -lift,
        bodyScaleX: scale * 0.6,
        bodyScaleY: scale,
        leftArmRotation: -CELEBRATE.armRaise * raiseEnv,
        rightArmRotation: CELEBRATE.armRaise * raiseEnv,
        leftArmY: -0.02 * raiseEnv,
        rightArmY: -0.02 * raiseEnv,
        eyesClosed: Math.max(blinkA, blinkB),
      };
    };
  }

  private surprisedTimeline(): Timeline {
    return (t) => {
      const env = t < 0.3 ? easeOutCubic(t / 0.3) : easeOutCubic((1 - t) / 0.7);
      return {
        bodyScaleX: 0.03 * env,
        bodyScaleY: 0.05 * env,
        bodyY: -0.02 * env,
        bodyRotation: -1.5 * env,
        leftArmRotation: -6 * env,
        rightArmRotation: 6 * env,
      };
    };
  }

  private clickTimeline(): Timeline {
    return (t) => {
      // Присесть → подпрыгнуть → вернуться.
      const squash = CLICK_REACTION.squash - 1;
      const stretch = CLICK_REACTION.stretch - 1;
      const phase =
        t < 0.35
          ? lerp(0, squash, easeOutCubic(t / 0.35))
          : t < 0.7
            ? lerp(squash, stretch, easeOutCubic((t - 0.35) / 0.35))
            : lerp(stretch, 0, easeOutCubic((t - 0.7) / 0.3));
      return {
        bodyScaleY: phase,
        bodyScaleX: -phase * 0.6,
        bodyY: phase < 0 ? 0 : -phase * 0.35,
      };
    };
  }

  // ---------------------------------------------------------------- моргание

  blink(double = Math.random() < BLINK.doubleChance) {
    if (this.disposed) return;
    const close = randomBetween(BLINK.closeMs);
    const hold = randomBetween(BLINK.holdMs);
    const open = randomBetween(BLINK.openMs);
    this.blinkQueue = [close, hold, open];
    if (double) {
      this.blinkQueue.push(randomBetween(BLINK.doubleGapMs), close, hold, open);
    }
    this.blinkStartedAt = this.now();
    if (this.rafId === null) this.renderOnce();
  }

  private scheduleBlink() {
    this.clearBlinkTimer();
    if (this.disposed || this.sleeping) return;
    const range = this.options.reducedMotion
      ? BLINK.reducedIntervalMs
      : BLINK.intervalMs;
    this.blinkTimer = setTimeout(() => {
      this.blinkTimer = null;
      if (this.disposed || this.sleeping) return;
      // Моргание не перебивает действие — просто ждём следующего окна.
      if (!this.action) {
        this.blinkCount += 1;
        this.blink(this.blinkCount % 5 === 0);
      }
      this.scheduleBlink();
    }, randomBetween(range));
  }

  private clearBlinkTimer() {
    if (this.blinkTimer !== null) {
      clearTimeout(this.blinkTimer);
      this.blinkTimer = null;
    }
  }

  /**
   * Значение канала моргания на текущий момент.
   * Очередь — это чередование фаз: закрытие, удержание, открытие
   * (и то же ещё раз через паузу, если моргание двойное).
   */
  private blinkAt(now: number) {
    if (this.blinkQueue.length === 0) return 0;

    // Форма каждой фазы по её порядковому номеру внутри тройки.
    const shape = (index: number, progress: number) => {
      const kind = index % 4;
      if (kind === 0) return easeInOutSine(progress); // закрытие
      if (kind === 1) return 1; // удержание
      if (kind === 2) return 1 - easeInOutSine(progress); // открытие
      return 0; // пауза между морганиями
    };

    let elapsed = now - this.blinkStartedAt;
    for (let i = 0; i < this.blinkQueue.length; i += 1) {
      const duration = this.blinkQueue[i];
      if (elapsed < duration) {
        return shape(i, duration === 0 ? 1 : elapsed / duration);
      }
      elapsed -= duration;
    }
    this.blinkQueue = [];
    return 0;
  }

  // ---------------------------------------------------------------- курсор

  setPointer(clientX: number, clientY: number) {
    if (!this.options.followPointer || this.sleeping || this.options.reducedMotion) {
      return;
    }
    const el = this.elements.figure;
    if (!el || typeof el.getBoundingClientRect !== "function") return;
    const rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    this.pointerTarget = {
      x: clamp((clientX - cx) / POINTER.falloffPx, -1, 1),
      y: clamp((clientY - cy) / POINTER.falloffPx, -1, 1),
    };
    this.pointerActive = true;
  }

  clearPointer() {
    this.pointerTarget = { x: 0, y: 0 };
    this.pointerActive = false;
  }

  /** Живая калибровка из демо. Origin применяем сразу, углы — на кадре. */
  setCalibration(next: Partial<PetAnimator["calibration"]>) {
    this.calibration = { ...this.calibration, ...next };
    const { armLeft, armRight } = this.elements;
    if (armLeft && this.calibration.leftOrigin) {
      armLeft.style.transformOrigin = this.calibration.leftOrigin;
    }
    if (armRight && this.calibration.rightOrigin) {
      armRight.style.transformOrigin = this.calibration.rightOrigin;
    }
    if (this.rafId === null) this.renderOnce();
  }

  isPointerActive() {
    return this.pointerActive;
  }

  // ---------------------------------------------------------------- кадр

  private now() {
    return typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  }

  private frame = () => {
    if (this.disposed) return;
    const now = this.now();
    const delta = this.lastFrameAt === 0 ? 16.7 : Math.min(now - this.lastFrameAt, 64);
    this.lastFrameAt = now;
    this.tick(now, delta);
    this.rafId = requestAnimationFrame(this.frame);
  };

  /** Один расчёт без запроса следующего кадра — для тестов и пауз. */
  renderOnce() {
    if (this.disposed) return;
    this.tick(this.now(), 16.7);
  }

  private tick(now: number, delta: number) {
    // 1. поза
    const poseT =
      this.poseDuration <= 0
        ? 1
        : clamp((now - this.poseStartedAt) / this.poseDuration, 0, 1);
    const eased = this.options.reducedMotion ? poseT : easeOutBack(poseT);
    this.poseCurrent = interpolatePose(this.poseFrom, this.poseTo, eased);
    if (poseT >= 1 && this.state === "transitioning" && !this.action) {
      this.setState(this.stateForPose(this.poseName));
    }

    // 2. idle
    const idle = this.idleDelta(delta);

    // 3. действие
    let action: Partial<PetRigPose> = {};
    if (this.action) {
      const t = clamp((now - this.action.startedAt) / this.action.duration, 0, 1);
      action = this.action.timeline(t, this.poseCurrent);
      if (t >= 1) {
        const finished = this.action;
        this.action = null;
        finished.resolve();
        this.setState(this.stateForPose(this.poseName));
        action = {};
      }
    }

    // 4. курсор
    const pointer = this.pointerDelta();

    const final: PetRigPose = {
      bodyX:
        this.poseCurrent.bodyX + idle.bodyX + (action.bodyX ?? 0) + pointer.bodyX,
      bodyY:
        this.poseCurrent.bodyY + idle.bodyY + (action.bodyY ?? 0) + pointer.bodyY,
      bodyRotation:
        this.poseCurrent.bodyRotation +
        idle.bodyRotation +
        (action.bodyRotation ?? 0) +
        pointer.bodyRotation,
      bodyScaleX:
        this.poseCurrent.bodyScaleX + idle.bodyScaleX + (action.bodyScaleX ?? 0),
      bodyScaleY:
        this.poseCurrent.bodyScaleY + idle.bodyScaleY + (action.bodyScaleY ?? 0),
      leftArmRotation:
        this.poseCurrent.leftArmRotation +
        idle.leftArmRotation +
        (action.leftArmRotation ?? 0) +
        pointer.leftArmRotation +
        this.calibration.leftArmRotation,
      leftArmX: this.poseCurrent.leftArmX + (action.leftArmX ?? 0),
      leftArmY: this.poseCurrent.leftArmY + (action.leftArmY ?? 0),
      rightArmRotation:
        this.poseCurrent.rightArmRotation +
        idle.rightArmRotation +
        (action.rightArmRotation ?? 0) +
        pointer.rightArmRotation +
        this.calibration.rightArmRotation,
      rightArmX: this.poseCurrent.rightArmX + (action.rightArmX ?? 0),
      rightArmY: this.poseCurrent.rightArmY + (action.rightArmY ?? 0),
      // Глаза не складываются, а берут максимум — иначе значение вылетит за 1.
      eyesClosed: clamp(
        Math.max(
          this.poseCurrent.eyesClosed,
          this.blinkAt(now),
          action.eyesClosed ?? 0,
        ),
        0,
        1,
      ),
    };

    this.applyFrame(final);
  }

  private idleDelta(delta: number): PetRigPose {
    if (this.options.reducedMotion) return ZERO_DELTA;
    this.bodyOsc.advance(delta);
    this.rotOsc.advance(delta);
    this.armLeftOsc.advance(delta);
    this.armRightOsc.advance(delta);

    const bell = this.bodyOsc.bell();
    const lift = bell * this.bodyOsc.amplitude;
    // Растяжение по вертикали привязано к тому же обороту, что и подъём:
    // чем глубже вдох, тем сильнее вытягивается силуэт.
    const liftNorm = clamp(
      (this.bodyOsc.amplitude - IDLE.bodyLift.min) /
        Math.max(IDLE.bodyLift.max - IDLE.bodyLift.min, 1e-6),
      0,
      1,
    );
    const scaleAmplitude =
      IDLE.scaleY.min - 1 + (IDLE.scaleY.max - IDLE.scaleY.min) * liftNorm;
    const scaleY = bell * scaleAmplitude;
    return {
      ...ZERO_DELTA,
      bodyY: -lift,
      bodyScaleY: scaleY,
      bodyScaleX: -scaleY * IDLE.scaleXCompensation,
      bodyRotation: this.rotOsc.wave() * this.rotOsc.amplitude,
      leftArmRotation:
        this.armLeftOsc.wave(-IDLE.armLagLeft) * this.armLeftOsc.amplitude,
      rightArmRotation:
        this.armRightOsc.wave(-IDLE.armLagRight) * this.armRightOsc.amplitude,
    };
  }

  private pointerDelta(): PetRigPose {
    if (!this.options.followPointer || this.sleeping || this.options.reducedMotion) {
      this.pointerCurrent = { x: 0, y: 0 };
      return ZERO_DELTA;
    }
    this.pointerCurrent = {
      x: lerp(this.pointerCurrent.x, this.pointerTarget.x, POINTER.lerp),
      y: lerp(this.pointerCurrent.y, this.pointerTarget.y, POINTER.lerp),
    };
    const px = this.pointerCurrent.x;
    const py = this.pointerCurrent.y;
    const sizeRatio = this.options.size / 180;
    return {
      ...ZERO_DELTA,
      bodyRotation: px * POINTER.bodyRotation,
      bodyX: (px * POINTER.translatePx * sizeRatio) / this.options.size,
      bodyY: (py * POINTER.translatePx * sizeRatio) / this.options.size,
      leftArmRotation: px * POINTER.armRotation,
      rightArmRotation: px * POINTER.armRotation,
    };
  }

  private applyFrame(rig: PetRigPose) {
    const { figure, armLeft, armRight, eyes, shadow } = this.elements;
    const size = this.options.size;

    if (figure) {
      figure.style.transform =
        `translate3d(${(rig.bodyX * size).toFixed(2)}px, ${(rig.bodyY * size).toFixed(2)}px, 0) ` +
        `rotate(${rig.bodyRotation.toFixed(3)}deg) ` +
        `scale(${rig.bodyScaleX.toFixed(4)}, ${rig.bodyScaleY.toFixed(4)})`;
    }
    if (armLeft) {
      armLeft.style.transform =
        `translate3d(${(rig.leftArmX * size).toFixed(2)}px, ${(rig.leftArmY * size).toFixed(2)}px, 0) ` +
        `rotate(${rig.leftArmRotation.toFixed(3)}deg)`;
    }
    if (armRight) {
      armRight.style.transform =
        `translate3d(${(rig.rightArmX * size).toFixed(2)}px, ${(rig.rightArmY * size).toFixed(2)}px, 0) ` +
        `rotate(${rig.rightArmRotation.toFixed(3)}deg)`;
    }
    if (eyes) {
      eyes.style.opacity = rig.eyesClosed.toFixed(3);
    }
    if (shadow) {
      const liftNorm = clamp(-rig.bodyY / IDLE.bodyLift.max, 0, 2.5);
      shadow.style.transform = `scale(${(1 - liftNorm * SHADOW.scalePerLift).toFixed(4)})`;
      shadow.style.opacity = (
        SHADOW.baseOpacity *
        clamp(1 - liftNorm * SHADOW.opacityPerLift, 0.15, 1)
      ).toFixed(3);
    }
  }

  private wait(ms: number) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingTimers.delete(timer);
        resolve();
      }, ms);
      this.pendingTimers.add(timer);
    });
  }

  clearTimers() {
    this.pendingTimers.forEach((timer) => clearTimeout(timer));
    this.pendingTimers.clear();
  }
}

/** Хук создаёт контроллер и следит за его жизненным циклом. */
export function usePetAnimator(options: AnimatorOptions) {
  const animator = useMemo(
    () => new PetAnimator(options),
    // Контроллер создаётся один раз: дальнейшие изменения приходят через
    // updateOptions, чтобы не пересоздавать анимацию на каждый ререндер.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    animator.updateOptions(options);
  }, [
    animator,
    options.size,
    options.reducedMotion,
    options.followPointer,
    options.onStateChange,
  ]);

  useEffect(() => {
    animator.start();
    const onVisibility = () => {
      if (document.hidden) {
        // Скрытая вкладка: гасим кадры и таймеры, чтобы после возврата
        // не проигрывать пачку накопившихся морганий разом.
        animator.stop();
      } else {
        animator.start();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      animator.clearTimers();
      animator.dispose();
    };
  }, [animator]);

  return animator;
}
