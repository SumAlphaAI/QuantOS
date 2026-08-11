# F09 Capacity ADR Input

## Metadata

- Generated at: `{{generated_at}}`
- Incident window: `{{incident_window}}`
- Related alerts: `{{alert_ids}}`
- Related correlation IDs: `{{correlation_ids}}`

## Trigger Summary

{{summary}}

## Observed Metrics

| Metric | Observed | Threshold |
| --- | --- | --- |
{{metric_rows}}

## Metric Sources

{{metric_sources}}

## Fault Injection Evidence

- Database fault recovery: `{{db_fault_result}}`
- Event consumer fault recovery: `{{event_consumer_fault_result}}`
- Engine fault recovery: `{{engine_fault_result}}`
- Secret redaction verified: `{{secret_redaction_verified}}`

## Trace Evidence

{{trace_rows}}

## Recommended Actions

{{recommended_actions}}

## Approval Checklist

- [ ] Alert thresholds reviewed against current production baseline
- [ ] Recovery evidence attached
- [ ] No secret leakage observed in logs or traces
- [ ] Capacity / cost tradeoffs documented
- [ ] Follow-up tasks linked
