fn main() {
    let digest = quantos_testkit::fixture_corpus_digest(1_000);
    let mut output = serde_json::json!({"digest":digest.as_str(),"fixtures":1_000});
    if !std::env::args().any(|arg| arg == "--functional") {
        output["p95Micros"] =
            serde_json::json!(quantos_testkit::domain_operation_p95(1_000).as_micros());
    }
    println!("{output}");
}
