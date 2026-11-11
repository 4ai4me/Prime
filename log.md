# 작업 기록 (log.md)

## 2026-11-11 — 중1 소인수분해 사이트 큰 틀 만들기 (Tier 3)

**시작**
- Tier: 3 (새 사이트 + Func·Props와 함께 쓰는 Firebase 보안 규칙에 Prime 칸 추가)
- 목표: 고등 함수 사이트(Func)와 같은 구조로 중1 「Ⅰ. 소인수분해」 사이트의 틀을 만든다. 차시 내용은 자료를 받는 대로 채운다.
- 선생님이 정한 것: 6차시(소단원 1개 = 1차시, 놀이·블록 코딩 활동은 2·4차시 안의 단계), 로그인·교사 화면은 Func와 똑같이, 저장소 `4ai4me/Prime`
- 완료 기준: 중단원 3개 아래 1~6차시 탭, 탭을 누르면 차시 제목과 "자료 준비 중" 화면, 휴대폰 폭에서 넘치지 않음, Func·Props 학생 기록과 잠금 설정은 건드리지 않음
- 회귀 위험: 함께 쓰는 가입 문서·비밀번호·보안 규칙(Func·Props)

**완료**
- 만든 것
  - Func에서 그대로 가져옴: 가입·로그인(AuthGateView, 문구만 중1용), 비밀번호, 기기 식별, 접속 기록, 반별 잠금 패널, 저장 버튼, 성찰 선택, 글자 수 표시, 수학 기호 입력기(기호를 중1용으로 줄임), 차시 문서 저장(lessonStore — 칸 이름만 `prime_lessons`)
  - 새로 만듦: `lessons/curriculum.ts`(단원 구성), `lessons/index.tsx`(차시 연결표), `LessonPlaceholderView`, 공용 `ReflectionStep`, `answerLabels.ts`, `utils/lessonAccess.ts`(6차시 잠금), `utils/studentRecord.ts`(기록 형식·평가), `utils/teacherRecords.ts`(교사 표·CSV), `App.tsx`(Func 흐름을 6차시용으로 일반화), `TeacherView.tsx`(잠금·승인·접속 기록은 Func 화면 그대로, 학생 기록 표·답안·평가는 차시 내용과 상관없이 동작하게 새로 만듦), `StudentEvaluationModal`(단순화)
  - `firestore.rules`: Func 규칙에 Prime 부분만 **추가** — `prime_lessons` 허용, 교사 전체 조회, `app_settings/prime_lesson_access`(l1~l6)·`prime_lesson_access_classes`
- 판단해서 정한 것
  - 가입 문서는 Func·Props와 공유(이미 승인된 학생은 다시 가입 안 함). 새로 가입하는 학생의 `worksheetJson`에는 답안 없이 작은 표시만 넣음(규칙상 필수 칸)
  - 자료 준비 중 차시는 입력 칸이 없어 학생 기록이 생기지 않음. 단계 이동 버튼도 숨김
  - 서버 잠금 문서가 없을 때 기본값은 Func와 같이 "모두 열림"(교사가 처음 들어오면 서버에 기록)
  - 교사 화면에서 빠진 Func 기능: 예시 학생 데이터, JSON 파일 불러오기, AI 피드백 초안, 학급 분석 대시보드(차시 내용이 생기면 필요한 것만 다시 붙임)
  - 처음 열 때 이미 열린 차시로 바뀐 경우에도 주소의 잠긴 `?lesson=` 번호를 고치도록 보완(Func에는 남아 있던 작은 빈틈)
  - 휴대폰 폭에서 맨 위 막대가 넘쳐 [로그아웃 / 모드 전환]을 좁은 화면에서는 [로그아웃]으로 줄임
- 확인한 것
  - `npx tsc --noEmit` 통과, 단위 테스트 52/52 (`npx tsx --test src/**/*.test.ts src/**/*.test.tsx`) — 단원 구성, 저장 칸 분리, 보안 규칙에 Prime 칸 포함·Func 칸 유지, 잠금 계산, 준비 중 화면에 입력 칸 없음, 평가 진행, CSV 수식 막기 포함
  - `npm run build` 통과
  - 검사 환경(저장소 밖 `/home/claude/harness`: 실제 앱 코드 + 탭끼리 공유하는 가짜 Firebase)에서 Chrome 27/27: 가입 신청 → 교사 승인 → 학생 자동 입장, 중단원 3묶음·탭 6개, 준비 중 화면(4차시 블록 코딩 표시), 교사 "1~2차시 열기" → 학생 3~6차시 잠김(새로고침 없이)·보던 차시 이동, `?lesson=5` 차단, 반별 1~4차시 → 그 반 학생만 5·6차시 잠김, 교사 평정·피드백 → `prime_lessons/teacher` 저장 → 학생 평가 결과 창 표시, Func 기록·잠금 문서 변경 없음, 반별 저장 실패 시 이유 표시, 390px 학생·교사 가로 넘침 0, 페이지 오류 0(외부 글꼴은 작업 환경 인터넷 차단으로 못 받음)
- 확인하지 못한 것
  - 실제 Firebase에서 보안 규칙 동작(규칙 게시 전), 배포된 사이트, 패드 터치
  - 학생 답안 저장(`prime_lessons/l1~l6`): 아직 입력 칸이 있는 차시가 없어 화면으로는 확인 못 함(저장 코드는 Func와 같고 단위 테스트로 차시 분리·변경 감지 확인)
- 남은 위험·후속 작업
  - **규칙 게시 필요**: 게시 전에는 Prime 잠금 저장·학생 답안 저장이 거부됨
  - Func·Props 저장소의 `firestore.rules`에도 같은 추가분을 넣어야 함 — 안 넣은 채 그쪽 파일로 다시 게시하면 Prime 칸 규칙이 사라짐
  - 교사 기록 표에 Func·Props의 승인된 고등학생도 함께 보임(가입 문서 공유) → 학급 거르기로 구분
- 다음 세션 인계: 교과서 자료를 받으면 1차시부터 `AGENTS.md`의 「차시 자료 채우는 순서」대로 채움
- 올리기(2026-11-11 14:3x): 선생님이 만든 빈 저장소 `4ai4me/Prime`에 main을 올림(`304aa2c`, 작성자 liha4math). GitHub Pages 설정·배포된 화면은 작업 환경에서 확인할 수 없음(GitHub API 막힘) — 선생님이 Pages 켜고 확인
