/**
 * 로컬 개발용 데모 데이터. 기존 세대/차량/주차 기록을 모두 지우고 다시 넣는다.
 * 실행: npm run db:seed:demo
 */
import { db } from "./index";
import {
  cars,
  departureTags,
  households,
  parkings,
  reactions,
  temperatures,
} from "./schema";

function tomorrowAt(hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function seedDemo() {
  // FK 역순으로 비운다
  await db.delete(reactions);
  await db.delete(temperatures);
  await db.delete(departureTags);
  await db.delete(parkings);
  await db.delete(cars);
  await db.delete(households);

  const DEMO = [
    // 출구쪽 왼편(1) — 출차 시간 설정됨
    { unit: "201", phone: "010-0000-0201", model: "쏘나타", color: "검정", spotId: "1", departAt: tomorrowAt(7, 30) },
    // 출구쪽 오른편(2) — 시간 미설정
    { unit: "402", phone: "010-0000-0402", model: "스파크", color: "파랑", spotId: "2", departAt: null },
    // 안쪽 왼편(3) — 201호에게 막힘, 시간 설정됨
    { unit: "302", phone: "010-0000-0302", model: "아반떼", color: "흰색", spotId: "3", departAt: tomorrowAt(8, 0) },
    // 안쪽 오른편(4)은 빈 칸
  ];

  for (const d of DEMO) {
    const [h] = await db
      .insert(households)
      .values({ unitNumber: d.unit, phone: d.phone })
      .returning();
    const [c] = await db
      .insert(cars)
      .values({ householdId: h.id, model: d.model, color: d.color })
      .returning();
    const [p] = await db
      .insert(parkings)
      .values({ carId: c.id, spotId: d.spotId })
      .returning();
    if (d.departAt) {
      await db.insert(departureTags).values({
        parkingId: p.id,
        plannedDepartureAt: d.departAt,
        source: "chip",
      });
      // 시간 공유 온도 +0.1
      await db.insert(temperatures).values({
        householdId: h.id,
        delta: 0.1,
        reason: "departure_time_shared",
      });
    }
  }

  console.log(`데모 세대 ${DEMO.length}개 시드 완료 (칸 4번은 빈 칸)`);
}

seedDemo().then(() => process.exit(0));
