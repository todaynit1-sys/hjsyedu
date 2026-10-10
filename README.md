# AI전략연구소 · Cloudflare 실시간 강의실

AI전략연구소의 공식 로고를 사용합니다. 상단 소개 아이콘은 https://ailab.hjsy.workers.dev/ 로 연결됩니다.

홈페이지를 열면 기본 강의실의 채팅과 투표가 바로 보입니다. 웹·모바일에서 로그인 없이 참여할 수 있고, 강사는 **강사 관리**에서 접속 코드 **0423**으로 들어갑니다. 현재의 화이트·차콜·인디고 디자인과 HJ/SY 로고를 유지했습니다.

React/Vite 화면과 Cloudflare Worker, SQLite 기반 Durable Object를 한 프로젝트로 배포합니다. Supabase, Vercel Blob, 별도 데이터베이스 계정이나 연결 토큰은 필요 없습니다. 채팅·투표 결과는 WebSocket으로 전달하며, 주기적인 HTTP 조회는 사용하지 않습니다.

## Cloudflare에서 GitHub로 배포

**Workers 프로젝트**로 만드세요. 정적 Pages 프로젝트만 만들면 채팅 서버가 실행되지 않습니다.

1. Cloudflare 대시보드 → Workers & Pages → 새 애플리케이션 생성 → GitHub 저장소 연결.
2. 저장소 `todaynit1-sys/hjsyedu`, 브랜치 `main`을 선택합니다.
3. 아래 설정을 입력하고 배포합니다.

| 항목 | 값 |
| --- | --- |
| 프로젝트/Worker 이름 | `edu` |
| 루트 디렉터리 | 저장소 루트 (빈 값 또는 `/`) |
| 빌드 명령 | `npm run build` |
| 배포 명령 | `npx wrangler deploy` |
| 빌드 환경 변수 | `NODE_VERSION` = `24` |

설치 단계는 잠금 파일의 `npm ci`를 사용합니다. `wrangler.jsonc`에 정적 파일, API 라우팅, Durable Object 연결과 최초 생성 설정이 모두 들어 있습니다. 데이터 저장소를 대시보드에서 따로 만들 필요 없습니다. 별도의 환경 변수나 비밀번호 입력 없이 기본 코드 `0423`을 사용할 수 있습니다.

현재 배포 주소는 `https://edu.hjsy.workers.dev/`입니다. 새 Cloudflare 계정의 서브도메인은 `hjsy`, Worker 이름은 `edu`입니다. `wrangler.jsonc`의 `account_id`는 이 새 계정으로 고정되어 있습니다. 다른 계정에서 배포하려면 해당 계정 ID로 변경하세요. 기존 계정의 강의실 데이터는 새 계정으로 자동 이전되지 않습니다.

공식 안내: [Git 연결](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/), [빌드 설정](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

## 터미널에서 직접 배포

Node.js 24와 npm을 설치한 뒤 저장소 폴더에서 실행합니다.

```sh
npm ci
npx wrangler login
npm run deploy
```

`npm run deploy`는 화면을 빌드한 다음 실제 Cloudflare 계정에 배포합니다. 배포 전 패키지만 확인하려면 아래 dry-run을 사용하세요. dry-run은 실제 서비스를 게시하지 않습니다.

```sh
npm run build
npm run build:worker-test
```

최초 배포 후 `wrangler.jsonc`의 `name`, `class_name`, migration `v1`을 임의로 바꾸지 마세요. 같은 이름으로 재배포하면 기존 강의실과 로그인 서명 키를 이어서 사용합니다.

## 강의할 때

- 수강생: 홈페이지 주소를 열면 기본 채팅과 컨디션·휴식 투표에 바로 참여합니다.
- 강사: 오른쪽 위 **강사 관리** → **0423**. 채팅·링크 공유, 메시지 고정·삭제, 새 투표, 다시 묻기, 강의 종료·재개를 사용할 수 있습니다.
- 공유: **참여 링크**를 누르면 현재 접속한 도메인으로 링크와 QR이 생성됩니다. 별도 강의실은 그 강의실 주소를 공유합니다.
- 별도 수업: 강사 관리의 강의실 목록에서 새 강의실을 만들고 6자리 코드나 참여 링크를 전달합니다.

이전에 제공한 공룡 QR 원본은 `https://hjsyedu.vercel.app/` 주소입니다. 파일은 브랜드 자료로 보관하지만 새 Cloudflare 주소의 공유 창에서는 새 QR을 생성합니다. 배포 후 **QR코드 저장**으로 새 코드를 내려받아 사용하세요.

## 저장·초기화

채팅, 투표, 같은 날의 이전 투표 결과, 익명 수강생 번호는 **한국 시간 오늘 하루**만 보관합니다. 한국 시간 자정에 Durable Object 알람이 전날 데이터를 삭제하고, 접속 중인 화면에 초기화 결과를 전달합니다. 알람이 지연되더라도 다음 조회·전송 시 날짜를 확인해 오래된 데이터를 삭제합니다. 강의실 이름과 참여 코드는 유지됩니다.

접속자 수는 연결된 수강생 브라우저를 기준으로 집계합니다. 같은 브라우저의 여러 탭은 한 명이며, 강사 화면은 수강생 수에 포함하지 않습니다. 응답은 브라우저별 한 표로 집계하고 변경할 수 있습니다. 개인 식별 정보를 요구하지 않으며 다른 브라우저에서는 별도 참여자로 취급됩니다.

강사 세션은 12시간, 익명 참여 쿠키는 30일입니다. 쿠키가 유지되어도 전날 채팅·투표·익명 번호는 남기지 않습니다. 쿠키는 서버 서명과 HttpOnly/SameSite 설정을 사용하고, 서명 키는 서버에서 자동 생성·보관합니다. 관리 동작은 서버에서 권한을 확인합니다.

강의실 최대 100개, 강의실별 하루 메시지 최대 2,000개·투표 최대 50개, 저장 데이터 약 900KB 제한을 둡니다. 한 수강생의 채팅은 분당 10개까지입니다. 50명 동시 접속·투표를 로컬 Cloudflare 런타임에서 검증했습니다.

## 비용

Cloudflare **Workers Free**에서 사용할 수 있는 SQLite Durable Objects로 구성했습니다. 유료 플랜을 켜거나 유료 저장소를 연결할 필요 없습니다. 무료 요청·실행·저장 한도를 넘으면 서비스가 제한될 수 있으며, 50명이라는 접속 인원만으로 월 사용량을 확정할 수는 없습니다. 계정의 플랜과 사용량을 Cloudflare에서 확인하세요.

공식 기준: [Durable Objects 무료 한도](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Workers 한도](https://developers.cloudflare.com/workers/platform/limits/).

## 로컬 실행·검증

```sh
npm ci
npm run dev
```

`http://localhost:3010`에서 실제 Workers 런타임과 로컬 Durable Object를 사용합니다. 빌드 후 서버만 다시 실행하려면 `npm start`를 사용합니다. 화면 파일을 수정했다면 다시 `npm run build`를 실행하세요. 로컬 상태는 `.wrangler/`에 저장되며 운영 데이터와 분리됩니다.

```sh
npm run typecheck
npm test
npm run build
npm run test:worker
```

`test:worker`는 배포 없이 로컬 런타임에서 50명의 WebSocket 연결, 동시 투표, 응답 개인정보 분리, 접속 수, 자동 ping, 실제 알람의 저장 데이터 삭제와 화면 전달, 로그인 유지·권한을 검사합니다. 테스트 전용 RPC는 로컬 테스트 번들에만 추가되며 배포 코드에는 포함하지 않습니다.

`scripts/verify-browser.cjs`는 Playwright로 강사·수강생 화면, 양방향 채팅, 한글 입력, 링크·고정, 투표·이전 결과, QR, 키보드와 1440×900 / 390×844 / 320×568 화면을 확인합니다. 실행 환경에 `PLAYWRIGHT_MODULE`, 필요하면 `BROWSER_EXECUTABLE`을 지정하세요. 검증 결과는 Git에서 제외된 `.local/`에 보관합니다.

강사 코드를 나중에 바꾸려면 `npx wrangler secret put HOST_PASSWORD`를 실행하거나 Cloudflare Worker의 비밀 환경 변수에 `HOST_PASSWORD`를 등록합니다. 기본 코드는 Worker 서버 코드에서만 검사하고 브라우저 번들에는 포함하지 않습니다.
