# HJSY AI edu — 현준선영의 AI 교실

강사와 수강생이 채팅·링크를 실시간으로 나누는 독립 Next.js 프로젝트입니다. 같은 화면에서 컨디션·휴식 투표와 사용자 지정 질문을 날짜별로 집계합니다. 수강생은 로그인 없이 참여하며 하루 동안 같은 브라우저에 같은 익명 번호를 부여합니다. HJ 곰과 SY 토끼를 브랜드 캐릭터로 사용합니다.

## 실행

Node.js 24에서 이 폴더를 열고 실행합니다.

```sh
npm ci
npm run setup:local
npm run dev
```

- 홈: http://localhost:3010
- 수강생 미리보기: http://localhost:3010/room/DEMO26
- 강사: http://localhost:3010/host
- 최초 강사 비밀번호: `.local/host-password.txt` (자동 생성, Git 제외)
- 로컬 데이터: `.local/class-board.sqlite` (Git 제외, 서버 재시작 후에도 보존)

## 강의에서 사용하기

1. 강사 공간에 로그인하고 새 강의실을 만듭니다.
2. ‘참여 링크’에서 링크 또는 QR코드를 공유합니다. 수강생은 계정 없이 참여합니다.
3. 채팅 입력창에서 메시지를 보내거나 ‘링크 첨부’로 자료를 공유합니다. Enter는 전송, Shift+Enter는 줄바꿈입니다. 한글 조합 중 Enter는 전송하지 않습니다. 강사는 메시지 메뉴에서 고정·삭제할 수 있습니다.
4. 컨디션과 휴식 요청의 인원·비율이 약 2초마다 갱신됩니다. ‘다시 물어보기’는 새 투표를 만들고 이전 결과를 보존합니다.
5. 투표 영역의 ‘새 투표 만들기’를 열어 응답 항목을 한 줄씩 2~5개 입력합니다. 이전 결과는 강의실 설정에서 볼 수 있습니다.
6. 강의실 설정의 ‘오늘 강의 종료’ 후에는 새 채팅·투표 응답을 막고 기존 기록을 보여줍니다. 강사가 다시 시작할 수도 있습니다.
7. 같은 참여 링크를 다음 날 열면 한국 시간 기준 새 날짜의 기록과 기본 투표가 생성됩니다. 날짜 선택으로 이전 강의를 볼 수 있습니다.

이름은 수집하지 않습니다. 중복 응답 방지는 서명된 브라우저 쿠키 기준이며, 다른 브라우저·시크릿 창·쿠키 삭제까지 동일한 사람으로 식별하지는 않습니다. 접속 수는 최근 45초 이내에 신호를 보낸 수강생 브라우저 수이고, 탭 여러 개는 하나로 집계합니다. 강사는 접속 수에서 제외됩니다. 숨겨진 탭·절전·네트워크 지연은 집계에 영향을 줄 수 있습니다.

## GitHub · Vercel 배포

로컬 설정 없이 공개 배포하면 저장소 연결 안내가 나타납니다. Vercel의 임시 파일시스템에 강의 데이터를 저장하지 않도록 서버에서 차단합니다.

1. Supabase 프로젝트의 SQL Editor에서 `database/setup.sql`을 실행합니다. 강의용 테이블 하나만 추가하며 다른 테이블은 수정하지 않습니다.
2. Supabase의 프로젝트 URL과 **서버 전용 Secret Key**를 준비합니다. Legacy `service_role` 키도 지원합니다. Publishable/anon 키로 이 서버 저장소를 연결하지 마세요.
3. GitHub에 이 `class-board` 폴더의 내용을 새 저장소로 올립니다. `.env.local`, `.local`, `node_modules`, `.next`는 올리지 않습니다.
4. Vercel에서 그 저장소를 Import합니다. 저장소 루트에 이 프로젝트가 있다면 Root Directory는 비워둡니다. 상위 저장소에 폴더로 올렸다면 Root Directory를 `class-board`로 지정합니다.
5. Node.js 24와 Next.js 프레임워크를 사용합니다. 빌드 명령은 `npm run build`, 설치 명령은 `npm ci`입니다. 정적 export나 `dist` 출력 경로는 지정하지 않습니다.
6. 아래 환경변수를 Vercel의 Production·Preview에 등록하고 배포합니다. **LOCAL_PREVIEW는 등록하지 않습니다.**

| 환경변수 | 값 |
|---|---|
| `HOST_PASSWORD` | 새 강사 비밀번호, 12자 이상 |
| `SESSION_SECRET` | 무작위 문자열, 32자 이상 |
| `SUPABASE_URL` | `https://프로젝트ID.supabase.co` |
| `SUPABASE_SECRET_KEY` | 서버용 Secret Key 또는 legacy service_role 키 |
| `SITE_URL` | 선택 사항: 공유 이미지의 기준 공개 주소. 생략하면 Vercel 도메인 사용 |

`SESSION_SECRET`은 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`로 만들 수 있습니다. 실제 비밀번호와 키는 README·GitHub 소스·NEXT_PUBLIC 환경변수에 넣지 않습니다.

서버가 투표 원본과 익명 쿠키 식별자를 처리하며 브라우저에는 집계·자신의 선택·채팅의 익명 번호를 반환합니다. 쿠키 식별자와 참여자 매핑은 반환하지 않습니다. 메시지 고정·삭제와 투표 관리는 강사만 할 수 있습니다. 수강생은 1분에 최대 10개, 방 전체는 하루에 최대 2,000개의 메시지를 보낼 수 있습니다. Supabase 테이블은 RLS를 켜고 anon/authenticated 접근을 막습니다. 강사 권한은 서버에서 확인하고 인증 쿠키는 HttpOnly입니다. 클라이언트 소스맵은 생성하지 않습니다. 공개 GitHub 저장소의 원본과 브라우저 실행 코드는 볼 수 있으므로 GitHub 공개 범위는 별도로 선택하세요.

현재는 소규모·중간 규모 수업을 위한 초기 구조입니다. 방 하나의 날짜별 기록을 JSON으로 보존하며 동시 응답은 revision 비교 후 재시도로 덮어쓰기를 방지합니다. 대규모 운영에는 날짜별 데이터 분리, 이벤트 기반 실시간 전달, 분산 로그인 시도 제한과 보존 기간 정책을 추가하는 것이 좋습니다. 2초 갱신과 15초 접속 신호가 Vercel·Supabase 요청량에 포함됩니다.

공식 문서: [Vercel Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Supabase API 보안](https://supabase.com/docs/guides/api/securing-your-api).

## 확인

```sh
npm run typecheck
npm test
npm run build
npm run start
```

`scripts/verify-browser.cjs`는 Playwright가 있는 환경에서 별도 강사·수강생 컨텍스트로 권한, 양방향 채팅, 한글 조합 Enter, 동시 투표, QR 공유, 키보드와 1440×900/390×844/320×568px 첫 화면 배치를 확인합니다. `PLAYWRIGHT_MODULE`과 필요하면 `BROWSER_EXECUTABLE`을 환경에 지정해서 실행할 수 있습니다. 검증용 강의실은 로컬 DB에 만들어지며 검증 결과와 화면은 `.local/`에 보관합니다. 실제 Supabase·Vercel 배포 검증은 연결 후 별도로 해야 합니다.

Pretendard 글꼴 라이선스는 `public/fonts/Pretendard-LICENSE.txt`에 보관합니다.
