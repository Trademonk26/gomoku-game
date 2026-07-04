# 우리빌라 주차장

한국 빌라의 이중주차(2x2 바둑판) 갈등을 해결하는 초경량 주차 공유 서비스.

## 기술 스택

- Next.js 16 (App Router) + PWA
- SQLite + Drizzle ORM (추후 Supabase/Postgres 전환 가능)
- Tailwind CSS 4, 다크 테마 고정

## 개발

```bash
npm install
npm run db:push   # 스키마를 villa-parking.db에 반영
npm run db:seed   # 주차 칸 4개(2x2) 시드
npm run dev       # http://localhost:3000
```

## DB 스키마 (src/db/schema.ts)

| 테이블 | 역할 |
|---|---|
| `households` | 세대 (호수 + 연락처, 실명·차량번호 미수집) |
| `cars` | 차량 (차종 + 색으로 식별) |
| `spots` | 주차 칸 2x2 — row 0(출구쪽)이 같은 col의 row 1(안쪽)을 막음 |
| `parkings` | 주차 세션 — `departedAt`이 null이면 주차 중 |
| `departure_tags` | 출차 예정 시간 선언 — 최신 행이 유효 |
| `temperatures` | 주차 온도 원장 — 36.5 기준, 상승 전용 |
| `reactions` | 감사 리액션 (🙏/☀️/👍) |
