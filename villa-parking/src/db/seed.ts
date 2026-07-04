import { db } from "./index";
import { spots } from "./schema";

// 2x2 이중주차 구조. row 0(출구쪽)이 같은 col의 row 1(안쪽)을 막는다.
// id는 NFC 태그에 새길 URL(/spot/{id})에 그대로 사용된다.
const SPOTS = [
  { id: "1", label: "출구쪽 왼편", col: 0, row: 0 },
  { id: "2", label: "출구쪽 오른편", col: 1, row: 0 },
  { id: "3", label: "안쪽 왼편", col: 0, row: 1 },
  { id: "4", label: "안쪽 오른편", col: 1, row: 1 },
];

async function seed() {
  await db.insert(spots).values(SPOTS).onConflictDoNothing();
  console.log(`주차 칸 ${SPOTS.length}개 시드 완료`);
}

seed().then(() => process.exit(0));
