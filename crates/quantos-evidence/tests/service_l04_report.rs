use quantos_evidence::{DrillKind, DrillReport, DrillResult, ReleaseChecklist, SloReport};
#[test]
fn l04_missing_work_and_overreported_audit_cannot_pass() {
    for (target, attempts, issued, distinct, orders, signed, times) in [
        (10, 1, 1, 1, 1, 1, vec![1.0]),
        (1, 1, 1, 1, 1, 2, vec![1.0]),
        (1, 1, 1, 1, 1, 1, vec![f64::NAN]),
    ] {
        let r = SloReport::build(target, attempts, issued, distinct, orders, signed, times);
        assert!(r.is_err() || !r.unwrap().passed);
    }
}
#[test]
fn l04_four_repeated_drills_and_empty_checklists_cannot_pass() {
    let r = DrillReport::build(
        (0..4)
            .map(|_| DrillResult {
                kind: DrillKind::Replay,
                passed: true,
                detail: "owned".into(),
                duration_ms: 1.0,
            })
            .collect(),
    )
    .unwrap();
    assert!(!r.all_passed);
    assert!(!ReleaseChecklist::build(vec![]).all_passed);
}
#[test]
fn l04_empty_and_contradictory_counts_are_errors_not_panics() {
    for values in [(0, 0, 0, 0, 0, 0), (1, 1, 0, 1, 1, 0), (1, 1, 1, 1, 2, 1)] {
        let (t, a, i, c, o, s) = values;
        assert!(SloReport::build(t, a, i, c, o, s, vec![]).is_err());
    }
}
