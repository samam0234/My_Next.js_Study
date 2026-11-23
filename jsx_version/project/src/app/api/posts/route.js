import { route as handle } from '@/course/entry';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Next의 두 번째 인자(context)를 내부 extension 콜백으로 넘기지 않는다.
function dispatch(request) { return handle(request); }
export { dispatch as GET, dispatch as POST, dispatch as PATCH, dispatch as DELETE, dispatch as OPTIONS, dispatch as PUT };
