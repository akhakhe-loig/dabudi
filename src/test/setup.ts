import {afterEach, vi} from 'vitest';
import {cleanup} from '@testing-library/react';

// jsdom не реализует matchMedia — компонент спрашивает его про
// prefers-reduced-motion и pointer: coarse.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// В jsdom нет Pointer Capture.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function setPointerCapture() {};
  Element.prototype.releasePointerCapture = function releasePointerCapture() {};
  Element.prototype.hasPointerCapture = function hasPointerCapture() {
    return false;
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
