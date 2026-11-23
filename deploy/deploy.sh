#!/bin/sh
set -eu
cd /opt/next-study
image="next-study:$1"
docker image inspect "$image" >/dev/null
# .env.production과 data 디렉터리는 서버에서만 관리한다.
previous=$(docker inspect --format '{{.Config.Image}}' next-study 2>/dev/null || true)
docker stop next-study 2>/dev/null || true
docker rm next-study 2>/dev/null || true
docker run -d --name next-study --restart unless-stopped --env-file .env.production -p 127.0.0.1:3000:3000 -v next-study-data:/app/data "$image"
healthy=false
for attempt in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/health >/dev/null; then healthy=true; break; fi
  sleep 2
done
if [ "$healthy" = false ]; then
  docker logs --tail 100 next-study
  docker stop next-study
  docker rm next-study
  if [ -n "$previous" ]; then docker run -d --name next-study --restart unless-stopped --env-file .env.production -p 127.0.0.1:3000:3000 -v next-study-data:/app/data "$previous"; fi
  exit 1
fi
