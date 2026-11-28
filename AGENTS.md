# AGENTS.md

AI 코딩 도구(Claude, Codex, Gemini 등)가 이 저장소에서 작업할 때 따르는 규칙입니다.
사용자의 바이브코딩 표준(VIBE_CODING_STANDARD v2)을 따르며, 아래는 이 저장소에만 있는 규칙입니다.

## 프로젝트 정보

- 무엇: 중학교 1학년 「Ⅰ. 소인수분해」 학생용 탐구 활동지 사이트 (GitHub Pages: `https://4ai4me.github.io/Prime/`)
- 바탕: `4ai4me/Func`(고등 함수 단원) 사이트의 로그인·저장·차시 잠금·교사 화면을 옮겨 옴
- 실행: `npm run dev` / 빌드(배포 파일 갱신): `npm run build` → `ghpages-app.js`·`ghpages-app.css`
- 타입 검사: `npx tsc --noEmit` / 테스트: `npx tsx --test src/**/*.test.ts src/**/*.test.tsx`
- 건드리면 안 되는 것: Func·Props와 함께 쓰는 Firebase 데이터(`student_registrations` 가입 문서, `func_lessons`, `props_lessons`, `app_settings/func_*`, `app_settings/lesson_access`, `app_settings/student_auth`)

## 커밋 작성자

- 이름: `liha4math`
- 이메일: `349883694+liha4math@users.noreply.github.com`

```bash
git config user.name "liha4math"
git config user.email "349883694+liha4math@users.noreply.github.com"
git config user.name && git config user.email   # 위 두 값이 나오는지 확인
```

- 과거 커밋의 작성자는 바꾸지 않습니다(기록 재작성·force push 금지). 개인 Gmail 주소를 커밋에 적지 않습니다.

## 저장 칸 (Func·Props와 분리)

| 무엇 | 위치 |
|---|---|
| 학생 답안 | `student_registrations/{studentKey}/prime_lessons/l1~l6` (차시 번호 = 저장 칸 번호) |
| 교사 평가·메모 | `student_registrations/{studentKey}/prime_lessons/teacher` |
| 전체 차시 잠금 | `app_settings/prime_lesson_access` (l1~l6) |
| 반별 차시 잠금 | `app_settings/prime_lesson_access_classes` |
| 브라우저 보관 키 | `prime_` 으로 시작 |

- 가입 문서(`student_registrations`)·비밀번호 설정·접속 기록은 Func·Props와 **같이** 씁니다. 비밀번호 해시 방식(`passwordCore.ts`)은 바꾸지 않습니다.
- 저장 칸 이름과 형식은 학생 기록·보안 규칙과의 약속입니다. 한 번 학생이 쓰기 시작한 뒤에는 이름을 바꾸거나 옮기지 않습니다(옮기려면 Tier 3로 따로 계획).
- **보안 규칙**: `firestore.rules`는 Func·Props·Prime·Rational이 한 데이터베이스를 쓰므로 네 저장소의 파일이 같아야 합니다. 한쪽을 고치면 나머지 세 저장소에도 똑같이 반영하고, Firebase 콘솔에 게시합니다.

## 차시 자료 채우는 순서

1. `src/lessons/curriculum.ts`에서 그 차시의 `stages`(단계 이름)를 실제 단계로 고치고 `status: 'ready'`로 바꿉니다. 마지막 단계는 `성찰`.
2. `src/utils/studentRecord.ts`의 `LessonNState`에 입력 칸을 추가합니다.
3. `src/lessons/LessonNView.tsx`를 만들고 `src/lessons/index.tsx`의 `READY_LESSONS`에 화면과 `evaluateCompletion`(단계별 완료)을 연결합니다.
4. 마지막 단계는 공용 `ReflectionStep`(성찰 2칸 + 글자 수 + 도움 받은 정도)을 씁니다.
5. 새 입력 칸의 이름표를 `src/lessons/answerLabels.ts`의 `LESSON_FIELD_LABELS`에 추가합니다(교사 [답안 · 평가]와 CSV에 쓰임).
6. 서술 칸(textarea)에는 반드시 `CharCountBadge` + `getCharCountBorderClass`를 붙입니다.
7. 이미지는 `public/assets/lessonN/`에 둡니다.
8. 화면을 바꿔 배포할 때마다 `index.html`의 `?v=` 값을 바꿉니다(캐시에 예전 파일이 남지 않도록).

## 학생 화면 공통 규칙

- 학생 화면의 잠금 판단은 반드시 `effectiveLessonAccess`(반 설정 → 없으면 전체 설정)로 합니다.
- 입력 칸에 예시 답(`placeholder`)을 넣지 않고, 필요하면 `💡 힌트 보기` 토글로 안내합니다.

## 학생 가입·로그인 (2026-11-28~ 가상 정보 방식)

- 학생은 실명·학번·생년월일 없이 **랜덤 이름 · 학년(중1~고3) · 새 이름 반 · 비밀번호**로 가입합니다. 실명이나 학번을 받는 칸, 저장 항목, 로그를 다시 만들지 않습니다.
- 아래 파일은 Func·Props·Prime·Rational **네 저장소에서 똑같아야** 합니다. 한쪽을 고치면 나머지 세 곳에 그대로 복사합니다.
  - `firestore.rules`, `src/utils/studentIdentity.ts`(+테스트), `src/utils/studentAccount.ts`, `src/utils/legacyCleanup.ts`, `src/utils/passwordCore.ts`(+테스트), `src/utils/authLogic.ts`(+테스트), `src/utils/auditLogger.ts`, `src/utils/studentDraft.ts`(+테스트), `src/components/StudentPortal.tsx`, `src/components/StudentRegistrationPanel.tsx`, `src/components/LegacyRecordsPanel.tsx`, `src/main.tsx`
  - 사이트마다 다른 부분(제목, 첫 활동지 형식)은 `src/components/AuthGateView.tsx`에서 props로 넘깁니다.
- 가입 문서 키는 `v2_{이름}`이고 `schema: 2`입니다. 예전 방식 문서(키 `stu_…`)와 이전기록(`legacy_…`)은 학생이 열 수 없어야 합니다 — 보안 규칙의 `isV2Doc` 검사를 지우지 않습니다.
- 반 키는 `년도|학년|반이름`입니다(`classLessonAccess.ts`의 `makeClassKey`).
