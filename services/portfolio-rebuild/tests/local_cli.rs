use quantos_core::{AccountId, TenantId};
use quantos_portfolio::{
    AccountStatus, AccountStatusEvent, PortfolioEvent, PortfolioEventKind, RiskInputSnapshot,
    generate_fill_replay, replay_start, write_events_jsonl,
};
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Output},
};

struct Scratch(PathBuf);
impl Scratch {
    fn new() -> Self {
        let p = std::env::temp_dir().join(format!("quantos-x01-cli-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&p).unwrap();
        Self(p)
    }
    fn path(&self, name: &str) -> PathBuf {
        self.0.join(name)
    }
    fn run(&self, args: &[&str]) -> Output {
        let mut cmd = Command::new(env!("CARGO_BIN_EXE_portfolio-rebuild"));
        cmd.env_clear();
        for key in ["PATH", "HOME", "USER", "LANG", "TMPDIR"] {
            if let Some(value) = std::env::var_os(key) {
                cmd.env(key, value);
            }
        }
        cmd.args(args)
            .env("QUANTOS_SKIP_ENV", "1")
            .env("QUANTOS_TRACE_EXPORT_PATH", self.path("trace.jsonl"))
            .current_dir(&self.0)
            .output()
            .unwrap()
    }
}
impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn text(path: &Path) -> &str {
    path.to_str().unwrap()
}
fn ok(output: Output) {
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}
const ACCOUNT: &str = "01020304-0506-0708-090a-0b0c0d0e0f10";
const TENANT: &str = "01020304-0506-0708-090a-0b0c0d0e0f11";
#[test]
fn x01_cli_golden_replay_and_restart() {
    let s = Scratch::new();
    let tape = s.path("events.jsonl");
    let a = s.path("first.json");
    let b = s.path("cold.json");
    ok(s.run(&[
        "generate-replay",
        "--output",
        text(&tape),
        "--count",
        "10000",
    ]));
    let golden = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../crates/quantos-portfolio/tests/golden/portfolio_snapshot.json");
    ok(s.run(&[
        "rebuild",
        "--input",
        text(&tape),
        "--golden",
        text(&golden),
        "--emit-golden",
        text(&a),
        "--tenant-id",
        TENANT,
    ]));
    ok(s.run(&[
        "rebuild",
        "--input",
        text(&tape),
        "--golden",
        text(&a),
        "--emit-golden",
        text(&b),
        "--tenant-id",
        TENANT,
    ]));
    assert_eq!(fs::read(&a).unwrap(), fs::read(&b).unwrap());
    let value: serde_json::Value = serde_json::from_slice(&fs::read(a).unwrap()).unwrap();
    assert_eq!(value["last_event_sequence"], 10003);
}
#[test]
fn x01_cli_rejects_mismatch_before_writing_outputs() {
    let s = Scratch::new();
    let tape = s.path("events.jsonl");
    let output = s.path("output.json");
    fs::write(&output, b"preserve me").unwrap();
    ok(s.run(&["generate-replay", "--output", text(&tape), "--count", "10"]));
    let golden = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../crates/quantos-portfolio/tests/golden/portfolio_snapshot.json");
    let failed = s.run(&[
        "rebuild",
        "--input",
        text(&tape),
        "--golden",
        text(&golden),
        "--emit-golden",
        text(&output),
    ]);
    assert!(!failed.status.success());
    assert_eq!(fs::read(output).unwrap(), b"preserve me");
    fs::write(&tape, b"not json\n").unwrap();
    assert!(!s.run(&["rebuild", "--input", text(&tape)]).status.success());
}
#[test]
fn x01_cli_emits_bound_risk_input_and_rejects_stale_data() {
    let s = Scratch::new();
    let tape = s.path("events.jsonl");
    let output = s.path("risk.json");
    let account = AccountId::from_uuid(ACCOUNT.parse().unwrap());
    let tenant = TenantId::from_uuid(TENANT.parse().unwrap());
    let mut events = generate_fill_replay(account, 10, replay_start());
    let last = events.last().unwrap();
    events.push(PortfolioEvent {
        event_id: "account-active".into(),
        sequence: last.sequence + 1,
        occurred_at: last.occurred_at,
        kind: PortfolioEventKind::AccountStatus(AccountStatusEvent {
            account_id: account,
            status: AccountStatus::Active,
        }),
    });
    write_events_jsonl(&mut fs::File::create(&tape).unwrap(), &events).unwrap();
    ok(s.run(&[
        "rebuild",
        "--input",
        text(&tape),
        "--tenant-id",
        TENANT,
        "--account-id",
        ACCOUNT,
        "--risk-output",
        text(&output),
        "--risk-at",
        "2026-01-01T00:00:01Z",
        "--max-age-seconds",
        "10",
    ]));
    let original = fs::read(&output).unwrap();
    let risk: RiskInputSnapshot = serde_json::from_slice(&original).unwrap();
    risk.validate_for(tenant, account, "2026-01-01T00:00:01Z".parse().unwrap(), 10)
        .unwrap();
    assert!(
        !s.run(&[
            "rebuild",
            "--input",
            text(&tape),
            "--tenant-id",
            TENANT,
            "--account-id",
            ACCOUNT,
            "--risk-output",
            text(&output),
            "--risk-at",
            "2026-01-02T00:00:00Z"
        ])
        .status
        .success()
    );
    assert_eq!(fs::read(output).unwrap(), original);
}
