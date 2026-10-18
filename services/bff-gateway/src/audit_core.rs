//! Shared, conservative redaction and canonical export encoding. Unknown fields
//! are excluded; free text is never copied into an attested audit response.
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

pub(crate) fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
pub(crate) fn payload_hash(value: &Value) -> String {
    format!(
        "sha256:{}",
        digest(&quantos_core::canonical_json_bytes(value).expect("JSON canonicalization"))
    )
}
pub(crate) fn redacted(value: &Value) -> Value {
    let mut out = json!({"redactionPolicy":"audit-v1"});
    for name in [
        "reason",
        "watermark",
        "account",
        "token",
        "secret",
        "credential",
    ] {
        if value.get(name).is_some() {
            out[name] = json!("[REDACTED]");
        }
    }
    if let Some(n) = value["retentionDays"]
        .as_u64()
        .filter(|n| (1..=30).contains(n))
    {
        out["retentionDays"] = json!(n);
    }
    for (name, allowed) in [
        ("format", &["jsonl", "csv", "pdf"][..]),
        (
            "status",
            &[
                "queued",
                "generating",
                "ready",
                "cancel_requested",
                "cancelled",
                "expired",
                "failed",
            ][..],
        ),
        ("outcome", &["succeeded", "denied", "failed"][..]),
    ] {
        if let Some(s) = value[name].as_str().filter(|s| allowed.contains(s)) {
            out[name] = json!(s);
        }
    }
    if let Some(scope) = value.get("scope") {
        out["scopeHash"] = json!(payload_hash(scope));
    }
    if value["scopeHash"].as_str().is_some_and(|s| {
        s.starts_with("sha256:") && s.len() == 71 && s[7..].bytes().all(|b| b.is_ascii_hexdigit())
    }) {
        out["scopeHash"] = value["scopeHash"].clone();
    }
    out
}
pub(crate) fn watermark(text: &str) -> String {
    format!("QuantOS restricted copy {}", &digest(text.as_bytes())[..12])
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ExportScopeInput {
    pub correlation_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event_kinds: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_at: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ExportInput {
    pub scope: ExportScopeInput,
    pub format: String,
    pub reason: String,
    pub watermark: String,
    pub retention_days: i64,
}
impl ExportInput {
    pub fn normalize(mut self) -> Result<Self, ()> {
        self.reason = self.reason.trim().to_owned();
        self.watermark = self.watermark.trim().to_owned();
        if self.scope.correlation_ids.is_empty()
            || self.scope.correlation_ids.len() > 100
            || !(1..=30).contains(&self.retention_days)
            || !matches!(self.format.as_str(), "jsonl" | "csv" | "pdf")
            || !(8..=500).contains(&self.reason.chars().count())
            || !(3..=120).contains(&self.watermark.chars().count())
        {
            return Err(());
        }
        for id in &mut self.scope.correlation_ids {
            *id = uuid::Uuid::parse_str(id).map_err(|_| ())?.to_string();
        }
        self.scope.correlation_ids.sort();
        if self.scope.correlation_ids.windows(2).any(|p| p[0] == p[1]) {
            return Err(());
        }
        if let Some(kinds) = &mut self.scope.event_kinds {
            kinds.sort();
            if kinds.len() > 50
                || kinds.iter().any(|k| k.is_empty() || k.len() > 120)
                || kinds.windows(2).any(|p| p[0] == p[1])
            {
                return Err(());
            }
        }
        for s in [&mut self.scope.start_at, &mut self.scope.end_at]
            .into_iter()
            .flatten()
        {
            *s = DateTime::parse_from_rfc3339(s)
                .map_err(|_| ())?
                .with_timezone(&Utc)
                .to_rfc3339();
        }
        if self
            .scope
            .start_at
            .as_ref()
            .zip(self.scope.end_at.as_ref())
            .is_some_and(|(s, e)| s > e)
        {
            return Err(());
        }
        Ok(self)
    }
    pub fn includes(&self, event: &Value) -> bool {
        let at = event["occurredAt"]
            .as_str()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok());
        self.scope
            .correlation_ids
            .iter()
            .any(|id| Some(id.as_str()) == event["correlationId"].as_str())
            && self
                .scope
                .event_kinds
                .as_ref()
                .is_none_or(|k| k.iter().any(|k| Some(k.as_str()) == event["kind"].as_str()))
            && self.scope.start_at.as_ref().is_none_or(|s| {
                at.is_some_and(|at| DateTime::parse_from_rfc3339(s).is_ok_and(|s| at >= s))
            })
            && self.scope.end_at.as_ref().is_none_or(|e| {
                at.is_some_and(|at| DateTime::parse_from_rfc3339(e).is_ok_and(|e| at <= e))
            })
    }
}
pub(crate) fn artifact(format: &str, watermark: &str, events: &[Value]) -> (Vec<u8>, &'static str) {
    match format {
        "csv" => {
            let quote = |v: &str| format!("\"{}\"", v.replace('"', "\"\""));
            let mut text = "watermark,event\r\n".to_owned();
            for event in events {
                text.push_str(&format!(
                    "{},{}\r\n",
                    quote(watermark),
                    quote(&event.to_string())
                ));
            }
            (text.into_bytes(), "text/csv")
        }
        "pdf" => {
            // Each page contains the watermark and a bounded ASCII JSON record.
            let escape = |s: &str| {
                s.chars()
                    .map(|c| {
                        if c.is_ascii() && !c.is_control() {
                            c
                        } else {
                            '?'
                        }
                    })
                    .collect::<String>()
                    .replace('\\', "\\\\")
                    .replace('(', "\\(")
                    .replace(')', "\\)")
            };
            let pages = events.len().max(1);
            let mut objects = vec![String::new(); 3 + pages * 2];
            objects[0] = "<< /Type /Catalog /Pages 2 0 R >>".into();
            objects[1] = format!(
                "<< /Type /Pages /Count {pages} /Kids [{}] >>",
                (0..pages)
                    .map(|i| format!("{} 0 R", 4 + i * 2))
                    .collect::<Vec<_>>()
                    .join(" ")
            );
            objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>".into();
            for i in 0..pages {
                let mut content = format!("BT /F1 8 Tf 24 800 Td ({}) Tj", escape(watermark));
                let text = events
                    .get(i)
                    .map(Value::to_string)
                    .unwrap_or_else(|| "No matching events".into());
                for line in text.as_bytes().chunks(90) {
                    content.push_str(&format!(
                        " 0 -12 Td ({}) Tj",
                        escape(&String::from_utf8_lossy(line))
                    ));
                }
                content.push_str(" ET");
                objects[3 + i * 2] = format!(
                    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {} 0 R >>",
                    5 + i * 2
                );
                objects[4 + i * 2] = format!(
                    "<< /Length {} >>\nstream\n{}\nendstream",
                    content.len(),
                    content
                );
            }
            let mut pdf = "%PDF-1.4\n".to_owned();
            let mut offsets = vec![0];
            for (i, object) in objects.iter().enumerate() {
                offsets.push(pdf.len());
                pdf.push_str(&format!("{} 0 obj\n{}\nendobj\n", i + 1, object));
            }
            let xref = pdf.len();
            pdf.push_str(&format!("xref\n0 {}\n0000000000 65535 f \n", offsets.len()));
            for at in offsets.iter().skip(1) {
                pdf.push_str(&format!("{at:010} 00000 n \n"));
            }
            pdf.push_str(&format!(
                "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n",
                offsets.len()
            ));
            (pdf.into_bytes(), "application/pdf")
        }
        _ => {
            let mut text =
                json!({"watermark":watermark,"redactionPolicy":"audit-v1"}).to_string() + "\n";
            for event in events {
                text.push_str(&event.to_string());
                text.push('\n');
            }
            (text.into_bytes(), "application/x-ndjson")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn input() -> ExportInput {
        serde_json::from_value(json!({"scope":{"correlationIds":["aaaaaaaa-1111-4111-8111-111111111111"]},"format":"jsonl","reason":"Controlled evidence review","watermark":"Restricted audit","retentionDays":7})).unwrap()
    }
    #[test]
    fn normalized_scope_is_order_independent_and_rejects_duplicate_or_reversed_bounds() {
        let mut a = input();
        a.scope
            .correlation_ids
            .push("bbbbbbbb-1111-4111-8111-111111111111".into());
        a.scope.event_kinds = Some(vec!["z".into(), "a".into()]);
        let mut b = a.clone();
        b.scope.correlation_ids.reverse();
        b.scope.event_kinds.as_mut().unwrap().reverse();
        assert_eq!(
            serde_json::to_value(a.normalize().unwrap()).unwrap(),
            serde_json::to_value(b.normalize().unwrap()).unwrap()
        );
        let mut duplicate = input();
        duplicate
            .scope
            .correlation_ids
            .push(duplicate.scope.correlation_ids[0].clone());
        assert!(duplicate.normalize().is_err());
        let mut reverse = input();
        reverse.scope.start_at = Some("2026-10-02T00:00:00Z".into());
        reverse.scope.end_at = Some("2026-10-01T00:00:00Z".into());
        assert!(reverse.normalize().is_err());
    }
    #[test]
    fn redaction_excludes_unknown_nested_and_free_text_and_hashes_canonical_bytes() {
        let raw = json!({"reason":"SYNTHETIC_PRIVATE","watermark":"SYNTHETIC_PRIVATE","unknown":{"password":"SYNTHETIC_PRIVATE"},"scope":{"correlationIds":["private"]},"retentionDays":7,"status":"ready"});
        let clean = redacted(&raw);
        assert!(!clean.to_string().contains("SYNTHETIC_PRIVATE"));
        assert!(clean.get("unknown").is_none());
        assert!(clean.get("scope").is_none());
        assert_eq!(clean["reason"], "[REDACTED]");
        assert_eq!(
            payload_hash(&clean),
            format!(
                "sha256:{}",
                digest(&quantos_core::canonical_json_bytes(&clean).unwrap())
            )
        );
    }
    #[test]
    fn scope_filters_apply_correlation_kind_and_utc_time_bounds_together() {
        let mut input = input();
        input.scope.event_kinds = Some(vec!["order.created".into()]);
        input.scope.start_at = Some("2026-10-01T01:00:00+01:00".into());
        input.scope.end_at = Some("2026-10-01T00:00:01Z".into());
        let input = input.normalize().unwrap();
        let event = json!({"correlationId":input.scope.correlation_ids[0],"kind":"order.created","occurredAt":"2026-10-01T00:00:00Z"});
        assert!(input.includes(&event));
        for patch in [
            json!({"kind":"fill.recorded"}),
            json!({"occurredAt":"2026-10-01T00:00:02Z"}),
            json!({"correlationId":"bbbbbbbb-1111-4111-8111-111111111111"}),
        ] {
            let mut changed = event.clone();
            for (k, v) in patch.as_object().unwrap() {
                changed[k] = v.clone();
            }
            assert!(!input.includes(&changed));
        }
    }
    #[test]
    fn jsonl_csv_pdf_artifacts_include_watermark_and_attested_redacted_data() {
        let watermark = watermark("SYNTHETIC_PRIVATE");
        let clean = redacted(&json!({"reason":"SYNTHETIC_PRIVATE"}));
        for (format, media) in [
            ("jsonl", "application/x-ndjson"),
            ("csv", "text/csv"),
            ("pdf", "application/pdf"),
        ] {
            let (bytes, actual) = artifact(format, &watermark, std::slice::from_ref(&clean));
            let text = String::from_utf8(bytes).unwrap();
            assert_eq!(actual, media);
            assert!(text.contains(&watermark));
            assert!(!text.contains("SYNTHETIC_PRIVATE"));
            assert!(text.contains("REDACTED"));
            if format == "jsonl" {
                assert_eq!(text.lines().count(), 2);
                for line in text.lines() {
                    serde_json::from_str::<Value>(line).unwrap();
                }
            }
            if format == "pdf" {
                assert!(text.starts_with("%PDF-1.4"));
                assert!(text.ends_with("%%EOF\n"));
            }
        }
    }
}
