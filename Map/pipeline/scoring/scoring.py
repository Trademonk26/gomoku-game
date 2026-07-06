"""스코어링 코어 — web/src/lib/scoring.ts 와 계약 테스트로 동기화되는 순수 함수들.

입력 규약:
  region = { "pct": {indicator_id: 0~100 | None}, "flags": {"metro": bool, "jeju": bool} }
  indicators = [{ "id": str, "axis": str }, ...]
  weights = {axis_id: number}  # 합이 1이 아니어도 됨(내부 정규화)

규칙:
  - 축 점수 = 축 내 존재하는 지표 pct 의 단순평균 (MVP: 축내 지표 등가중)
  - 총점 base = 존재하는 축들의 가중평균 (결측 축 가중치는 재분배 효과)
  - coverage = 존재 축 가중치 합 / 전체 가중치 합
  - 페널티: metro -15, jeju -10 → clamp(0, 100)
"""

PENALTY_METRO = -15.0
PENALTY_JEJU = -10.0

GRADES = [(85.0, "S"), (75.0, "A"), (65.0, "B"), (50.0, "C")]


def axis_scores(region, indicators):
    by_axis = {}
    for ind in indicators:
        p = region["pct"].get(ind["id"])
        if p is None:
            continue
        by_axis.setdefault(ind["axis"], []).append(p)
    return {a: sum(v) / len(v) for a, v in by_axis.items()}


def grade(total):
    for cut, g in GRADES:
        if total >= cut:
            return g
    return "D"


def compute_score(region, indicators, weights):
    ax = axis_scores(region, indicators)
    total_w = sum(weights.values())
    avail_w = sum(w for a, w in weights.items() if a in ax)
    if total_w <= 0 or avail_w <= 0:
        return {"axis": ax, "base": None, "penalty": 0.0, "total": None, "grade": None, "coverage": 0.0}
    base = sum(weights[a] * ax[a] for a in ax if a in weights) / avail_w
    penalty = 0.0
    if region.get("flags", {}).get("metro"):
        penalty += PENALTY_METRO
    if region.get("flags", {}).get("jeju"):
        penalty += PENALTY_JEJU
    total = min(100.0, max(0.0, base + penalty))
    return {
        "axis": ax,
        "base": base,
        "penalty": penalty,
        "total": total,
        "grade": grade(total),
        "coverage": avail_w / total_w,
    }


def percentile_scores(values, direction):
    """값 리스트(None 포함) → 0~100 백분위 점수. direction: 'up' 높을수록 좋음 / 'down' 낮을수록 좋음.

    평균 순위(mid-rank) 방식, n=1이면 50. None은 None 유지.
    """
    idx_vals = [(i, v) for i, v in enumerate(values) if v is not None]
    out = [None] * len(values)
    n = len(idx_vals)
    if n == 0:
        return out
    if n == 1:
        out[idx_vals[0][0]] = 50.0
        return out
    sorted_vals = sorted(v for _, v in idx_vals)
    # mid-rank: 동값 구간의 평균 순위
    first = {}
    count = {}
    for rank, v in enumerate(sorted_vals):
        if v not in first:
            first[v] = rank
            count[v] = 0
        count[v] += 1
    for i, v in idx_vals:
        mid = first[v] + (count[v] - 1) / 2.0
        p = mid / (n - 1) * 100.0
        out[i] = round(100.0 - p if direction == "down" else p, 2)
    return out
