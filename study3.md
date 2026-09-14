# study3 — 실습 3: Server Component vs Client Component

[study2.md](study2.md)의 페이지는 전부 서버 컴포넌트였습니다. 버튼을 누르면 숫자가 바뀌는 UI는 브라우저 상태가 필요하므로 **클라이언트 컴포넌트**를 한 파일만 만듭니다.

---

## 1. 기본값은 서버

`app/about/page.tsx`에는 `"use client"`가 없습니다. 그래서

- `const serverStamp = new Date().toISOString()` 는 서버에서 한 번 실행되고 HTML에 박힙니다.
- `useState`나 `onClick`을 이 파일에 직접 쓰면 빌드가 실패합니다.

## 2. `"use client"`는 파일 최상단

```tsx
"use client"

import { useState } from "react"

export function Counter({ initialCount = 0, label }: { initialCount?: number; label: string }) {
  const [count, setCount] = useState(initialCount)
  return <button onClick={() => setCount((n) => n + 1)}>+1 {count}</button>
}
```

이 지시어는 "이 모듈부터 클라이언트 번들"이라는 뜻입니다. 페이지 전체가 클라이언트가 될 필요는 없습니다. **상호작용이 있는 잎(leaf)** 만 클라이언트로 내립니다.

## 3. 서버 → 클라이언트로 props

about 페이지는 서버이고, 그 안에서 `<Counter initialCount={3} />`를 그립니다.

- 숫자 `3`, 문자열 `label`처럼 **직렬화 가능한 값**만 넘깁니다.
- 함수(`onClick` 핸들러를 서버에서 만들어 넘기기)는 못 넘깁니다. 이벤트는 클라이언트 파일이 가집니다.

반대 방향: 클라이언트 파일이 서버 컴포넌트를 `import`하면 그 서버 파일도 클라이언트 번들에 끌려갑니다. 서버 컴포넌트를 클라이언트 안으로 넣으려면 `children`으로 통과시킵니다.

```
서버 page
  └─ 클라이언트 Counter   ← OK
클라이언트 Counter
  └─ import 서버 모듈     ← 안 됨
```

## 4. 확인

`/about`에서

1. "서버 컴포넌트가 만든 시각"은 새로고침해야 바뀝니다.
2. 카운터의 +1은 새로고침 없이 숫자가 올라갑니다.
3. 리셋을 누르면 `initialCount`(서버가 준 3)로 돌아갑니다.

페이지 소스 보기: 서버 시각 문자열은 HTML에 있고, 카운터 숫자 `3`도 초기 HTML에 있습니다. 버튼을 누른 뒤의 숫자는 소스에 없고 브라우저 메모리에만 있습니다.

다음: [study4.md](study4.md) — `loading`/`error`/`not-found`와 `app/api` Route Handler.
