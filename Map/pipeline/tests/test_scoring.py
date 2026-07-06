import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scoring.scoring import compute_score, grade, percentile_scores

INDS = [{"id": "P1", "axis": "P"}, {"id": "P2", "axis": "P"}, {"id": "W5", "axis": "W"}, {"id": "A1", "axis": "A"}]


def test_percentile_direction_and_ties():
    up = percentile_scores([10, 20, 20, 40], "up")
    assert up[0] == 0.0 and up[3] == 100.0
    assert up[1] == up[2] == 50.0  # mid-rank 동값
    down = percentile_scores([10, 20, 20, 40], "down")
    assert down[0] == 100.0 and down[3] == 0.0


def test_percentile_none_and_single():
    got = percentile_scores([None, 5, None], "up")
    assert got[0] is None and got[2] is None and got[1] == 50.0
    assert percentile_scores([None, None], "up") == [None, None]


def test_missing_axis_redistribution():
    # W5, A1 결측 → P축만으로 총점, coverage = P가중치 비중
    r = {"pct": {"P1": 80.0, "P2": 60.0, "W5": None, "A1": None}, "flags": {}}
    res = compute_score(r, INDS, {"P": 30, "W": 12, "A": 10})
    assert res["axis"] == {"P": 70.0}
    assert res["total"] == 70.0
    assert abs(res["coverage"] - 30 / 52) < 1e-12


def test_penalty_and_clamp():
    r = {"pct": {"P1": 10.0, "P2": 10.0, "W5": 5.0, "A1": None}, "flags": {"metro": True, "jeju": True}}
    res = compute_score(r, INDS, {"P": 30, "W": 12})
    assert res["penalty"] == -25.0
    assert res["total"] == 0.0  # clamp 하한

    r2 = {"pct": {"P1": 100.0, "P2": 100.0, "W5": 100.0, "A1": 100.0}, "flags": {}}
    res2 = compute_score(r2, INDS, {"P": 30, "W": 12, "A": 10})
    assert res2["total"] == 100.0 and res2["grade"] == "S"


def test_grades():
    assert grade(85) == "S" and grade(75) == "A" and grade(65) == "B" and grade(50) == "C" and grade(49.9) == "D"


def test_weighted_base():
    r = {"pct": {"P1": 100.0, "P2": 100.0, "W5": 0.0, "A1": None}, "flags": {}}
    res = compute_score(r, INDS, {"P": 30, "W": 10})
    assert abs(res["total"] - 75.0) < 1e-12  # (30*100 + 10*0) / 40
