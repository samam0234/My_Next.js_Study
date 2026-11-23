"use client";
import { useState } from "react";
export function Counter({ label, initial = 0, }) {
    const [count, setCount] = useState(initial);
    return (<button onClick={() => setCount((n) => n + 1)}>
      {label}: {count}
    </button>);
}
