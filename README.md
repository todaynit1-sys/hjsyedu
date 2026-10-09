# HJSY AI edu — 현준선영의 AI 교실

강사와 수강생이 채팅·링크를 실시간으로 나누는 독립 Next.js 프로젝트입니다. 사이트에 접속하면 코드 입력 없이 기본 강의실의 채팅·투표가 바로 열립니다. 수강생은 로그인 없이 참여하며 하루 동안 같은 브라우저에 같은 익명 번호를 부여합니다. 기본 화면은 화이트·차콜·인디고의 기업 교육 스타일이며, HJ/SY 글자형 로고를 사용합니다. 기존 캐릭터 파일은 별도 브랜드 자료로 보관합니다.

## 실행

Node.js 24에서 이 폴더를 열고 실행합니다.

```sh
npm ci
npm run setup:local
npm run dev
```

- 홈: http://localhost:3010
- 기본 강의실: `HJSYAI` (최초 접속 시 한 번 생성, 같은 날 기록 유지, 다음 날 초기화)
- 별도 강의실 코드 입력: http://localhost:3010/join
- 수강생 미리보기: http://localhost:3010/room/DEMO26
- 강사: http://localhost:3010/host
- 강사 기본 접속 코드: 요청한 코드가 서버에 반영되어 있음 (`HOST_PASSWORD`로 변경 가능)
- 로컬 데이터: `.local/class-board.sqlite` (Git 제외, 서버 재시작 후에도 보존)

## 강의에서 사용하기

1. 홈페이지의 ‘강사 관리’ 버튼으로 로그인하면 기본 강의실 관리 화면이 바로 열립니다. 강의실 목록에서 별도 강의실을 만들 수도 있습니다.
2. ‘참여 링크’에서 링크 또는 QR코드를 공유합니다. 수강생은 계정 없이 참여합니다.
3. 채팅 입력창에서 메시지를 보내거나 ‘링크 첨부’로 자료를 공유합니다. Enter는 전송, Shift+Enter는 줄바꿈입니다. 한글 조합 중 Enter는 전송하지 않습니다. 강사는 메시지 메뉴에서 고정·삭제할 수 있습니다.
4. 컨디션과 휴식 요청의 인원·비율이 약 2초마다 갱신됩니다. ‘다시 물어보기’는 새 투표를 만들고 이전 결과를 보존합니다.
5. 투표 영역의 ‘새 투표 만들기’를 열어 응답 항목을 한 줄씩 2~5개 입력합니다. 이전 결과는 강의실 설정에서 볼 수 있습니다.
6. 강의실 설정의 ‘오늘 강의 종료’ 후에는 새 채팅·투표 응답을 막고 기존 기록을 보여줍니다. 강사가 다시 시작할 수도 있습니다.
7. 같은 참여 링크를 다음 날 열면 한국 시간 기준 새 날짜의 기록과 기본 투표가 생성됩니다. 한국 시간 자정부터 전날 채팅·투표·참여자 번호는 조회할 수 없으며, 첫 요청에서 저장 데이터도 새 날짜로 교체합니다.

이름은 수집하지 않습니다. 중복 응답 방지는 서명된 브라우저 쿠키 기준이며, 다른 브라우저·시크릿 창·쿠키 삭제까지 동일한 사람으로 식별하지는 않습니다. 접속 수는 최근 45초 이내에 신호를 보낸 수강생 브라우저 수이고, 탭 여러 개는 하나로 집계합니다. 강사는 접속 수에서 제외됩니다. 숨겨진 탭·절전·네트워크 지연은 집계에 영향을 줄 수 있습니다.

## GitHub · Vercel 배포

Supabase 설정은 필요하지 않습니다. 강사 접속 코드는 서버에 반영되어 있습니다. 학생은 홈페이지에서 바로 채팅·투표에 참여합니다.

1. GitHub 저장소를 Vercel에서 Import합니다. Node.js 24, Next.js, 빌드 `npm run build`, 설치 `npm ci`를 사용합니다.
2. Vercel의 hjsyedu 프로젝트 → Storage → Create Database → Blob에서 **Private** 저장소를 만들고 이 프로젝트에 연결합니다. 지역은 서울(icn1)을 권장합니다.
3. 연결하면 서버 전용 `BLOB_READ_WRITE_TOKEN` 환경변수가 자동 등록됩니다. Production에 연결한 후 Redeploy합니다. `LOCAL_PREVIEW`는 Vercel에 등록하지 않습니다.
4. 강사는 홈페이지 ‘강사 관리’ 또는 `/host?room=HJSYAI`에서 접속 코드를 입력합니다. 기본 강의실 공유 링크는 홈페이지 `/`이며, 첨부된 참여 QR 원본은 `public/branding/participation-qr.png`에 보관합니다.

| 환경변수 | 값 |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | 비공개 Blob 연결 시 자동 등록되는 서버 전용 토큰 |
| `HOST_PASSWORD` | 선택: 기본 강사 코드를 변경할 때만 지정 |
| `SESSION_SECRET` | 선택: 별도 세션 서명 키, 32자 이상. 생략 시 Blob 토큰으로 서명 |
| `SITE_URL` | 선택: 공유 이미지의 기준 공개 주소 |

토큰은 서버에서만 사용하고 브라우저에 전달하지 않습니다. 비공개 파일은 서버 API를 통해 집계·메시지만 제공합니다. 익명 쿠키 식별자·참여자 매핑·투표 원본은 반환하지 않습니다. 인증 쿠키는 HttpOnly이며, 강사 권한은 서버에서 확인합니다. 클라이언트 소스맵은 생성하지 않습니다.

날짜가 바뀌면 전날 메시지, 링크, 투표 결과, 접속 수와 익명 번호를 삭제하고 기본 투표 두 개로 시작합니다. 동일 날짜의 ‘다시 물어보기’ 결과는 그날까지만 남습니다. 서버 GET과 모든 변경 요청에서 날짜를 확인하고 오래된 데이터를 교체합니다. 켜 둔 화면도 새 날짜로 자동 전환합니다. 미접속 강의실은 하루 한 번 Vercel Cron으로 정리합니다(UTC 15:00 = 한국 자정). Hobby Cron 실행은 최대 약 1시간 늦을 수 있으나, 앱에서는 한국 자정부터 전날 데이터가 노출되지 않습니다.

방 하나를 비공개 JSON으로 저장하며 원본 최신 읽기(`useCache: false`)와 ETag 조건부 쓰기(`ifMatch`)로 동시 응답 덮어쓰기를 방지합니다. 변경 충돌은 다시 읽고 재시도합니다. 모든 방문자가 같은 Vercel 저장소를 공유합니다. 임시 서버 메모리나 배포 파일에 채팅을 저장하지 않습니다.

현재 구조는 소규모 강의용입니다. 화면은 2초마다 조회하며 서버는 같은 강의실 조회를 최대 2초간 공유합니다. 접속 신호는 서버 인스턴스별로 30초 동안 모아서 저장하고 채팅·투표 변경은 바로 저장합니다. 접속 수는 여러 서버를 거치면 최대 약 30초 늦게 반영될 수 있습니다. 조회·저장은 Vercel/Blob 사용량에 포함됩니다. Hobby Blob 한도는 월 조회 10,000회, 쓰기/목록 2,000회입니다. Hobby 무료 한도를 초과하면 서비스가 제한될 수 있습니다. 대규모 상시 사용에는 이벤트 기반 전달과 전용 실시간 저장소가 적합합니다.

공식 문서: [비공개 Blob](https://vercel.com/docs/vercel-blob/private-storage), [최신 읽기](https://vercel.com/changelog/vercel-blob-now-supports-consistent-reads-on-private-storage), [Blob 사용량](https://vercel.com/docs/vercel-blob/usage-and-pricing), [Cron 제한](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## 확인

```sh
npm run typecheck
npm test
node scripts/verify-blob-store.mjs
npm run build
npm run start
```

`scripts/verify-browser.cjs`는 Playwright가 있는 환경에서 별도 강사·수강생 컨텍스트로 권한, 양방향 채팅, 한글 조합 Enter, 동시 투표, QR 공유, 키보드와 1440×900/390×844/320×568px 첫 화면 배치를 확인합니다. `PLAYWRIGHT_MODULE`과 필요하면 `BROWSER_EXECUTABLE`을 환경에 지정해서 실행할 수 있습니다. 검증용 강의실은 로컬 DB에 만들어지며 검증 결과와 화면은 `.local/`에 보관합니다. 실제 Vercel Blob 배포 검증은 연결 후 별도로 해야 합니다.

Pretendard 글꼴 라이선스는 `public/fonts/Pretendard-LICENSE.txt`에 보관합니다.
