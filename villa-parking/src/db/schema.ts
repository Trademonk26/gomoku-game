import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

/**
 * 세대 — 실명·차량번호를 수집하지 않고 호수+연락처만 보관한다.
 * 온도는 컬럼이 아니라 temperatures 원장의 합(기준 36.5)으로 계산한다.
 */
export const households = sqliteTable("households", {
  id: id(),
  unitNumber: text("unit_number").notNull().unique(), // 예: "302"
  phone: text("phone").notNull(), // 출차 요청 연락용 (Phase 1은 푸시 대체)
  createdAt: createdAt(),
});

/** 차량 — 차종+색으로만 식별한다. */
export const cars = sqliteTable(
  "cars",
  {
    id: id(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id),
    model: text("model").notNull(), // 예: "아반떼"
    color: text("color").notNull(), // 예: "흰색"
    createdAt: createdAt(),
  },
  (t) => [index("cars_household_idx").on(t.householdId)],
);

/**
 * 주차 칸 — 2x2 바둑판. id가 NFC NDEF URL(/spot/{id})에 그대로 들어간다.
 * 막힘 관계는 별도 컬럼 없이 "같은 col에서 row 0(출구쪽)이 row 1(안쪽)을 막는다"로 유도한다.
 */
export const spots = sqliteTable("spots", {
  id: text("id").primaryKey(), // NFC 태그에 새길 짧은 코드, 예: "1"~"4"
  label: text("label").notNull(), // 예: "출구쪽 왼편"
  col: integer("col").notNull(), // 0 = 왼쪽 열, 1 = 오른쪽 열
  row: integer("row").notNull(), // 0 = 출구쪽(앞), 1 = 안쪽(뒤)
});

/**
 * 주차 세션 — 입차 1건 = 1행. departedAt이 null이면 현재 주차 중.
 * "칸당 주차 중 1대"는 애플리케이션 로직에서 보장한다.
 */
export const parkings = sqliteTable(
  "parkings",
  {
    id: id(),
    carId: text("car_id")
      .notNull()
      .references(() => cars.id),
    spotId: text("spot_id")
      .notNull()
      .references(() => spots.id),
    parkedAt: integer("parked_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    departedAt: integer("departed_at", { mode: "timestamp_ms" }), // null = 주차 중
    departSource: text("depart_source", {
      enum: ["manual", "bluetooth"], // Phase 1은 manual, Phase 2에서 bluetooth 추가
    }),
  },
  (t) => [
    index("parkings_spot_idx").on(t.spotId),
    index("parkings_car_idx").on(t.carId),
  ],
);

/**
 * 출차 예정 시간 선언 — 칩 1탭 또는 저녁 확인 푸시 응답.
 * 수정 시 새 행을 추가하고, 해당 parking의 최신 행이 유효한 예정 시간이다.
 */
export const departureTags = sqliteTable(
  "departure_tags",
  {
    id: id(),
    parkingId: text("parking_id")
      .notNull()
      .references(() => parkings.id),
    plannedDepartureAt: integer("planned_departure_at", {
      mode: "timestamp_ms",
    }).notNull(),
    source: text("source", {
      enum: ["chip", "evening_push", "edit"],
    }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("departure_tags_parking_idx").on(t.parkingId)],
);

/** 온도 계산 기준값. 현재 온도 = TEMPERATURE_BASE + delta 합. */
export const TEMPERATURE_BASE = 36.5;

/**
 * 온도 원장 — 상승 전용(delta > 0만 기록). 하락 로직은 구현하지 않는다.
 * 낮은 온도 = 벌점이 아니라 "기록 적음".
 */
export const temperatures = sqliteTable(
  "temperatures",
  {
    id: id(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id),
    delta: real("delta").notNull(), // 시간 공유 +0.1, 감사 수신 +0.3 등
    reason: text("reason", {
      enum: ["departure_time_shared", "thanks_received"],
    }).notNull(),
    refId: text("ref_id"), // 근거 레코드 id (departure_tags.id, reactions.id 등)
    createdAt: createdAt(),
  },
  (t) => [index("temperatures_household_idx").on(t.householdId)],
);

/** 감사 리액션 — 전화 없이 나간 이웃에게 보내는 이모지. */
export const reactions = sqliteTable(
  "reactions",
  {
    id: id(),
    parkingId: text("parking_id")
      .notNull()
      .references(() => parkings.id), // 어떤 출차에 대한 감사인지
    fromHouseholdId: text("from_household_id")
      .notNull()
      .references(() => households.id),
    toHouseholdId: text("to_household_id")
      .notNull()
      .references(() => households.id),
    emoji: text("emoji", { enum: ["🙏", "☀️", "👍"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("reactions_to_household_idx").on(t.toHouseholdId)],
);

export const householdsRelations = relations(households, ({ many }) => ({
  cars: many(cars),
  temperatures: many(temperatures),
}));

export const carsRelations = relations(cars, ({ one, many }) => ({
  household: one(households, {
    fields: [cars.householdId],
    references: [households.id],
  }),
  parkings: many(parkings),
}));

export const spotsRelations = relations(spots, ({ many }) => ({
  parkings: many(parkings),
}));

export const parkingsRelations = relations(parkings, ({ one, many }) => ({
  car: one(cars, { fields: [parkings.carId], references: [cars.id] }),
  spot: one(spots, { fields: [parkings.spotId], references: [spots.id] }),
  departureTags: many(departureTags),
  reactions: many(reactions),
}));

export const departureTagsRelations = relations(departureTags, ({ one }) => ({
  parking: one(parkings, {
    fields: [departureTags.parkingId],
    references: [parkings.id],
  }),
}));

export const temperaturesRelations = relations(temperatures, ({ one }) => ({
  household: one(households, {
    fields: [temperatures.householdId],
    references: [households.id],
  }),
}));

export const reactionsRelations = relations(reactions, ({ one }) => ({
  parking: one(parkings, {
    fields: [reactions.parkingId],
    references: [parkings.id],
  }),
  fromHousehold: one(households, {
    fields: [reactions.fromHouseholdId],
    references: [households.id],
  }),
  toHousehold: one(households, {
    fields: [reactions.toHouseholdId],
    references: [households.id],
  }),
}));
