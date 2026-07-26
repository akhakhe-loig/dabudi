import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import styles from "./PetCompanion.module.css";
import { loadPetAssets } from "./petAssetLoader";
import { usePetAnimator } from "./usePetAnimator";
import type {
  PetAssetState,
  PetCompanionHandle,
  PetCompanionProps,
  PetMachineState,
  PetPose,
  PetSide,
} from "./petTypes";
import {
  ARM_ORIGINS,
  ASPECT_RATIO,
  BODY_ORIGIN,
  DRAG,
  SIZE,
  clamp,
  clampSize,
} from "./petRigConfig";

interface InternalProps extends PetCompanionProps {
  /** Не входит в обязательный API, но удобно для демо и отладки. */
  onStateChange?: (state: PetMachineState) => void;
  /**
   * Живая калибровка рига. Используется только отладочным демо для подгонки
   * углов и точек плеч под реальные PNG; в приложении не задаётся.
   */
  calibration?: {
    leftArmRotation?: number;
    rightArmRotation?: number;
    leftOrigin?: string;
    rightOrigin?: string;
  };
}

interface StoredPosition {
  x: number;
  y: number;
}

function readStoredPosition(): StoredPosition | null {
  try {
    const raw = window.localStorage.getItem(DRAG.storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.x === "number" &&
      typeof parsed.y === "number" &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y)
    ) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // Повреждённый или недоступный localStorage не должен ломать питомца.
  }
  return null;
}

function writeStoredPosition(pos: StoredPosition) {
  try {
    window.localStorage.setItem(DRAG.storageKey, JSON.stringify(pos));
  } catch {
    // Приватный режим или переполнение — просто не сохраняем.
  }
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
}

function useIsCoarsePointer() {
  const [coarse, setCoarse] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(pointer: coarse)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return coarse;
}

const PetCompanion = forwardRef<PetCompanionHandle, InternalProps>(
  function PetCompanion(
    {
      size = SIZE.default,
      position = "bottom-right",
      initialPose,
      interactive = false,
      followPointer = false,
      draggable = false,
      muted: _muted = true,
      className,
      onClick,
      ariaLabel,
      onStateChange,
      calibration,
    },
    ref,
  ) {
    const resolvedSize = clampSize(size);
    const resolvedInitialPose: PetPose = initialPose ?? "idle";
    const reducedMotion = usePrefersReducedMotion();
    const coarsePointer = useIsCoarsePointer();

    const [assets, setAssets] = useState<PetAssetState>({
      status: "loading",
      layers: {},
      missing: [],
    });

    const rootRef = useRef<HTMLElement | null>(null);
    const figureRef = useRef<HTMLDivElement | null>(null);
    const bodyRef = useRef<HTMLImageElement | null>(null);
    const armLeftRef = useRef<HTMLImageElement | null>(null);
    const armRightRef = useRef<HTMLImageElement | null>(null);
    const eyesRef = useRef<HTMLImageElement | null>(null);
    const shadowRef = useRef<HTMLImageElement | null>(null);

    const animator = usePetAnimator({
      size: resolvedSize,
      reducedMotion,
      followPointer,
      initialPose: resolvedInitialPose,
      onStateChange,
    });

    // --- загрузка ассетов -------------------------------------------------
    useEffect(() => {
      const controller = new AbortController();
      let cancelled = false;
      loadPetAssets(controller.signal).then((next) => {
        if (cancelled || controller.signal.aborted) return;
        setAssets(next);
      });
      return () => {
        cancelled = true;
        controller.abort();
      };
    }, []);

    // --- привязка слоёв к контроллеру ------------------------------------
    useEffect(() => {
      animator.attach({
        figure: figureRef.current,
        body: bodyRef.current,
        armLeft: armLeftRef.current,
        armRight: armRightRef.current,
        eyes: eyesRef.current,
        shadow: shadowRef.current,
      });
    }, [animator, assets.status]);

    // --- живая калибровка из демо ----------------------------------------
    useEffect(() => {
      if (!calibration) return;
      animator.setCalibration(calibration);
    }, [
      animator,
      calibration,
      assets.status,
      calibration?.leftArmRotation,
      calibration?.rightArmRotation,
      calibration?.leftOrigin,
      calibration?.rightOrigin,
    ]);

    // --- слежение за курсором --------------------------------------------
    useEffect(() => {
      if (!followPointer || reducedMotion || coarsePointer) return;
      const onMove = (event: PointerEvent) => {
        if (dragStateRef.current.dragging) return;
        animator.setPointer(event.clientX, event.clientY);
      };
      const onLeave = () => animator.clearPointer();
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerleave", onLeave);
      return () => {
        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerleave", onLeave);
        animator.clearPointer();
      };
    }, [animator, followPointer, reducedMotion, coarsePointer]);

    // --- перетаскивание ---------------------------------------------------
    const dragStateRef = useRef({
      dragging: false,
      moved: false,
      pointerId: -1,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0,
    });
    const offsetRef = useRef<StoredPosition>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    const applyOffset = useCallback(() => {
      const root = rootRef.current;
      if (!root) return;
      const { x, y } = offsetRef.current;
      root.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }, []);

    useEffect(() => {
      if (!draggable || position === "inline") return;
      const stored = readStoredPosition();
      if (stored) {
        offsetRef.current = stored;
        applyOffset();
      }
    }, [draggable, position, applyOffset]);

    const clampOffset = useCallback((next: StoredPosition): StoredPosition => {
      const root = rootRef.current;
      if (!root || typeof root.getBoundingClientRect !== "function") return next;
      const rect = root.getBoundingClientRect();
      // Прямоугольник без текущего смещения — от него считаем границы.
      const baseLeft = rect.left - offsetRef.current.x;
      const baseTop = rect.top - offsetRef.current.y;
      const minX = DRAG.marginPx - baseLeft;
      const maxX = window.innerWidth - rect.width - DRAG.marginPx - baseLeft;
      const minY = DRAG.marginPx - baseTop;
      const maxY = window.innerHeight - rect.height - DRAG.marginPx - baseTop;
      return {
        x: clamp(next.x, Math.min(minX, maxX), Math.max(minX, maxX)),
        y: clamp(next.y, Math.min(minY, maxY), Math.max(minY, maxY)),
      };
    }, []);

    const onPointerDown = useCallback(
      (event: ReactPointerEvent<HTMLElement>) => {
        if (!draggable || position === "inline") return;
        const state = dragStateRef.current;
        state.dragging = true;
        state.moved = false;
        state.pointerId = event.pointerId;
        state.startX = event.clientX;
        state.startY = event.clientY;
        state.originX = offsetRef.current.x;
        state.originY = offsetRef.current.y;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        animator.clearPointer();
      },
      [animator, draggable, position],
    );

    const onPointerMove = useCallback(
      (event: ReactPointerEvent<HTMLElement>) => {
        const state = dragStateRef.current;
        if (!state.dragging || state.pointerId !== event.pointerId) return;
        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        if (!state.moved && Math.hypot(dx, dy) > DRAG.thresholdPx) {
          state.moved = true;
          setIsDragging(true);
        }
        if (!state.moved) return;
        offsetRef.current = clampOffset({
          x: state.originX + dx,
          y: state.originY + dy,
        });
        applyOffset();
      },
      [applyOffset, clampOffset],
    );

    const endDrag = useCallback(
      (event: ReactPointerEvent<HTMLElement>) => {
        const state = dragStateRef.current;
        if (!state.dragging || state.pointerId !== event.pointerId) return;
        state.dragging = false;
        state.pointerId = -1;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        if (state.moved) {
          writeStoredPosition(offsetRef.current);
          setIsDragging(false);
        }
      },
      [],
    );

    // --- клик -------------------------------------------------------------
    const handleClick = useCallback(() => {
      // После перетаскивания клик не засчитываем.
      if (dragStateRef.current.moved) {
        dragStateRef.current.moved = false;
        return;
      }
      void animator.pressReaction();
      onClick?.();
    }, [animator, onClick]);

    // --- императивный API -------------------------------------------------
    useImperativeHandle(
      ref,
      (): PetCompanionHandle => ({
        setPose: (pose: PetPose) => animator.setPose(pose),
        play: (action) => animator.play(action),
        blink: () => animator.blink(),
        wave: (side: PetSide = "right") => animator.wave(side),
        celebrate: () => animator.celebrate(),
        sleep: () => animator.sleep(),
        wake: () => animator.wake(),
        getPose: () => animator.getPose(),
      }),
      [animator],
    );

    // --- разметка ---------------------------------------------------------
    const style = useMemo<CSSProperties>(
      () =>
        ({
          "--pet-size": `${resolvedSize}px`,
          "--pet-aspect": ASPECT_RATIO,
          "--pet-body-origin": BODY_ORIGIN,
          "--pet-left-origin": ARM_ORIGINS["arm-left"],
          "--pet-right-origin": ARM_ORIGINS["arm-right"],
        }) as CSSProperties,
      [resolvedSize],
    );

    const rootClass = [
      styles.root,
      position === "inline" ? styles.inline : styles.fixed,
      position === "bottom-right" ? styles.bottomRight : "",
      position === "bottom-left" ? styles.bottomLeft : "",
      interactive ? styles.interactive : "",
      isDragging ? styles.dragging : "",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    const layered = assets.status === "layered";
    const fallback = assets.status === "fallback";

    const stage = (
      <span className={styles.stage} data-testid="pet-stage">
        {layered && (
          <>
            <img
              ref={shadowRef}
              className={`${styles.layer} ${styles.shadow}`}
              src={assets.layers.shadow}
              alt=""
              width={287}
              height={290}
              draggable={false}
              data-testid="pet-layer-shadow"
            />
            <span ref={figureRef} className={styles.figure}>
              <img
                ref={armLeftRef}
                className={`${styles.layer} ${styles.arm} ${styles.armLeft}`}
                src={assets.layers["arm-left"]}
                alt=""
                width={287}
                height={290}
                draggable={false}
                data-testid="pet-layer-arm-left"
              />
              <img
                ref={bodyRef}
                className={`${styles.layer} ${styles.body}`}
                src={assets.layers.body}
                alt=""
                width={287}
                height={290}
                draggable={false}
                data-testid="pet-layer-body"
              />
              <img
                ref={armRightRef}
                className={`${styles.layer} ${styles.arm} ${styles.armRight}`}
                src={assets.layers["arm-right"]}
                alt=""
                width={287}
                height={290}
                draggable={false}
                data-testid="pet-layer-arm-right"
              />
              <img
                ref={eyesRef}
                className={`${styles.layer} ${styles.eyes}`}
                src={assets.layers["eyes-closed"]}
                alt=""
                width={287}
                height={290}
                draggable={false}
                data-testid="pet-layer-eyes"
              />
            </span>
          </>
        )}

        {fallback && (
          // Цельная картинка: дышит и покачивается, но руками не машет —
          // иначе поверх изображения появились бы вторые руки.
          <span ref={figureRef} className={styles.figure}>
            <img
              className={`${styles.layer} ${styles.fallback}`}
              src={assets.sourceUrl}
              alt=""
              width={287}
              height={290}
              draggable={false}
              data-testid="pet-layer-fallback"
            />
          </span>
        )}
      </span>
    );

    if (interactive) {
      return (
        <button
          type="button"
          ref={(node) => {
            rootRef.current = node;
          }}
          className={rootClass}
          style={style}
          onClick={handleClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-label={ariaLabel ?? "Питомец-помощник"}
          data-testid="pet-companion"
          data-status={assets.status}
        >
          {stage}
        </button>
      );
    }

    return (
      <div
        ref={(node) => {
          rootRef.current = node;
        }}
        className={rootClass}
        style={style}
        aria-hidden="true"
        data-testid="pet-companion"
        data-status={assets.status}
      >
        {stage}
      </div>
    );
  },
);

export default PetCompanion;
