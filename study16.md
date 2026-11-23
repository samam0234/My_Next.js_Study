# study16 — 운영·Docker·GitHub Actions·백업

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

자동 검증과 재현 가능한 배포·로그·백업·복원 절차를 준비한다.

## ② 📖 이론

Docker는 실행 환경을 이미지로 묶고 볼륨으로 DB를 보존한다. 빌드 단계에는 개발 의존성을 쓰고 runner는 standalone 산출물과 정적 파일만 포함한다. 비밀 .env와 DB는 이미지에 넣지 않는다.

GitHub Actions CI는 push/PR마다 네 앱의 설치·린트·테스트·빌드·HTTP smoke를 실행한다. 배포 workflow는 production 환경에서 수동 시작 후 검증→이미지 전송→고정 서버 경로의 deploy.sh를 자동 실행한다. 배포 대상·키가 없는 상태에서 성공했다고 기록하지 않는다.

로그는 JSON requestId·경로·상태·처리 시간을 남긴다. 비밀번호·토큰·본문은 로그에 넣지 않는다. /health는 실제 Repository를 읽어 DB 연결을 점검한다. 가동률·오류율·p95·디스크 사용량·백업 성공 시각을 관찰한다.

백업은 보험 증권이 아니라 복원 가능한 복사본이다. SQLite는 node:sqlite backup API로 일관된 스냅샷을 만든다. 서버 DB는 각 엔진의 dump 도구를 쓴다. 복원은 운영 DB를 덮기 전에 빈 별도 환경에서 검증한다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. Docker 엔진을 실행하고 compose config로 구문을 확인한다. DB_PASSWORD는 환경에서 주입한다.
2. .env.local에 운영값을 준비하고 app profile로 이미지를 빌드·실행한다. /health와 재시작 후 데이터를 확인한다.
3. GitHub production environment에 DEPLOY_HOST/USER/KEY/KNOWN_HOSTS를 등록한다. known_hosts는 관리자가 확인한 서버 지문을 사용한다.
4. 서버 /opt/next-study에 deploy.sh와 .env.production을 설치한다. 셸 실행 권한과 Docker·curl, 영속 볼륨을 준비한 뒤 배포 workflow를 실행한다.
5. npm run backup으로 SQLite 백업을 만들고 별도 COURSE_DB_PATH에 복원하여 health·건수·로그인을 확인한다. 보관 기간·오프사이트 복사·복원 시간을 기록한다.

~~~powershell
cd tsx_version/project
$env:DB_PASSWORD="local-study-change-me"
docker compose --profile app config
docker compose --profile app up -d --build app
docker compose logs --tail 100 app
npm run backup
# SQL 서버 백업(해당 profile 사용 시, 비밀번호는 엔진 환경에서 공급)
# docker compose exec -T postgres pg_dump -U study -d next_study -f /tmp/next-study.sql
# docker compose cp postgres:/tmp/next-study.sql backups/next-study.sql
# MariaDB: mariadb-dump --single-transaction, MongoDB: mongodump --archive 사용
~~~

### 운영 체크리스트

- [ ] 네 앱 CI가 모두 통과한다.
- [ ] 실제 서버 지문과 SSH 최소 권한을 확인했다.
- [ ] .env.production은 서버에만 존재한다.
- [ ] HTTPS reverse proxy에서 도메인을 종단한다.
- [ ] /health 실패 시 이전 이미지로 되돌린다.
- [ ] 5xx 오류율·p95·볼륨 용량·백업 시각을 관찰한다.
- [ ] DB는 외부에 공개하지 않고 내부 연결·TLS를 사용한다.
- [ ] 복원 실험과 복구 소요 시간·보관 주기를 기록했다.

백업 예시: SQLite는 backups의 .db를 복사해 별도 COURSE_DB_PATH로 시작한다. PostgreSQL SQL dump는 빈 DB에 psql -U study -d next_study -f 파일로 적용한다. MariaDB는 새 DB에 mariadb 클라이언트로 import한다. MongoDB는 빈 이름의 DB에 mongorestore --archive와 대상 namespace 매핑으로 복원한다. 백업에는 개인 데이터·해시가 있으므로 접근권한·암호화·Git 제외를 유지한다. 이번 환경의 Docker 엔진은 미실행 상태여서 컨테이너 기동·원격 배포는 미검증이다.

### tsx_version/project/Dockerfile

[실행 파일](tsx_version/project/Dockerfile)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/Dockerfile sha256:2641eb2a3b4da33ebf7120511649e49d984f62f19932771341be6b83b80019e3 -->
~~~dockerfile
FROM node:24.14.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM builder AS worker
USER node
CMD ["npm", "run", "worker"]

FROM node:24.14.0-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: FROM node:24.14.0-bookworm-slim AS dependencies |
| 2 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: WORKDIR /app |
| 3 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: COPY package.json package-lock.json ./ |
| 4 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: RUN npm ci |
| 6 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: FROM dependencies AS builder |
| 7 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: COPY . . |
| 8 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: ENV NEXT_TELEMETRY_DISABLED=1 |
| 9 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: RUN npm run build |
| 11 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: FROM builder AS worker |
| 12 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: USER node |
| 13 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: CMD ["npm", "run", "worker"] |
| 15 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: FROM node:24.14.0-bookworm-slim AS runner |
| 16 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: WORKDIR /app |
| 17 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 |
| 18 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: COPY --from=builder --chown=node:node /app/.next/standalone ./ |
| 19 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: COPY --from=builder --chown=node:node /app/.next/static ./.next/static |
| 20 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: COPY --from=builder --chown=node:node /app/public ./public |
| 21 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: RUN mkdir -p /app/data && chown node:node /app/data |
| 22 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: USER node |
| 23 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: EXPOSE 3000 |
| 24 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: CMD ["node", "server.js"] |

### tsx_version/project/.dockerignore

[실행 파일](tsx_version/project/.dockerignore)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/.dockerignore sha256:ecbb6b7c2f56f5eb18df47f662c8f7cc083ab232f7d2645822fbea9babc8c7e8 -->
~~~text
node_modules
.next
.env*
!.env.example
data
backups
*.log
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 현재 구문에서 다음 값·인자·표현식을 연결한다: node_modules |
| 2 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .next |
| 3 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .env* |
| 4 | 현재 구문에서 다음 값·인자·표현식을 연결한다: !.env.example |
| 5 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data |
| 6 | 현재 구문에서 다음 값·인자·표현식을 연결한다: backups |
| 7 | 현재 구문에서 다음 값·인자·표현식을 연결한다: *.log |

### tsx_version/project/compose.yaml

[실행 파일](tsx_version/project/compose.yaml)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/compose.yaml sha256:acc3776446d29d4593601b335cfffcc73071040c759aa93e56cee63c5a66a9b2 -->
~~~yaml
services:
  app:
    profiles: [app]
    build: .
    ports: ["127.0.0.1:3000:3000"]
    env_file: .env.local
    volumes: [course-data:/app/data]
    restart: unless-stopped
    healthcheck:
      test: [CMD, node, -e, "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 5
  worker:
    profiles: [tasks]
    build:
      context: .
      target: worker
    env_file: .env.local
    volumes: [course-data:/app/data]
  postgres:
    profiles: [postgres]
    image: postgres:17
    environment:
      POSTGRES_USER: study
      POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요}
      POSTGRES_DB: next_study
    ports: ["127.0.0.1:55432:5432"]
    volumes: [postgres-data:/var/lib/postgresql/data]
    healthcheck:
      test: [CMD-SHELL, "pg_isready -U study -d next_study"]
      interval: 5s
      retries: 20
  mariadb:
    profiles: [mariadb]
    image: mariadb:11
    environment:
      MARIADB_USER: study
      MARIADB_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요}
      MARIADB_ROOT_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요}
      MARIADB_DATABASE: next_study
    ports: ["127.0.0.1:53306:3306"]
    volumes: [maria-data:/var/lib/mysql]
    healthcheck:
      test: [CMD, healthcheck.sh, --connect, --innodb_initialized]
      interval: 5s
      retries: 20
  mongodb:
    profiles: [mongodb]
    image: mongo:8
    environment:
      MONGO_INITDB_ROOT_USERNAME: study
      MONGO_INITDB_ROOT_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요}
    ports: ["127.0.0.1:57017:27017"]
    volumes: [mongo-data:/data/db]
volumes:
  course-data:
  postgres-data:
  maria-data:
  mongo-data:
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 객체·스키마·속성의 값을 지정한다: services: |
| 2 | 객체·스키마·속성의 값을 지정한다: app: |
| 3 | 객체·스키마·속성의 값을 지정한다: profiles: [app] |
| 4 | 객체·스키마·속성의 값을 지정한다: build: . |
| 5 | 객체·스키마·속성의 값을 지정한다: ports: ["127.0.0.1:3000:3000"] |
| 6 | 객체·스키마·속성의 값을 지정한다: env_file: .env.local |
| 7 | 객체·스키마·속성의 값을 지정한다: volumes: [course-data:/app/data] |
| 8 | 객체·스키마·속성의 값을 지정한다: restart: unless-stopped |
| 9 | 객체·스키마·속성의 값을 지정한다: healthcheck: |
| 10 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: test: [CMD, node, -e, "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"] |
| 11 | 객체·스키마·속성의 값을 지정한다: interval: 15s |
| 12 | 객체·스키마·속성의 값을 지정한다: timeout: 5s |
| 13 | 객체·스키마·속성의 값을 지정한다: retries: 5 |
| 14 | 객체·스키마·속성의 값을 지정한다: worker: |
| 15 | 객체·스키마·속성의 값을 지정한다: profiles: [tasks] |
| 16 | 객체·스키마·속성의 값을 지정한다: build: |
| 17 | 객체·스키마·속성의 값을 지정한다: context: . |
| 18 | 객체·스키마·속성의 값을 지정한다: target: worker |
| 19 | 객체·스키마·속성의 값을 지정한다: env_file: .env.local |
| 20 | 객체·스키마·속성의 값을 지정한다: volumes: [course-data:/app/data] |
| 21 | 객체·스키마·속성의 값을 지정한다: postgres: |
| 22 | 객체·스키마·속성의 값을 지정한다: profiles: [postgres] |
| 23 | 객체·스키마·속성의 값을 지정한다: image: postgres:17 |
| 24 | 객체·스키마·속성의 값을 지정한다: environment: |
| 25 | 객체·스키마·속성의 값을 지정한다: POSTGRES_USER: study |
| 26 | 객체·스키마·속성의 값을 지정한다: POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요} |
| 27 | 객체·스키마·속성의 값을 지정한다: POSTGRES_DB: next_study |
| 28 | 객체·스키마·속성의 값을 지정한다: ports: ["127.0.0.1:55432:5432"] |
| 29 | 객체·스키마·속성의 값을 지정한다: volumes: [postgres-data:/var/lib/postgresql/data] |
| 30 | 객체·스키마·속성의 값을 지정한다: healthcheck: |
| 31 | 객체·스키마·속성의 값을 지정한다: test: [CMD-SHELL, "pg_isready -U study -d next_study"] |
| 32 | 객체·스키마·속성의 값을 지정한다: interval: 5s |
| 33 | 객체·스키마·속성의 값을 지정한다: retries: 20 |
| 34 | 객체·스키마·속성의 값을 지정한다: mariadb: |
| 35 | 객체·스키마·속성의 값을 지정한다: profiles: [mariadb] |
| 36 | 객체·스키마·속성의 값을 지정한다: image: mariadb:11 |
| 37 | 객체·스키마·속성의 값을 지정한다: environment: |
| 38 | 객체·스키마·속성의 값을 지정한다: MARIADB_USER: study |
| 39 | 객체·스키마·속성의 값을 지정한다: MARIADB_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요} |
| 40 | 객체·스키마·속성의 값을 지정한다: MARIADB_ROOT_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요} |
| 41 | 객체·스키마·속성의 값을 지정한다: MARIADB_DATABASE: next_study |
| 42 | 객체·스키마·속성의 값을 지정한다: ports: ["127.0.0.1:53306:3306"] |
| 43 | 객체·스키마·속성의 값을 지정한다: volumes: [maria-data:/var/lib/mysql] |
| 44 | 객체·스키마·속성의 값을 지정한다: healthcheck: |
| 45 | 객체·스키마·속성의 값을 지정한다: test: [CMD, healthcheck.sh, --connect, --innodb_initialized] |
| 46 | 객체·스키마·속성의 값을 지정한다: interval: 5s |
| 47 | 객체·스키마·속성의 값을 지정한다: retries: 20 |
| 48 | 객체·스키마·속성의 값을 지정한다: mongodb: |
| 49 | 객체·스키마·속성의 값을 지정한다: profiles: [mongodb] |
| 50 | 객체·스키마·속성의 값을 지정한다: image: mongo:8 |
| 51 | 객체·스키마·속성의 값을 지정한다: environment: |
| 52 | 객체·스키마·속성의 값을 지정한다: MONGO_INITDB_ROOT_USERNAME: study |
| 53 | 객체·스키마·속성의 값을 지정한다: MONGO_INITDB_ROOT_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요} |
| 54 | 객체·스키마·속성의 값을 지정한다: ports: ["127.0.0.1:57017:27017"] |
| 55 | 객체·스키마·속성의 값을 지정한다: volumes: [mongo-data:/data/db] |
| 56 | 객체·스키마·속성의 값을 지정한다: volumes: |
| 57 | 객체·스키마·속성의 값을 지정한다: course-data: |
| 58 | 객체·스키마·속성의 값을 지정한다: postgres-data: |
| 59 | 객체·스키마·속성의 값을 지정한다: maria-data: |
| 60 | 객체·스키마·속성의 값을 지정한다: mongo-data: |

### .github/workflows/ci.yml

[실행 파일](.github/workflows/ci.yml)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:.github/workflows/ci.yml sha256:ef5c90bca0bc2b686d68f07249816509976d645863b408d84ae7aaa3cbce5152 -->
~~~yaml
name: Next.js 학습 검증
on:
  push:
    branches: [master, main]
  pull_request:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  app:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        directory: [tsx_version/demo, jsx_version/demo, tsx_version/project, jsx_version/project]
    defaults:
      run:
        working-directory: ${{ matrix.directory }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24.14.0
          cache: npm
          cache-dependency-path: ${{ matrix.directory }}/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: node scripts/storage-check.mjs
      - run: npm run build
      - run: npm run test:http
      - run: npm audit --omit=dev --audit-level=high
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 객체·스키마·속성의 값을 지정한다: name: Next.js 학습 검증 |
| 2 | 객체·스키마·속성의 값을 지정한다: on: |
| 3 | 객체·스키마·속성의 값을 지정한다: push: |
| 4 | 객체·스키마·속성의 값을 지정한다: branches: [master, main] |
| 5 | 객체·스키마·속성의 값을 지정한다: pull_request: |
| 6 | 객체·스키마·속성의 값을 지정한다: workflow_dispatch: |
| 7 | 객체·스키마·속성의 값을 지정한다: permissions: |
| 8 | 객체·스키마·속성의 값을 지정한다: contents: read |
| 9 | 객체·스키마·속성의 값을 지정한다: jobs: |
| 10 | 객체·스키마·속성의 값을 지정한다: app: |
| 11 | 객체·스키마·속성의 값을 지정한다: runs-on: ubuntu-latest |
| 12 | 객체·스키마·속성의 값을 지정한다: strategy: |
| 13 | 객체·스키마·속성의 값을 지정한다: matrix: |
| 14 | 객체·스키마·속성의 값을 지정한다: directory: [tsx_version/demo, jsx_version/demo, tsx_version/project, jsx_version/project] |
| 15 | 객체·스키마·속성의 값을 지정한다: defaults: |
| 16 | 객체·스키마·속성의 값을 지정한다: run: |
| 17 | 객체·스키마·속성의 값을 지정한다: working-directory: ${{ matrix.directory }} |
| 18 | 객체·스키마·속성의 값을 지정한다: steps: |
| 19 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: - uses: actions/checkout@v4 |
| 20 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: - uses: actions/setup-node@v4 |
| 21 | 객체·스키마·속성의 값을 지정한다: with: |
| 22 | 객체·스키마·속성의 값을 지정한다: node-version: 24.14.0 |
| 23 | 객체·스키마·속성의 값을 지정한다: cache: npm |
| 24 | 객체·스키마·속성의 값을 지정한다: cache-dependency-path: ${{ matrix.directory }}/package-lock.json |
| 25 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: - run: npm ci |
| 26 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: - run: npm run lint |
| 27 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: - run: npm test |
| 28 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: - run: node scripts/storage-check.mjs |
| 29 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: - run: npm run build |
| 30 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: - run: npm run test:http |
| 31 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: - run: npm audit --omit=dev --audit-level=high |

### .github/workflows/deploy.yml

[실행 파일](.github/workflows/deploy.yml)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:.github/workflows/deploy.yml sha256:6fbfe0c404ee27d0d601d42481854cc0b085171cefb1b0c72ba4b3254c21cadc -->
~~~yaml
name: Next.js 수동 배포
on:
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: production
  cancel-in-progress: false
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24.14.0
      - run: npm ci && npm test && npm run build
        working-directory: tsx_version/project
      - name: Docker 이미지 생성
        run: docker build -t next-study:${{ github.sha }} tsx_version/project
      - name: 서버 신원 확인 및 배포
        env:
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
          DEPLOY_USER: ${{ secrets.DEPLOY_USER }}
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
          DEPLOY_KNOWN_HOSTS: ${{ secrets.DEPLOY_KNOWN_HOSTS }}
        run: |
          test -n "$DEPLOY_HOST" && test -n "$DEPLOY_USER" && test -n "$DEPLOY_KEY" && test -n "$DEPLOY_KNOWN_HOSTS"
          install -m 700 -d ~/.ssh
          printf '%s\n' "$DEPLOY_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > ~/.ssh/known_hosts
          docker save next-study:${{ github.sha }} | ssh "$DEPLOY_USER@$DEPLOY_HOST" 'docker load'
          ssh "$DEPLOY_USER@$DEPLOY_HOST" 'cd /opt/next-study && ./deploy.sh' -- '${{ github.sha }}'
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 객체·스키마·속성의 값을 지정한다: name: Next.js 수동 배포 |
| 2 | 객체·스키마·속성의 값을 지정한다: on: |
| 3 | 객체·스키마·속성의 값을 지정한다: workflow_dispatch: |
| 4 | 객체·스키마·속성의 값을 지정한다: permissions: |
| 5 | 객체·스키마·속성의 값을 지정한다: contents: read |
| 6 | 객체·스키마·속성의 값을 지정한다: concurrency: |
| 7 | 객체·스키마·속성의 값을 지정한다: group: production |
| 8 | 객체·스키마·속성의 값을 지정한다: cancel-in-progress: false |
| 9 | 객체·스키마·속성의 값을 지정한다: jobs: |
| 10 | 객체·스키마·속성의 값을 지정한다: deploy: |
| 11 | 객체·스키마·속성의 값을 지정한다: runs-on: ubuntu-latest |
| 12 | 객체·스키마·속성의 값을 지정한다: environment: production |
| 13 | 객체·스키마·속성의 값을 지정한다: steps: |
| 14 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: - uses: actions/checkout@v4 |
| 15 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: - uses: actions/setup-node@v4 |
| 16 | 객체·스키마·속성의 값을 지정한다: with: |
| 17 | 객체·스키마·속성의 값을 지정한다: node-version: 24.14.0 |
| 18 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: - run: npm ci && npm test && npm run build |
| 19 | 객체·스키마·속성의 값을 지정한다: working-directory: tsx_version/project |
| 20 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: - name: Docker 이미지 생성 |
| 21 | 객체·스키마·속성의 값을 지정한다: run: docker build -t next-study:${{ github.sha }} tsx_version/project |
| 22 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: - name: 서버 신원 확인 및 배포 |
| 23 | 객체·스키마·속성의 값을 지정한다: env: |
| 24 | 객체·스키마·속성의 값을 지정한다: DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }} |
| 25 | 객체·스키마·속성의 값을 지정한다: DEPLOY_USER: ${{ secrets.DEPLOY_USER }} |
| 26 | 객체·스키마·속성의 값을 지정한다: DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }} |
| 27 | 객체·스키마·속성의 값을 지정한다: DEPLOY_KNOWN_HOSTS: ${{ secrets.DEPLOY_KNOWN_HOSTS }} |
| 28 | 객체·스키마·속성의 값을 지정한다: run: \| |
| 29 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: test -n "$DEPLOY_HOST" && test -n "$DEPLOY_USER" && test -n "$DEPLOY_KEY" && test -n "$DEPLOY_KNOWN_HOSTS" |
| 30 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: install -m 700 -d ~/.ssh |
| 31 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: printf '%s\n' "$DEPLOY_KEY" > ~/.ssh/id_ed25519 |
| 32 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: chmod 600 ~/.ssh/id_ed25519 |
| 33 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > ~/.ssh/known_hosts |
| 34 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: docker save next-study:${{ github.sha }} \| ssh "$DEPLOY_USER@$DEPLOY_HOST" 'docker load' |
| 35 | 컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: ssh "$DEPLOY_USER@$DEPLOY_HOST" 'cd /opt/next-study && ./deploy.sh' -- '${{ github.sha }}' |

### deploy/deploy.sh

[실행 파일](deploy/deploy.sh)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:deploy/deploy.sh sha256:a3513bbdd6f4d8c82a68efee1da174373b728ca19aa9f856859ac3965be65f63 -->
~~~sh
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
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 현재 구문에서 다음 값·인자·표현식을 연결한다: #!/bin/sh |
| 2 | 현재 구문에서 다음 값·인자·표현식을 연결한다: set -eu |
| 3 | 현재 구문에서 다음 값·인자·표현식을 연결한다: cd /opt/next-study |
| 4 | 현재 구문에서 다음 값·인자·표현식을 연결한다: image="next-study:$1" |
| 5 | 현재 구문에서 다음 값·인자·표현식을 연결한다: docker image inspect "$image" >/dev/null |
| 6 | 현재 구문에서 다음 값·인자·표현식을 연결한다: # .env.production과 data 디렉터리는 서버에서만 관리한다. |
| 7 | 현재 구문에서 다음 값·인자·표현식을 연결한다: previous=$(docker inspect --format '{{.Config.Image}}' next-study 2>/dev/null \|\| true) |
| 8 | 현재 구문에서 다음 값·인자·표현식을 연결한다: docker stop next-study 2>/dev/null \|\| true |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: docker rm next-study 2>/dev/null \|\| true |
| 10 | 현재 구문에서 다음 값·인자·표현식을 연결한다: docker run -d --name next-study --restart unless-stopped --env-file .env.production -p 127.0.0.1:3000:3000 -v next-study-data:/app/data "$image" |
| 11 | 현재 구문에서 다음 값·인자·표현식을 연결한다: healthy=false |
| 12 | 배열·반복 요청·스트림을 순서대로 처리하며 종료 조건을 확인한다. |
| 13 | 현재 구문에서 다음 값·인자·표현식을 연결한다: if curl -fsS http://127.0.0.1:3000/health >/dev/null; then healthy=true; break; fi |
| 14 | 현재 구문에서 다음 값·인자·표현식을 연결한다: sleep 2 |
| 15 | 현재 구문에서 다음 값·인자·표현식을 연결한다: done |
| 16 | 현재 구문에서 다음 값·인자·표현식을 연결한다: if [ "$healthy" = false ]; then |
| 17 | 현재 구문에서 다음 값·인자·표현식을 연결한다: docker logs --tail 100 next-study |
| 18 | 현재 구문에서 다음 값·인자·표현식을 연결한다: docker stop next-study |
| 19 | 현재 구문에서 다음 값·인자·표현식을 연결한다: docker rm next-study |
| 20 | 현재 구문에서 다음 값·인자·표현식을 연결한다: if [ -n "$previous" ]; then docker run -d --name next-study --restart unless-stopped --env-file .env.production -p 127.0.0.1:3000:3000 -v next-study-data:/app/data "$previous"; fi |
| 21 | 현재 구문에서 다음 값·인자·표현식을 연결한다: exit 1 |
| 22 | 현재 구문에서 다음 값·인자·표현식을 연결한다: fi |

### tsx_version/project/scripts/backup.mjs

[실행 파일](tsx_version/project/scripts/backup.mjs)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/scripts/backup.mjs sha256:c5815544c0a8a760eace719bfe43a46d433ed4e458e612a267cdd54845430f2e -->
~~~ts
import { DatabaseSync, backup } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
if ((process.env.DB_DRIVER ?? "sqlite") !== "sqlite")
  throw new Error("서버 DB는 study16의 DB별 백업 명령을 사용하세요.");
const source = path.resolve(process.env.COURSE_DB_PATH ?? "data/course.db");
if (!fs.existsSync(source)) throw new Error("DB를 먼저 실행하세요.");
const target = path.resolve("backups", `course-${Date.now()}.db`);
fs.mkdirSync(path.dirname(target), { recursive: true });
const db = new DatabaseSync(source);
try {
  await backup(db, target);
  console.log(`백업 완료: ${target}`);
} finally {
  db.close();
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { DatabaseSync, backup } from "node:sqlite"; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: fs from "node:fs"; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: path from "node:path"; |
| 4 | 입력·상태 조건에 따라 처리 경로를 고른다: if ((process.env.DB_DRIVER ?? "sqlite") !== "sqlite") |
| 5 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: throw new Error("서버 DB는 study16의 DB별 백업 명령을 사용하세요."); |
| 6 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const source = path.resolve(process.env.COURSE_DB_PATH ?? "data/course.db"); |
| 7 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: if (!fs.existsSync(source)) throw new Error("DB를 먼저 실행하세요."); |
| 8 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const target = path.resolve("backups", ˋcourse-${Date.now()}.dbˋ); |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: fs.mkdirSync(path.dirname(target), { recursive: true }); |
| 10 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const db = new DatabaseSync(source); |
| 11 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 12 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await backup(db, target); |
| 13 | 현재 구문에서 다음 값·인자·표현식을 연결한다: console.log(ˋ백업 완료: ${target}ˋ); |
| 14 | 성공·실패에 관계없이 잠금·연결·mock을 정리한다. |
| 15 | 현재 구문에서 다음 값·인자·표현식을 연결한다: db.close(); |
| 16 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/project/scripts/storage-check.mjs

[실행 파일](tsx_version/project/scripts/storage-check.mjs)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/scripts/storage-check.mjs sha256:7b6a78870abbdea0d5676ce45ab73253992a90806daa7dbf9330683cae60f0cc -->
~~~ts
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
const id = crypto.randomUUID(), source = `data/storage-${id}.db`, target = `data/import-${id}.db`, snapshot = `backups/state-${id}.json`;
mkdirSync('data', { recursive: true }); mkdirSync('backups', { recursive: true });
const state = { seq: 1, users: [{ id: 1, email: 'backup@example.com', nickname: '백업 검증', passwordHash: 'test-only' }], posts: [], comments: [], files: [], jobs: [], revoked: [], webhookIds: [] };
const database = new DatabaseSync(source);
database.exec('CREATE TABLE course_state (id INTEGER PRIMARY KEY, data TEXT NOT NULL)');
database.prepare('INSERT INTO course_state VALUES (1, ?)').run(JSON.stringify(state)); database.close();
function run(args, dbPath) {
  const result = spawnSync(process.execPath, args, { env: { ...process.env, DB_DRIVER: 'sqlite', COURSE_DB_PATH: dbPath }, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr); return result.stdout;
}
const backupOutput = run(['scripts/backup.mjs'], source), backupPath = backupOutput.split('백업 완료: ')[1].trim();
function read(file) { const db = new DatabaseSync(file); try { return JSON.parse(db.prepare('SELECT data FROM course_state WHERE id=1').get().data); } finally { db.close(); } }
assert.deepEqual(read(backupPath), state);
const migration = existsSync('scripts/migrate-state.ts') ? 'scripts/migrate-state.ts' : 'scripts/migrate-state.js';
run(['--import', 'tsx', migration, 'export', snapshot], source);
run(['--import', 'tsx', migration, 'import', snapshot], target);
assert.deepEqual(read(target), state);
console.log('PASS: SQLite 온라인 백업 내용 일치 · 스냅샷 export/import 후 데이터 일치');
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: assert from 'node:assert/strict'; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { DatabaseSync } from 'node:sqlite'; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: { spawnSync } from 'node:child_process'; |
| 4 | 외부 모듈 또는 공용 함수·타입을 가져온다: { mkdirSync, existsSync } from 'node:fs'; |
| 5 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const id = crypto.randomUUID(), source = ˋdata/storage-${id}.dbˋ, target = ˋdata/import-${id}.dbˋ, snapshot = ˋbackups/state-${id}.jsonˋ; |
| 6 | 현재 구문에서 다음 값·인자·표현식을 연결한다: mkdirSync('data', { recursive: true }); mkdirSync('backups', { recursive: true }); |
| 7 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const state = { seq: 1, users: [{ id: 1, email: 'backup@example.com', nickname: '백업 검증', passwordHash: 'test-only' }], posts: [], comments: [], files: [], jobs: [], revoked: [], webhookIds: [] }; |
| 8 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const database = new DatabaseSync(source); |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: database.exec('CREATE TABLE course_state (id INTEGER PRIMARY KEY, data TEXT NOT NULL)'); |
| 10 | DB 명령을 준비하거나 실행한다. 값은 자리표시자에 별도로 바인딩한다: database.prepare('INSERT INTO course_state VALUES (1, ?)').run(JSON.stringify(state)); database.close(); |
| 11 | run의 입력·반환 경계를 정의한다. |
| 12 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const result = spawnSync(process.execPath, args, { env: { ...process.env, DB_DRIVER: 'sqlite', COURSE_DB_PATH: dbPath }, encoding: 'utf8', windowsHide: true }); |
| 13 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(result.status, 0, result.stderr); return result.stdout; |
| 14 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 15 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const backupOutput = run(['scripts/backup.mjs'], source), backupPath = backupOutput.split('백업 완료: ')[1].trim(); |
| 16 | read의 입력·반환 경계를 정의한다. |
| 17 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.deepEqual(read(backupPath), state); |
| 18 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const migration = existsSync('scripts/migrate-state.ts') ? 'scripts/migrate-state.ts' : 'scripts/migrate-state.js'; |
| 19 | 현재 구문에서 다음 값·인자·표현식을 연결한다: run(['--import', 'tsx', migration, 'export', snapshot], source); |
| 20 | 현재 구문에서 다음 값·인자·표현식을 연결한다: run(['--import', 'tsx', migration, 'import', snapshot], target); |
| 21 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.deepEqual(read(target), state); |
| 22 | 현재 구문에서 다음 값·인자·표현식을 연결한다: console.log('PASS: SQLite 온라인 백업 내용 일치 · 스냅샷 export/import 후 데이터 일치'); |

## ④ 🔗 연동 포인트

웹·워커·백업은 같은 DB 연결을 사용한다. CI의 계약 검증이 배포 전 경계를 지키고 운영 requestId는 사용자 신고와 서버 로그를 연결한다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| Docker named pipe 없음 | Docker Desktop Linux 엔진 미실행 | 엔진 시작 후 docker info 확인 |
| SSH host key 실패 | 서버 지문 미등록·변경 | 관리자가 지문 확인 후 known_hosts 갱신 |
| 배포 후 health 실패 | 환경·볼륨·DB 연결 | 로그 확인·이전 이미지 롤백 |

## ⑥ 직접 해보기

1. 빈 환경에 백업을 복원해 글·댓글 수를 대조한다.
2. 잘못된 DB URL로 health 실패를 발생시키고 로그를 확인한다.
3. CI 실행 결과와 배포 workflow의 필요한 secrets를 기록한다.

## ⑦ ☐ 체크리스트

- [ ] Docker·CI·배포·로그·모니터링·백업 절차를 작성했다.
- [ ] 원격 실행에 필요한 계정 설정을 구분한다.
- [ ] 실제 복원 검증 전에는 운영 완료로 표시하지 않는다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study17](study17.md)에서 SSE 작업 알림과 선택적 WebSocket을 인증 경계 안에서 연결한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
