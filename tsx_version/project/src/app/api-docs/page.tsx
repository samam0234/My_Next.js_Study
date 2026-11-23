import { openapi } from '@/course/openapi';
export default function ApiDocs() { return <section><h1>OpenAPI 3 · 게시판 v1</h1><p><a href="/api/openapi" download="openapi.json">OpenAPI JSON 다운로드</a> · <a href="/board">게시판</a></p><p>Swagger Editor에 JSON을 가져오면 요청 스키마를 확인할 수 있습니다.</p><pre style={{ overflowX: 'auto' }}>{JSON.stringify(openapi, null, 2)}</pre></section>; }
