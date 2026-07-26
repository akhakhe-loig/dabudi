// Отладочное демо: кнопки на все действия и ползунки для калибровки рига
// под реальные PNG. Внизу — готовый JSON, который вставляется в petRigConfig.ts.

import { useMemo, useRef, useState } from "react";
import PetCompanion from "./PetCompanion";
import type { PetCompanionHandle, PetMachineState, PetPose } from "./petTypes";
import { SIZE, SOURCE } from "./petRigConfig";

const POSE_BUTTONS: Array<{ label: string; pose: PetPose }> = [
  { label: "Idle", pose: "idle" },
  { label: "Arms up", pose: "arms-up" },
  { label: "Arms middle", pose: "arms-middle" },
  { label: "Arms down", pose: "arms-down" },
];

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: SliderProps) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold">
      <span className="flex items-center justify-between opacity-70">
        <span>{label}</span>
        <span className="tabular-nums">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </label>
  );
}

export default function PetDemo() {
  const petRef = useRef<PetCompanionHandle>(null);
  const [state, setState] = useState<PetMachineState>("idle");
  const [busy, setBusy] = useState(false);

  const [size, setSize] = useState(SIZE.default);
  const [leftArmBase, setLeftArmBase] = useState(0);
  const [rightArmBase, setRightArmBase] = useState(0);
  const [leftShoulderX, setLeftShoulderX] = useState(SOURCE.leftShoulder.x);
  const [leftShoulderY, setLeftShoulderY] = useState(SOURCE.leftShoulder.y);
  const [rightShoulderX, setRightShoulderX] = useState(SOURCE.rightShoulder.x);
  const [rightShoulderY, setRightShoulderY] = useState(SOURCE.rightShoulder.y);

  // Точки плеч в процентах — именно в этом виде их ждёт transform-origin.
  const calibration = useMemo(
    () => ({
      leftArmRotation: leftArmBase,
      rightArmRotation: rightArmBase,
      leftOrigin: `${(leftShoulderX / SOURCE.width) * 100}% ${
        (leftShoulderY / SOURCE.height) * 100
      }%`,
      rightOrigin: `${(rightShoulderX / SOURCE.width) * 100}% ${
        (rightShoulderY / SOURCE.height) * 100
      }%`,
    }),
    [
      leftArmBase,
      rightArmBase,
      leftShoulderX,
      leftShoulderY,
      rightShoulderX,
      rightShoulderY,
    ],
  );

  const calibrationJson = useMemo(
    () =>
      JSON.stringify(
        {
          SOURCE: {
            width: SOURCE.width,
            height: SOURCE.height,
            bodyCenter: SOURCE.bodyCenter,
            leftShoulder: { x: leftShoulderX, y: leftShoulderY },
            rightShoulder: { x: rightShoulderX, y: rightShoulderY },
            leftEye: SOURCE.leftEye,
            rightEye: SOURCE.rightEye,
          },
          armBaseRotation: { left: leftArmBase, right: rightArmBase },
        },
        null,
        2,
      ),
    [
      leftArmBase,
      rightArmBase,
      leftShoulderX,
      leftShoulderY,
      rightShoulderX,
      rightShoulderY,
    ],
  );

  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const btn =
    "px-3 py-2 rounded-lg text-xs font-bold border border-neutral-300 " +
    "hover:bg-neutral-100 active:scale-95 transition disabled:opacity-40 " +
    "dark:border-neutral-700 dark:hover:bg-neutral-800";

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-black tracking-tight">
          PetCompanion — отладка и калибровка
        </h1>
        <p className="text-xs opacity-70">
          Состояние автомата: <b className="tabular-nums">{state}</b>
        </p>
      </header>

      <div className="flex flex-wrap gap-8">
        <div
          className="shrink-0 rounded-2xl border border-dashed border-neutral-300 p-4 dark:border-neutral-700"
          style={{ width: size + 32 }}
        >
          <PetCompanion
            ref={petRef}
            size={size}
            position="inline"
            interactive
            followPointer
            onStateChange={setState}
            calibration={calibration}
            ariaLabel="Демонстрационный питомец"
          />
        </div>

        <div className="flex min-w-[240px] flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest opacity-60">
              Позы
            </h2>
            <div className="flex flex-wrap gap-2">
              {POSE_BUTTONS.map(({ label, pose }) => (
                <button
                  key={pose}
                  type="button"
                  className={btn}
                  onClick={() => petRef.current?.setPose(pose)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest opacity-60">
              Действия
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btn}
                onClick={() => petRef.current?.blink()}
              >
                Blink
              </button>
              <button
                type="button"
                className={btn}
                disabled={busy}
                onClick={() => run(() => petRef.current?.wave("left"))}
              >
                Wave left
              </button>
              <button
                type="button"
                className={btn}
                disabled={busy}
                onClick={() => run(() => petRef.current?.wave("right"))}
              >
                Wave right
              </button>
              <button
                type="button"
                className={btn}
                disabled={busy}
                onClick={() => run(() => petRef.current?.celebrate())}
              >
                Celebrate
              </button>
              <button
                type="button"
                className={btn}
                onClick={() => petRef.current?.sleep()}
              >
                Sleep
              </button>
              <button
                type="button"
                className={btn}
                onClick={() => petRef.current?.wake()}
              >
                Wake
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest opacity-60">
              Калибровка
            </h2>
            <p className="text-[11px] leading-snug opacity-60">
              Углы рук и точки плеч действуют только в слоёном режиме — когда в
              <code> public/pet/ </code> лежат отдельные PNG на тело и руки. На
              трёх кадрах поз работает только размер.
            </p>
            <Slider
              label="Размер"
              value={size}
              min={SIZE.min}
              max={SIZE.max}
              onChange={setSize}
              suffix=" px"
            />
            <Slider
              label="Левая рука, базовый угол"
              value={leftArmBase}
              min={-90}
              max={90}
              onChange={setLeftArmBase}
              suffix="°"
            />
            <Slider
              label="Правая рука, базовый угол"
              value={rightArmBase}
              min={-90}
              max={90}
              onChange={setRightArmBase}
              suffix="°"
            />
            <Slider
              label="Левое плечо X"
              value={leftShoulderX}
              min={0}
              max={SOURCE.width}
              onChange={setLeftShoulderX}
            />
            <Slider
              label="Левое плечо Y"
              value={leftShoulderY}
              min={0}
              max={SOURCE.height}
              onChange={setLeftShoulderY}
            />
            <Slider
              label="Правое плечо X"
              value={rightShoulderX}
              min={0}
              max={SOURCE.width}
              onChange={setRightShoulderX}
            />
            <Slider
              label="Правое плечо Y"
              value={rightShoulderY}
              min={0}
              max={SOURCE.height}
              onChange={setRightShoulderY}
            />
          </section>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-[10px] font-black uppercase tracking-widest opacity-60">
          Готовый JSON для petRigConfig.ts
        </h2>
        <pre className="overflow-x-auto rounded-xl border border-neutral-300 p-3 text-[11px] leading-relaxed dark:border-neutral-700">
          {calibrationJson}
        </pre>
      </section>
    </div>
  );
}
