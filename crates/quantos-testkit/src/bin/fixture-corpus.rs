fn main() {
    let digest = quantos_testkit::fixture_corpus_digest(1_000);
    let p95 = quantos_testkit::domain_operation_p95(1_000);
    println!(
        "{}",
        serde_json::json!({
            "digest": digest.as_str(),
            "fixtures": 1_000,
            "p95Micros": p95.as_micros(),
        })
    );
}
