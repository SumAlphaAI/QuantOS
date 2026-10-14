use super::*;

fn assert_rejected(result: Result<TradeCommand, IssuanceError>, reason: &str) {
    let error = result.expect_err("unsafe replay must not return the cached command");
    assert!(
        error.to_string().contains(reason),
        "{error}: expected {reason}"
    );
}

#[test]
fn valid_allow_replay_keeps_identity_signature_and_deadline() {
    let actors = actors();
    let proposal = proposal_fixture(actors.originator, now() + ChronoDuration::minutes(10));
    let decision = decision_fixture(RiskVerdict::Allow);
    let input = baseline_input(&actors, "same-key");
    let mut issuer = CommandIssuer::new(TenantId::new(), ChronoDuration::minutes(2));
    let original = issuer
        .issue(&proposal, &decision, input.clone(), actors.requester, now())
        .unwrap();
    let replay = issuer
        .issue(
            &proposal,
            &decision,
            input,
            actors.requester,
            now() + ChronoDuration::seconds(1),
        )
        .unwrap();
    assert_eq!(original, replay);
    assert_eq!(issuer.issued_count(), 1);
}

#[test]
fn replay_rechecks_kill_switch_and_release_without_changing_cache() {
    for reason in ["kill_switch_engaged", "release_invalid"] {
        let actors = actors();
        let proposal = proposal_fixture(actors.originator, now() + ChronoDuration::minutes(10));
        let decision = decision_fixture(RiskVerdict::Allow);
        let input = baseline_input(&actors, "same-key");
        let mut issuer = CommandIssuer::new(TenantId::new(), ChronoDuration::minutes(2));
        let original = issuer
            .issue(&proposal, &decision, input.clone(), actors.requester, now())
            .unwrap();
        let mut unsafe_input = input.clone();
        if reason == "kill_switch_engaged" {
            unsafe_input.kill_switch_engaged = true;
        } else {
            unsafe_input.release_valid = false;
        }
        assert_rejected(
            issuer.issue(&proposal, &decision, unsafe_input, actors.requester, now()),
            reason,
        );
        assert_eq!(
            issuer
                .issue(&proposal, &decision, input, actors.requester, now())
                .unwrap(),
            original
        );
        assert_eq!(issuer.issued_count(), 1);
    }
}

#[test]
fn replay_rechecks_proposal_and_data_expiry_at_boundary() {
    for reason in ["proposal_expired", "stale_data"] {
        let actors = actors();
        let mut proposal = proposal_fixture(actors.originator, now() + ChronoDuration::minutes(10));
        let decision = decision_fixture(RiskVerdict::Allow);
        let mut input = baseline_input(&actors, "same-key");
        if reason == "proposal_expired" {
            proposal.expires_at = now() + ChronoDuration::seconds(1);
        } else {
            input.data_expires_at = now() + ChronoDuration::seconds(1);
        }
        let mut issuer = CommandIssuer::new(TenantId::new(), ChronoDuration::minutes(2));
        issuer
            .issue(&proposal, &decision, input.clone(), actors.requester, now())
            .unwrap();
        assert_rejected(
            issuer.issue(
                &proposal,
                &decision,
                input,
                actors.requester,
                now() + ChronoDuration::seconds(1),
            ),
            reason,
        );
        assert_eq!(issuer.issued_count(), 1);
    }
}

#[test]
fn cached_command_expiry_cannot_be_extended_by_fresh_inputs() {
    let actors = actors();
    let proposal = proposal_fixture(actors.originator, now() + ChronoDuration::minutes(10));
    let decision = decision_fixture(RiskVerdict::Allow);
    let input = baseline_input(&actors, "same-key");
    let mut issuer = CommandIssuer::new(TenantId::new(), ChronoDuration::seconds(1));
    issuer
        .issue(&proposal, &decision, input.clone(), actors.requester, now())
        .unwrap();
    assert_rejected(
        issuer.issue(
            &proposal,
            &decision,
            input,
            actors.requester,
            now() + ChronoDuration::seconds(1),
        ),
        "command_expired",
    );
    assert_eq!(issuer.issued_count(), 1);
}

#[test]
fn renewed_data_does_not_extend_deadline_and_shortened_data_rejects() {
    let actors = actors();
    let proposal = proposal_fixture(actors.originator, now() + ChronoDuration::minutes(10));
    let decision = decision_fixture(RiskVerdict::Allow);
    let input = baseline_input(&actors, "same-key");
    let mut issuer = CommandIssuer::new(TenantId::new(), ChronoDuration::minutes(2));
    let original = issuer
        .issue(&proposal, &decision, input.clone(), actors.requester, now())
        .unwrap();
    let mut renewed = input.clone();
    renewed.data_expires_at += ChronoDuration::minutes(1);
    assert_eq!(
        issuer
            .issue(
                &proposal,
                &decision,
                renewed,
                actors.requester,
                now() + ChronoDuration::seconds(1)
            )
            .unwrap(),
        original
    );
    let mut shortened = input;
    shortened.data_expires_at = now() + ChronoDuration::seconds(30);
    assert_rejected(
        issuer.issue(&proposal, &decision, shortened, actors.requester, now()),
        "stale_data",
    );
    assert_eq!(issuer.issued_count(), 1);
}

#[test]
fn same_key_different_requester_conflicts_instead_of_issuing_again() {
    let actors = actors();
    let proposal = proposal_fixture(actors.originator, now() + ChronoDuration::minutes(10));
    let decision = decision_fixture(RiskVerdict::Allow);
    let input = baseline_input(&actors, "same-key");
    let mut issuer = CommandIssuer::new(TenantId::new(), ChronoDuration::minutes(2));
    issuer
        .issue(&proposal, &decision, input.clone(), actors.requester, now())
        .unwrap();
    assert_rejected(
        issuer.issue(&proposal, &decision, input, ActorId::new(), now()),
        "idempotency_conflict",
    );
    assert_eq!(issuer.issued_count(), 1);
}

#[test]
fn business_intent_and_provenance_changes_cannot_reuse_a_key() {
    type Change = fn(&mut TradeProposalRecord, &mut RiskDecision, &mut IssuanceInput);
    let changes: &[(&str, Change)] = &[
        ("proposal id", |p, _, _| p.proposal_id.push('2')),
        ("account", |p, _, _| p.account_id.push('2')),
        ("symbol", |p, _, _| p.symbol = "ETHUSDT".into()),
        ("signal", |p, _, _| p.signal_id.push('2')),
        ("workflow", |p, _, _| {
            p.workflow_run_id = WorkflowRunId::new()
        }),
        ("artifact", |p, _, _| {
            p.signal_artifact_id = ArtifactId::new()
        }),
        ("proposal content", |p, _, _| {
            p.output = json!({"changed":true})
        }),
        ("proposal evidence", |p, _, _| p.evidence_refs.clear()),
        ("proposal expiry", |p, _, _| {
            p.expires_at += ChronoDuration::minutes(1)
        }),
        ("decision id", |_, d, _| d.decision_id = DecisionId::new()),
        ("decision signature", |_, d, _| {
            d.signature = ContentHash::sha256_bytes(b"changed")
        }),
        ("decision signer", |_, d, _| d.signer.push('2')),
        ("decision time", |_, d, _| {
            d.decided_at += ChronoDuration::seconds(1)
        }),
        ("decision limits", |_, d, _| {
            d.limit_ids.push("new-limit".into())
        }),
        ("venue", |_, _, i| i.venue.push('2')),
        ("venue kind", |_, _, i| i.venue_kind = VenueKind::Dex),
        ("intent", |_, _, i| i.intent = OrderIntent::Market),
        ("side", |_, _, i| i.side = OrderSide::Sell),
        ("quantity", |_, _, i| i.quantity = "2".into()),
        ("quantity encoding", |_, _, i| i.quantity = "1.50".into()),
        ("limit", |_, _, i| i.limit_price = Some("101".into())),
        ("stop", |_, _, i| i.stop_price = Some("90".into())),
        ("originator", |_, _, i| {
            i.proposal_originator = ActorId::new()
        }),
    ];
    for (name, change) in changes {
        let actors = actors();
        let proposal = proposal_fixture(actors.originator, now() + ChronoDuration::minutes(10));
        let decision = decision_fixture(RiskVerdict::Allow);
        let input = baseline_input(&actors, "same-key");
        let mut issuer = CommandIssuer::new(TenantId::new(), ChronoDuration::minutes(2));
        let original = issuer
            .issue(&proposal, &decision, input.clone(), actors.requester, now())
            .unwrap();
        let (mut p, mut d, mut i) = (proposal.clone(), decision.clone(), input.clone());
        change(&mut p, &mut d, &mut i);
        let error = issuer
            .issue(&p, &d, i, actors.requester, now())
            .expect_err(name);
        assert!(
            error.to_string().contains("idempotency_conflict"),
            "{name}: {error}"
        );
        assert_eq!(
            issuer
                .issue(&proposal, &decision, input, actors.requester, now())
                .unwrap(),
            original
        );
        assert_eq!(issuer.issued_count(), 1);
    }
}

#[test]
fn approval_replay_revalidates_every_proof_without_consuming_twice() {
    for reason in [
        "approval_missing",
        "invalid_signature",
        "decision_mismatch",
        "self_approval",
        "deny",
    ] {
        let actors = actors();
        let proposal = proposal_fixture(actors.originator, now() + ChronoDuration::minutes(10));
        let decision = decision_fixture(RiskVerdict::ApprovalRequired);
        let mut input = baseline_input(&actors, "same-key");
        input.approval = Some(ApprovalRecord::new(
            decision.decision_id,
            actors.approver,
            now(),
        ));
        let mut issuer = CommandIssuer::new(TenantId::new(), ChronoDuration::minutes(2));
        let original = issuer
            .issue(&proposal, &decision, input.clone(), actors.requester, now())
            .unwrap();
        let mut bad = input.clone();
        let mut d = decision.clone();
        match reason {
            "approval_missing" => bad.approval = None,
            "invalid_signature" => bad.approval.as_mut().unwrap().signature.push('x'),
            "decision_mismatch" => {
                bad.approval = Some(ApprovalRecord::new(
                    DecisionId::new(),
                    actors.approver,
                    now(),
                ))
            }
            "self_approval" => {
                bad.approval = Some(ApprovalRecord::new(
                    decision.decision_id,
                    actors.requester,
                    now(),
                ))
            }
            "deny" => d.verdict = RiskVerdict::Deny,
            _ => unreachable!(),
        }
        assert!(
            issuer
                .issue(&proposal, &d, bad, actors.requester, now())
                .is_err(),
            "{reason}"
        );
        assert_eq!(
            issuer
                .issue(
                    &proposal,
                    &decision,
                    input.clone(),
                    actors.requester,
                    now() + ChronoDuration::seconds(1)
                )
                .unwrap(),
            original
        );
        input.idempotency_key = "different-key".into();
        assert_rejected(
            issuer.issue(&proposal, &decision, input, actors.requester, now()),
            "duplicate_approval",
        );
        assert_eq!(issuer.issued_count(), 1);
    }
}

#[test]
fn conflicting_approval_does_not_consume_a_new_authorization() {
    let actors = actors();
    let proposal = proposal_fixture(actors.originator, now() + ChronoDuration::minutes(10));
    let decision = decision_fixture(RiskVerdict::ApprovalRequired);
    let mut input = baseline_input(&actors, "same-key");
    input.approval = Some(ApprovalRecord::new(
        decision.decision_id,
        actors.approver,
        now(),
    ));
    let mut issuer = CommandIssuer::new(TenantId::new(), ChronoDuration::minutes(2));
    issuer
        .issue(&proposal, &decision, input.clone(), actors.requester, now())
        .unwrap();
    input.approval = Some(ApprovalRecord::new(
        decision.decision_id,
        ActorId::new(),
        now(),
    ));
    assert_rejected(
        issuer.issue(&proposal, &decision, input.clone(), actors.requester, now()),
        "idempotency_conflict",
    );
    input.idempotency_key = "new-key".into();
    issuer
        .issue(&proposal, &decision, input, actors.requester, now())
        .unwrap();
    assert_eq!(issuer.issued_count(), 2);
}

#[test]
fn ttl_uses_the_shortest_bound_without_a_performance_threshold() {
    for (issuer_seconds, proposal_seconds, data_seconds) in
        [(10, 30, 20), (30, 10, 20), (30, 20, 10)]
    {
        let actors = actors();
        let proposal = proposal_fixture(
            actors.originator,
            now() + ChronoDuration::seconds(proposal_seconds),
        );
        let decision = decision_fixture(RiskVerdict::Allow);
        let mut input = baseline_input(&actors, "ttl");
        input.data_expires_at = now() + ChronoDuration::seconds(data_seconds);
        let mut issuer =
            CommandIssuer::new(TenantId::new(), ChronoDuration::seconds(issuer_seconds));
        let command = issuer
            .issue(&proposal, &decision, input, actors.requester, now())
            .unwrap();
        assert_eq!(command.expires_at, now() + ChronoDuration::seconds(10));
        assert_eq!(command.issued_at, now());
        assert!(!command.signature.as_str().is_empty());
    }
}

#[test]
fn nonpositive_ttl_never_issues_or_consumes_approval() {
    for seconds in [0, -1] {
        let actors = actors();
        let proposal = proposal_fixture(actors.originator, now() + ChronoDuration::minutes(10));
        let decision = decision_fixture(RiskVerdict::ApprovalRequired);
        let mut input = baseline_input(&actors, "ttl");
        input.approval = Some(ApprovalRecord::new(
            decision.decision_id,
            actors.approver,
            now(),
        ));
        let mut issuer = CommandIssuer::new(TenantId::new(), ChronoDuration::seconds(seconds));
        assert_rejected(
            issuer.issue(&proposal, &decision, input, actors.requester, now()),
            "command_expired",
        );
        assert_eq!(issuer.issued_count(), 0);
        assert!(issuer.consumed_approvals.is_empty());
    }
}

#[test]
fn conflicting_concurrent_retries_never_obtain_or_create_a_command() {
    let actors = actors();
    let proposal = Arc::new(proposal_fixture(
        actors.originator,
        now() + ChronoDuration::minutes(10),
    ));
    let decision = Arc::new(decision_fixture(RiskVerdict::Allow));
    let mut issuer = CommandIssuer::new(TenantId::new(), ChronoDuration::minutes(2));
    let original = issuer
        .issue(
            &proposal,
            &decision,
            baseline_input(&actors, "shared"),
            actors.requester,
            now(),
        )
        .unwrap();
    let issuer = Arc::new(Mutex::new(issuer));
    let barrier = Arc::new(Barrier::new(32));
    let handles: Vec<_> = (0..32)
        .map(|index| {
            let (issuer, proposal, decision, barrier, actors) = (
                Arc::clone(&issuer),
                Arc::clone(&proposal),
                Arc::clone(&decision),
                Arc::clone(&barrier),
                actors.clone(),
            );
            thread::spawn(move || {
                let mut input = baseline_input(&actors, "shared");
                let requester = if index % 3 == 1 {
                    ActorId::new()
                } else {
                    actors.requester
                };
                if index % 3 == 2 {
                    input.quantity = "99".into();
                }
                barrier.wait();
                let result =
                    issuer
                        .lock()
                        .unwrap()
                        .issue(&proposal, &decision, input, requester, now());
                (index % 3 == 0, result)
            })
        })
        .collect();
    for h in handles {
        let (valid, result) = h.join().unwrap();
        if valid {
            assert_eq!(result.unwrap(), original);
        } else {
            assert_rejected(result, "idempotency_conflict");
        }
    }
    assert_eq!(issuer.lock().unwrap().issued_count(), 1);
}
