"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// How many of a wrapping list's `count` items fit in `rows` rows when the last place is taken
// by a "+N more" item (RAA-126): the listing row's chips (two rows) and a section's filter
// markers (one). Returns refs for the list and the "+N more" item, and `shown`: null while
// measuring (render every item), `count` when all fit, otherwise how many come before
// "+N more". It measures again when the list's width or `key` changes.
export function useFitRows<L extends HTMLElement, M extends HTMLElement>(rows: number, count: number, key?: unknown) {
  const [shown, setShown] = useState<number | null>(null);
  const [measuredFor, setMeasuredFor] = useState(key);
  const list = useRef<L>(null);
  const more = useRef<M>(null);
  // New items: measure afresh (state adjusted during render, as React advises over an effect).
  if (measuredFor !== key) {
    setMeasuredFor(key);
    setShown(null);
  }

  // Measure without "+N more" first; then, with it placed, step it back until it fits on the
  // last row. Rows are counted from the first item's height.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el || count === 0) return;
    const items = Array.from(el.children) as HTMLElement[];
    const first = items[0];
    const gap = parseFloat(getComputedStyle(el).rowGap) || 0;
    const limit = rows * (first.offsetHeight + gap) - gap;
    const overflows = (item: HTMLElement) => item.offsetTop - first.offsetTop + item.offsetHeight > limit + 1;
    if (shown === null) {
      const index = items.findIndex(overflows);
      setShown(index === -1 ? count : index);
    } else if (shown < count && shown > 0 && more.current?.offsetParent && overflows(more.current)) {
      setShown(shown - 1);
    }
  }, [shown, count, rows]);

  useEffect(() => {
    const el = list.current;
    if (!el) return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      setShown(null);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { list, more, shown, hidden: shown === null ? 0 : count - shown };
}
