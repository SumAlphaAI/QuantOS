//! Composition assertions over the same actual accepted/UNKNOWN process fixtures.
use super::*;
fn evidence(name: &str, value: Value) {
    if let Ok(path) = std::env::var(name) {
        private_write(path, serde_json::to_vec_pretty(&value).unwrap());
    }
}
fn c10(url: &str, id: &str) -> Value {
    get(url, &format!("/v1/audit/events?correlationId={id}"))
}
#[test]
fn cancelled_subject_read_finishes_original_checkpoint_without_reissuing() {
    let lab = Lab::new();
    let (_p, url) = lab.bff(true);
    let rows = get(&url, "/v1/assisted-testnet/subjects");
    let id = open(&url, &rows["items"][0]);
    approve(&url, &id, 0);
    let before = get(&url, &format!("/v1/assisted-testnet/requests/{id}"));
    private_write(lab.directory.join("pause-subjects-before-save"), b"owned");
    let base = url.clone();
    let caller = std::thread::spawn(move || {
        reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(Wait::from_millis(500))
            .build()
            .unwrap()
            .get(format!("{base}/v1/assisted-testnet/subjects"))
            .header(
                "cookie",
                "quantos_session=session-approver; quantos_csrf=csrf-token-0000000000000001",
            )
            .send()
    });
    let until = std::time::Instant::now() + Wait::from_secs(5);
    while !lab.directory.join("subjects-before-save.marker").is_file() {
        assert!(
            std::time::Instant::now() < until,
            "source read marker missing"
        );
        std::thread::sleep(Wait::from_millis(10));
    }
    assert!(
        caller.join().unwrap().is_err(),
        "caller must actually disconnect"
    );
    fs::remove_file(lab.directory.join("pause-subjects-before-save")).unwrap();
    let context = get(&url, "/v1/context");
    assert_eq!(context["mode"], "assisted_live");
    let after = get(&url, &format!("/v1/assisted-testnet/requests/{id}"));
    assert_eq!(after, before);
    approve(&url, &id, 1);
    let approved = get(&url, &format!("/v1/assisted-testnet/requests/{id}"));
    assert_eq!(approved["request"]["revision"], 2);
    assert_eq!(approved["request"]["status"], "approved");
    assert!(approved.get("command").is_none_or(Value::is_null));
    let activation = super::c11_activation::current(&url);
    assert_eq!(activation["killGeneration"], "0");
    assert_eq!(activation["version"], "0");
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    evidence(
        "QUANTOS_L4_CANCELLED_READ_RESULT",
        json!({
            "sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,
            "actualClientDisconnect":true,"sameOriginalCheckpointFinished":true,
            "context":context,"before":before,"after":after,"approved":approved,
            "activation":activation,"protocolCalls":0,"noResend":true
        }),
    );
}
pub(super) fn accepted_join(
    lab: &Lab,
    url: &str,
    id: &str,
    original: &Value,
    ledger: &Value,
    request_events: &Value,
) {
    let alerts = get(url, "/v1/alerts");
    assert_eq!(alerts["items"].as_array().unwrap().len(), 1);
    let reconciliation = get(url, "/v1/assisted-testnet/reconciliation");
    let issued = owner_store(lab, "commands")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap()["issued"]
        .clone();
    let initial = super::c11_activation::current(url);
    super::c11_activation::change(url, &initial, false);
    let off = super::c11_activation::current(url);
    assert_eq!(off["version"], "1");
    assert_eq!(off["effective"], false);
    assert_eq!(
        get(url, &format!("/v1/assisted-testnet/requests/{id}")),
        *original
    );
    assert_eq!(get(url, "/v1/assisted-testnet/ledger"), *ledger);
    super::c11_activation::change(url, &off, true);
    let on = super::c11_activation::current(url);
    assert_eq!(on["version"], "2");
    assert_eq!(on["killGeneration"], "0");
    assert_eq!(on["runtimeWritable"], true);
    super::native_control::mutate(url, "session-owner", "engage", "global", 0, None);
    super::native_control::mutate(url, "session-current", "engage", "account", 1, None);
    let kill = get(url, "/v1/risk/kill-switch");
    assert_eq!(kill["generation"], "2");
    assert_eq!(kill["globalActive"], true);
    assert_eq!(kill["accountActive"], true);
    super::c11_activation::change(url, &super::c11_activation::current(url), false);
    super::c11_activation::change(url, &super::c11_activation::current(url), true);
    let (_restart, restarted) = lab.bff(true);
    let current = super::c11_activation::current(&restarted);
    assert_eq!(current["version"], "4");
    assert_eq!(current["killGeneration"], "2");
    assert_eq!(current["nativeStopped"], true);
    assert_eq!(current["runtimeWritable"], false);
    let after = get(&restarted, &format!("/v1/assisted-testnet/requests/{id}"));
    assert_eq!(after, *original);
    assert_eq!(get(&restarted, "/v1/assisted-testnet/ledger"), *ledger);
    assert_eq!(
        get(&restarted, "/v1/assisted-testnet/reconciliation"),
        reconciliation
    );
    assert_eq!(get(&restarted, "/v1/alerts"), alerts);
    assert_eq!(c10(&restarted, id), *request_events);
    assert_eq!(
        owner_store(lab, "commands")
            .lock()
            .unwrap()
            .read()
            .unwrap()
            .unwrap()["issued"],
        issued
    );
    let command_path = format!("/v1/assisted-testnet/requests/{id}/commands");
    let denied = call(
        &restarted,
        "session-current",
        "POST",
        &command_path,
        json!({"expectedRevision":2}),
        &Uuid::new_v4().to_string(),
    );
    assert_ne!(denied.0, 200);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    let activation_id = current["resourceId"].as_str().unwrap();
    evidence(
        "QUANTOS_L4_ACCEPTED_CONTROLS_RESULT",
        json!({
            "sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,
            "original":original,"after":after,"ledger":ledger,"alerts":alerts,
            "reconciliation":reconciliation,"initial":initial,"off":off,"on":on,
            "current":current,"kill":kill,"requestEvents":request_events,
            "activationEvents":c10(&restarted,activation_id),
            "controlEvents":c10(&restarted,kill["history"][0]["correlationId"].as_str().unwrap()),
        "accountControlEvents":c10(&restarted,kill["history"][1]["correlationId"].as_str().unwrap()),
            "originalIssuedUnchanged":true,"originalRequestEventsUnchanged":true,
            "restartPreserved":true,"stoppedCommandStatus":denied.0,
            "protocolCalls":1,"noResend":true,"automaticRelease":false,"automaticClosure":false
        }),
    );
}
pub(super) fn unknown_join(
    lab: &Lab,
    command: &Value,
    ledger: &Value,
    alerts: &Value,
    off: &Value,
    on: &Value,
) {
    let id = command["requestId"].as_str().unwrap();
    let (_restart, restarted) = lab.bff(true);
    let current = super::c11_activation::current(&restarted);
    assert_eq!(current["version"], "2");
    assert_eq!(current["killGeneration"], "1");
    assert_eq!(current["nativeStopped"], true);
    let view = get(&restarted, &format!("/v1/assisted-testnet/requests/{id}"));
    assert_eq!(view["command"], *command);
    assert_eq!(get(&restarted, "/v1/assisted-testnet/ledger"), *ledger);
    assert_eq!(get(&restarted, "/v1/alerts"), *alerts);
    let reconciliation = get(&restarted, "/v1/assisted-testnet/reconciliation");
    assert_eq!(reconciliation["unknownObligationsOpen"], 1);
    assert_eq!(reconciliation["fullBooksReady"], false);
    let controls = get(&restarted, "/v1/risk/kill-switch");
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    evidence(
        "QUANTOS_L4_UNKNOWN_CONTROLS_RESULT",
        json!({
            "sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,
            "command":command,"view":view,"ledger":ledger,"alerts":alerts,
            "reconciliation":reconciliation,"off":off,"on":on,"current":current,
            "controls":controls,"requestEvents":c10(&restarted,id),
            "activationEvents":c10(&restarted,current["resourceId"].as_str().unwrap()),
            "controlEvents":c10(&restarted,controls["history"][0]["correlationId"].as_str().unwrap()),
            "originalIssuedUnchanged":true,"restartPreserved":true,"protocolCalls":1,
            "noResend":true,"automaticRelease":false,"automaticClosure":false
        }),
    );
}
