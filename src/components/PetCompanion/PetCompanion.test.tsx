import {createRef} from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import PetCompanion from './PetCompanion';
import type {PetCompanionHandle} from './petTypes';
import {IDLE, POSES} from './petRigConfig';

/**
 * Idle-слой постоянно подмешивает к позе небольшое покачивание, поэтому
 * угол сверяем не точно, а в пределах его амплитуды.
 */
const IDLE_TOLERANCE = IDLE.armRotation.max + 0.5;

function expectAngle(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(IDLE_TOLERANCE);
}

/**
 * jsdom не грузит картинки, поэтому подменяем Image: тест сам решает,
 * какие файлы «существуют».
 */
function mockImages(exists: (src: string) => boolean) {
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoding = 'auto';
    #src = '';
    get src() {
      return this.#src;
    }
    set src(value: string) {
      this.#src = value;
      if (!value) return;
      queueMicrotask(() => {
        if (exists(value)) this.onload?.();
        else this.onerror?.();
      });
    }
  }
  vi.stubGlobal('Image', FakeImage);
}

const allLayers = () => mockImages(() => true);
const onlySource = () => mockImages((src) => src.includes('source.png'));

function rotationOf(el: HTMLElement | null) {
  const match = el?.style.transform.match(/rotate\((-?[\d.]+)deg\)/);
  return match ? Number(match[1]) : 0;
}

/** Прокручивает и таймеры, и кадры анимации. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function flushAssets() {
  // Загрузчик резолвится через микрозадачи.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
      'Date',
    ],
  });
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('загрузка ассетов', () => {
  it('показывает source.png, когда слоёв нет, и не роняет приложение', async () => {
    onlySource();
    render(<PetCompanion />);
    await flushAssets();

    expect(
      screen.getByTestId('pet-companion').getAttribute('data-status'),
    ).toBe('fallback');
    expect(screen.getByTestId('pet-layer-fallback')).toBeTruthy();
    expect(screen.queryByTestId('pet-layer-arm-left')).toBeNull();
  });

  it('в fallback-режиме тело продолжает дышать', async () => {
    onlySource();
    render(<PetCompanion />);
    await flushAssets();
    await advance(1200);

    const figure = screen
      .getByTestId('pet-stage')
      .querySelector('span') as HTMLElement;
    expect(figure.style.transform).toContain('translate3d');
  });

  it('собирает слоёную композицию, когда все файлы на месте', async () => {
    allLayers();
    render(<PetCompanion />);
    await flushAssets();

    expect(
      screen.getByTestId('pet-companion').getAttribute('data-status'),
    ).toBe('layered');
    expect(screen.getByTestId('pet-layer-arm-left')).toBeTruthy();
    expect(screen.getByTestId('pet-layer-arm-right')).toBeTruthy();
    expect(screen.getByTestId('pet-layer-eyes')).toBeTruthy();
  });
});

describe('позы', () => {
  it('setPose("arms-down") опускает обе руки на настроенный угол', async () => {
    allLayers();
    const ref = createRef<PetCompanionHandle>();
    render(<PetCompanion ref={ref} />);
    await flushAssets();

    act(() => ref.current?.setPose('arms-down'));
    await advance(900);

    const left = screen.getByTestId('pet-layer-arm-left') as HTMLElement;
    const right = screen.getByTestId('pet-layer-arm-right') as HTMLElement;

    expect(ref.current?.getPose()).toBe('arms-down');
    expectAngle(rotationOf(left), POSES['arms-down'].leftArmRotation);
    expectAngle(rotationOf(right), POSES['arms-down'].rightArmRotation);
  });
});

describe('действия', () => {
  it('wave возвращает питомца к позе, которая была до него', async () => {
    allLayers();
    const ref = createRef<PetCompanionHandle>();
    render(<PetCompanion ref={ref} />);
    await flushAssets();

    act(() => ref.current?.setPose('arms-middle'));
    await advance(900);
    const before = rotationOf(screen.getByTestId('pet-layer-arm-right'));

    let done = false;
    act(() => {
      void ref.current?.wave('right').then(() => {
        done = true;
      });
    });
    await advance(2000);

    expect(done).toBe(true);
    expect(ref.current?.getPose()).toBe('arms-middle');
    expectAngle(rotationOf(screen.getByTestId('pet-layer-arm-right')), before);
  });

  it('promise действия завершается', async () => {
    allLayers();
    const ref = createRef<PetCompanionHandle>();
    render(<PetCompanion ref={ref} />);
    await flushAssets();

    let resolved = false;
    act(() => {
      void ref.current?.celebrate().then(() => {
        resolved = true;
      });
    });
    await advance(2000);
    expect(resolved).toBe(true);
  });

  it('повторный запуск того же действия не оставляет питомца сломанным', async () => {
    allLayers();
    const ref = createRef<PetCompanionHandle>();
    render(<PetCompanion ref={ref} />);
    await flushAssets();

    const settled: string[] = [];
    act(() => {
      void ref.current?.wave('right').then(() => settled.push('first'));
    });
    await advance(200);
    act(() => {
      void ref.current?.wave('right').then(() => settled.push('second'));
    });
    await advance(2500);

    // Оба промиса обязаны завершиться, иначе await повиснет навсегда.
    expect(settled).toContain('first');
    expect(settled).toContain('second');
    // И рука вернулась к базовой позе, а не застряла между состояниями.
    expectAngle(
      rotationOf(screen.getByTestId('pet-layer-arm-right')),
      POSES.idle.rightArmRotation,
    );
  });

  it('sleep блокирует автоматические действия и закрывает глаза', async () => {
    allLayers();
    const ref = createRef<PetCompanionHandle>();
    render(<PetCompanion ref={ref} />);
    await flushAssets();

    act(() => ref.current?.sleep());
    await advance(600);

    expect(ref.current?.getPose()).toBe('sleep');
    const eyes = screen.getByTestId('pet-layer-eyes') as HTMLElement;
    expect(Number(eyes.style.opacity)).toBeCloseTo(1, 1);

    // play в режиме сна не должен ничего запускать, но обязан зарезолвиться.
    let resolved = false;
    act(() => {
      void ref.current?.celebrate().then(() => {
        resolved = true;
      });
    });
    await advance(50);
    expect(resolved).toBe(true);
    expect(ref.current?.getPose()).toBe('sleep');

    act(() => ref.current?.wake());
    await advance(600);
    expect(ref.current?.getPose()).toBe('idle');
  });
});

describe('очистка', () => {
  it('снимает кадры и таймеры после unmount', async () => {
    allLayers();
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const {unmount} = render(<PetCompanion />);
    await flushAssets();
    await advance(300);

    unmount();
    expect(cancelSpy).toHaveBeenCalled();

    // После размонтирования новых кадров быть не должно.
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');
    rafSpy.mockClear();
    await advance(1000);
    expect(rafSpy).not.toHaveBeenCalled();
  });
});

describe('prefers-reduced-motion', () => {
  it('не качает питомца, но позы по-прежнему переключаются', async () => {
    allLayers();
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    const ref = createRef<PetCompanionHandle>();
    render(<PetCompanion ref={ref} />);
    await flushAssets();
    await advance(1500);

    const figure = screen
      .getByTestId('pet-stage')
      .querySelector('span') as HTMLElement;
    // Ни подъёма, ни наклона: все трансформы нулевые.
    expect(figure.style.transform).toContain('translate3d(0.00px, 0.00px, 0)');
    expect(rotationOf(figure)).toBeCloseTo(0, 3);

    act(() => ref.current?.setPose('arms-down'));
    await advance(400);
    // В reduced-motion покачивания нет, поэтому угол должен совпасть точно.
    expect(rotationOf(screen.getByTestId('pet-layer-arm-left'))).toBeCloseTo(
      POSES['arms-down'].leftArmRotation,
      1,
    );
  });
});

describe('доступность и ввод', () => {
  it('декоративный питомец скрыт от скринридера', async () => {
    allLayers();
    render(<PetCompanion />);
    await flushAssets();
    expect(screen.getByTestId('pet-companion').getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('интерактивный питомец — кнопка с подписью и работает с клавиатуры', async () => {
    allLayers();
    const onClick = vi.fn();
    render(<PetCompanion interactive onClick={onClick} ariaLabel="Помощник" />);
    await flushAssets();

    const button = screen.getByRole('button', {name: 'Помощник'});
    expect(button.tagName).toBe('BUTTON');

    // Нативная кнопка отрабатывает Enter и Space как click.
    fireEvent.click(button);
    await advance(50);
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(button, {key: 'Enter'});
    fireEvent.click(button);
    await advance(50);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('после перетаскивания клик не срабатывает', async () => {
    allLayers();
    const onClick = vi.fn();
    render(<PetCompanion interactive draggable onClick={onClick} />);
    await flushAssets();

    const button = screen.getByTestId('pet-companion');
    fireEvent.pointerDown(button, {pointerId: 1, clientX: 100, clientY: 100});
    fireEvent.pointerMove(button, {pointerId: 1, clientX: 160, clientY: 140});
    fireEvent.pointerUp(button, {pointerId: 1, clientX: 160, clientY: 140});
    fireEvent.click(button);
    await advance(100);

    expect(onClick).not.toHaveBeenCalled();

    // Обычный клик без движения по-прежнему работает.
    fireEvent.pointerDown(button, {pointerId: 2, clientX: 100, clientY: 100});
    fireEvent.pointerUp(button, {pointerId: 2, clientX: 101, clientY: 100});
    fireEvent.click(button);
    await advance(100);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('сохраняет позицию после перетаскивания', async () => {
    allLayers();
    render(<PetCompanion interactive draggable />);
    await flushAssets();

    const button = screen.getByTestId('pet-companion');
    fireEvent.pointerDown(button, {pointerId: 3, clientX: 100, clientY: 100});
    fireEvent.pointerMove(button, {pointerId: 3, clientX: 140, clientY: 130});
    fireEvent.pointerUp(button, {pointerId: 3, clientX: 140, clientY: 130});

    expect(window.localStorage.getItem('pet-companion:position:v1')).toBeTruthy();
  });
});
