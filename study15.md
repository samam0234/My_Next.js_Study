# study15 — 성능·캐시·비동기 작업

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

공개 데이터만 캐시하고 영속 작업 큐와 측정으로 성능을 확인한다.

## ② 📖 이론

캐시는 결과를 재사용해 읽기 비용을 줄인다. 예제의 공개 개념 사전은 unstable_cache로 60초 재사용한다. 로그인별 데이터와 쿠키를 읽는 결과는 공유 캐시에 넣지 않는다. 외부 fetch에는 revalidate 또는 no-store 정책을 명시적으로 선택한다.

동시에 필요한 상세·댓글은 Promise.all로 읽어 순차 왕복을 줄인다. 요청 처리 뒤 setTimeout으로 중요한 작업을 예약하면 프로세스가 끝날 때 잃을 수 있다. /api/jobs는 먼저 DB에 pending을 기록하고 별도 워커가 처리한다.

캐시는 자주 보는 책의 책갈피이고 작업 큐는 번호표다. 큐에 접수된 작업은 새 프로세스에서도 처리되어야 한다. 워커는 공백 정리·미리보기 생성이라는 결정적 작업을 짧은 트랜잭션에서 끝낸다. 외부 AI 호출을 트랜잭션 안에 추가하지 않는다.

성능은 체감만으로 판단하지 않는다. /api/posts 응답의 p50·p95, 브라우저 Network의 크기·시간, Lighthouse의 LCP·CLS·INP를 기록한다. 최적화 전후에는 같은 데이터·환경·요청 수를 사용한다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. /lab을 두 번 열어 공개 캐시의 생성 시각이 재사용되는지 확인한다.
2. /workbench에서 텍스트 처리 작업을 예약한 뒤 작업 id를 기록한다.
3. 별도 터미널에서 npm run worker를 실행하고 작업 상태가 pending에서 done으로 바뀌는지 확인한다.
4. measure.mjs로 API 20회 p50·p95를 기록한다. 브라우저 개발자도구와 Lighthouse로 화면 비용도 따로 확인한다.

~~~powershell
cd tsx_version/project
npm run dev
# 다른 터미널에서 작업 예약 후
npm run worker
node scripts/measure.mjs
# 배포 모드 측정은 build → start 후 같은 명령으로 수행
~~~

### 측정·캐시 점검

- [ ] 최초·반복 요청을 나누어 측정했다.
- [ ] 동일 사용자·동일 데이터 규모로 전후 값을 기록했다.
- [ ] 개인 응답은 Cache-Control: no-store다.
- [ ] 여러 사용자에서 캐시 결과가 섞이지 않는다.
- [ ] 작업 실패와 재시도 횟수를 확인했다.

현재 단일 행 저장소는 목록을 메모리에서 정렬·페이징하므로 데이터가 커질수록 느려진다. 운영 개선은 정규화·검색 인덱스·DB LIMIT/OFFSET 또는 cursor pagination 순서로 진행한다. 캐시를 붙여 이 구조적 비용을 감추지 않는다.

### tsx_version/project/src/course/cache.ts

[실행 파일](tsx_version/project/src/course/cache.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/src/course/cache.ts sha256:f702479cd6a3f10e977e0d1512fc398005c3fc0bc8371b646b583f81d25f43e8 -->
~~~ts
import { unstable_cache } from "next/cache";
// 공개된 개념 설명만 캐시한다. 쿠키·세션·개인 문서는 이 함수에 넣지 않는다.
export const readGlossary = unstable_cache(
  async () => ({
    routing: "폴더와 page가 URL을 만든다.",
    generatedAt: new Date().toISOString(),
  }),
  ["public-glossary-v1"],
  { revalidate: 60, tags: ["glossary"] },
);
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { unstable_cache } from "next/cache"; |
| 2 | 주석: 공개된 개념 설명만 캐시한다. 쿠키·세션·개인 문서는 이 함수에 넣지 않는다. |
| 3 | 이름 있는 값·설정·함수 또는 상태를 준비한다: export const readGlossary = unstable_cache( |
| 4 | 현재 구문에서 다음 값·인자·표현식을 연결한다: async () => ({ |
| 5 | 객체·스키마·속성의 값을 지정한다: routing: "폴더와 page가 URL을 만든다.", |
| 6 | 객체·스키마·속성의 값을 지정한다: generatedAt: new Date().toISOString(), |
| 7 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 8 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ["public-glossary-v1"], |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { revalidate: 60, tags: ["glossary"] }, |
| 10 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/project/src/course/worker.ts

[실행 파일](tsx_version/project/src/course/worker.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/src/course/worker.ts sha256:038044b3abb85e6a869c99c1793197492207d7ac573859d607ebec84974c4664 -->
~~~ts
import { getRepository } from "./repository";
// 단일 워커를 별도 프로세스로 실행한다. HTTP 응답 뒤의 비영속 setTimeout에 의존하지 않는다.
export async function runOnce() {
  const repo = await getRepository();
  return repo.change((state) => {
    const job = state.jobs.find((j) => j.status === "pending");
    if (!job) return null;
    job.attempts++;
    try {
      job.result = job.text.replace(/\s+/g, " ").slice(0, 300);
      job.status = "done";
    } catch {
      job.status = job.attempts >= 3 ? "failed" : "pending";
    }
    return { id: job.id, status: job.status };
  });
}
if (process.argv.includes("--once")) console.log(await runOnce());
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { getRepository } from "./repository"; |
| 2 | 주석: 단일 워커를 별도 프로세스로 실행한다. HTTP 응답 뒤의 비영속 setTimeout에 의존하지 않는다. |
| 3 | runOnce의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 4 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const repo = await getRepository(); |
| 5 | Repository의 원자적 갱신 경계 안에서 상태를 변경한다. 콜백 안에 외부 부작용을 넣지 않는다. |
| 6 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const job = state.jobs.find((j) => j.status === "pending"); |
| 7 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!job) return null; |
| 8 | 현재 구문에서 다음 값·인자·표현식을 연결한다: job.attempts++; |
| 9 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 10 | 현재 구문에서 다음 값·인자·표현식을 연결한다: job.result = job.text.replace(/\s+/g, " ").slice(0, 300); |
| 11 | 현재 구문에서 다음 값·인자·표현식을 연결한다: job.status = "done"; |
| 12 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 13 | 현재 구문에서 다음 값·인자·표현식을 연결한다: job.status = job.attempts >= 3 ? "failed" : "pending"; |
| 14 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 15 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return { id: job.id, status: job.status }; |
| 16 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 17 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 18 | 입력·상태 조건에 따라 처리 경로를 고른다: if (process.argv.includes("--once")) console.log(await runOnce()); |

### tsx_version/project/scripts/measure.mjs

[실행 파일](tsx_version/project/scripts/measure.mjs)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/scripts/measure.mjs sha256:1399bc4428f023561e5f8fdf1f7c3480edcab640440187e205009a08dc456863 -->
~~~ts
const base = process.env.BASE_URL ?? "http://localhost:3000";
const samples = [];
for (let index = 0; index < 20; index++) {
  const start = performance.now();
  const response = await fetch(`${base}/api/posts?limit=10`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  await response.arrayBuffer();
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      requests: samples.length,
      p50ms: samples[9],
      p95ms: samples[18],
      maxMs: samples[19],
    },
    null,
    2,
  ),
);
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const base = process.env.BASE_URL ?? "http://localhost:3000"; |
| 2 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const samples = []; |
| 3 | 배열·반복 요청·스트림을 순서대로 처리하며 종료 조건을 확인한다. |
| 4 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const start = performance.now(); |
| 5 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: const response = await fetch(ˋ${base}/api/posts?limit=10ˋ); |
| 6 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: if (!response.ok) throw new Error(ˋHTTP ${response.status}ˋ); |
| 7 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await response.arrayBuffer(); |
| 8 | 현재 구문에서 다음 값·인자·표현식을 연결한다: samples.push(performance.now() - start); |
| 9 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 10 | 현재 구문에서 다음 값·인자·표현식을 연결한다: samples.sort((a, b) => a - b); |
| 11 | 현재 구문에서 다음 값·인자·표현식을 연결한다: console.log( |
| 12 | 현재 구문에서 다음 값·인자·표현식을 연결한다: JSON.stringify( |
| 13 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 14 | 객체·스키마·속성의 값을 지정한다: requests: samples.length, |
| 15 | 객체·스키마·속성의 값을 지정한다: p50ms: samples[9], |
| 16 | 객체·스키마·속성의 값을 지정한다: p95ms: samples[18], |
| 17 | 객체·스키마·속성의 값을 지정한다: maxMs: samples[19], |
| 18 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 19 | 현재 구문에서 다음 값·인자·표현식을 연결한다: null, |
| 20 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 2, |
| 21 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 22 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

## ④ 🔗 연동 포인트

영속 작업 상태는 study17의 SSE 알림으로 전달한다. 측정값과 requestId 로그는 study16의 운영 모니터링으로 이어진다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| 다른 사람 데이터가 캐시됨 | 개인 결과를 공유 key로 저장 | 개인 조회 no-store·사용자 경계 재설계 |
| 응답 후 작업 사라짐 | 메모리 타이머만 사용 | DB 큐에 먼저 기록 |
| 워크 처리 중 중복 부작용 | 재시도 콜백에 외부 호출 | claim/lease·멱등키·짧은 트랜잭션 분리 |

## ⑥ 직접 해보기

1. 문서 길이를 바꿔 작업 처리 결과를 비교한다.
2. API p95를 전후 동일 조건으로 기록한다.
3. 공개 캐시와 사용자 응답의 캐시 헤더를 확인한다.

## ⑦ ☐ 체크리스트

- [ ] 공개 캐시와 개인 no-store를 분리했다.
- [ ] 비동기 요청·영속 백그라운드 작업을 구분한다.
- [ ] 성능 지표와 측정 조건을 기록할 수 있다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study16](study16.md)에서 자동 검증과 재현 가능한 배포·로그·백업·복원 절차를 준비한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
