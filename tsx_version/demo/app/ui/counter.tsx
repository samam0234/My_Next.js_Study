"use client";

import { useState } from "react";

type CounterProps = {
  initialCount?: number;
  label: string;
};

export function Counter({ initialCount = 0, label }: CounterProps) {
  const [count, setCount] = useState(initialCount);

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{count}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white"
          onClick={() => setCount((n) => n + 1)}
        >
          +1
        </button>
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-1.5 text-sm"
          onClick={() => setCount(initialCount)}
        >
          리셋
        </button>
      </div>
    </div>
  );
}
