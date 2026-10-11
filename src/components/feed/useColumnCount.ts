'use client';

import { useSyncExternalStore } from 'react';

// 手机 2 列，平板 3 列，桌面 4 列，大屏 5 列
const BREAKPOINTS: [number, number][] = [
  [1280, 5],
  [1024, 4],
  [768, 3],
];

function compute(): number {
  if (typeof window === 'undefined') return 2;
  const w = window.innerWidth;
  for (const [min, cols] of BREAKPOINTS) if (w >= min) return cols;
  return 2;
}

function subscribe(callback: () => void) {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

/** 当前列数。服务端渲染按 2 列（手机），浏览器挂载后按实际宽度。 */
export function useColumnCount(): number {
  return useSyncExternalStore(subscribe, compute, () => 2);
}
