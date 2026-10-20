//! Server policy never guesses browser permission. History carries safe metadata,
//! not stored bearer URLs; the existing export owner mints current-session leases.
use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::BTreeMap;
use uuid::Uuid;

pub(crate) const ROW_LIMIT: usize = 2_000;
const CURSOR_LIMIT: usize = 512;
pub(crate) fn policy(origin: &str) -> Value {
    json!({"kind":"web","authFlow":"browser_redirect","notifications":"browser","localFileImport":false,"deepLinkScheme":origin,"downloadsViaBff":true,"offlineDomainActions":false,"businessPagesNoIndex":true,"cspEnforced":true,"sessionProtected":true,
    "permissionState":{"notifications":"unknown","clipboard":"unknown","authority":"browser_runtime","requestedByServer":false},"fallbacks":["notification_in_app","clipboard_manual","download_retry","online_only"],"downloadLinkTtlSeconds":300,"downloadHistoryIncludesLinks":false})
}

pub(crate) fn lease_expiry(
    now: DateTime<Utc>,
    retention: DateTime<Utc>,
    session: DateTime<Utc>,
) -> Option<DateTime<Utc>> {
    let until = (now + Duration::seconds(300)).min(retention).min(session);
    (until > now).then_some(until)
}

#[derive(Debug, Default, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct HistoryQuery {
    pub cursor: Option<String>,
    pub page_size: Option<usize>,
    pub sort: Option<String>,
    pub filter: Option<String>,
}
#[derive(Debug, PartialEq)]
pub(crate) enum Fault {
    Invalid,
    Cursor,
    Unavailable,
}
fn timestamp(v: &Value, key: &str) -> Result<DateTime<Utc>, Fault> {
    DateTime::parse_from_rfc3339(v[key].as_str().ok_or(Fault::Unavailable)?)
        .map(|t| t.with_timezone(&Utc))
        .map_err(|_| Fault::Unavailable)
}
/// Explicit projection: no source label/reason/watermark/storage key/session/URL.
pub(crate) fn record(job: &Value, now: DateTime<Utc>, can_download: bool) -> Result<Value, Fault> {
    let id = job["exportId"]
        .as_str()
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or(Fault::Unavailable)?;
    let correlation = job["correlationId"]
        .as_str()
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or(Fault::Unavailable)?;
    let requested = timestamp(job, "requestedAt")?;
    let until = timestamp(job, "retentionUntil")?;
    let format = job["format"]
        .as_str()
        .filter(|s| matches!(*s, "csv" | "jsonl" | "pdf"))
        .ok_or(Fault::Unavailable)?;
    let status = if until <= now {
        "expired"
    } else {
        match job["status"].as_str() {
            Some("queued" | "running" | "generating" | "cancel_requested") => "preparing",
            Some("ready") => "ready",
            Some("failed" | "cancelled") => "failed",
            Some("expired") => "expired",
            _ => return Err(Fault::Unavailable),
        }
    };
    let mut result = json!({"downloadId":id,"objectLabel":"受控审计导出","format":format,"requestedAt":requested.to_rfc3339(),"status":status,"expiresAt":until.to_rfc3339(),"watermarked":true,"correlationId":correlation});
    if status == "ready" && can_download {
        result["downloadPath"] = json!(format!("/v1/exports/{id}/download"));
    }
    Ok(result)
}
#[derive(Debug)]
struct Cursor {
    binding: String,
    query: String,
    revision: String,
    offset: usize,
    until: DateTime<Utc>,
}
#[derive(Debug, Default)]
pub(crate) struct History {
    cursors: BTreeMap<String, Cursor>,
}
impl History {
    pub(crate) fn page(
        &mut self,
        binding: &str,
        mut items: Vec<Value>,
        q: HistoryQuery,
        now: DateTime<Utc>,
    ) -> Result<Value, Fault> {
        if items.len() > ROW_LIMIT {
            return Err(Fault::Unavailable);
        }
        // Recheck deadlines after a blocking source read, before page/revision selection.
        for item in &mut items {
            let until = timestamp(item, "expiresAt")?;
            if until <= now {
                item["status"] = json!("expired");
                item.as_object_mut()
                    .ok_or(Fault::Unavailable)?
                    .remove("downloadPath");
            }
        }
        let size = q.page_size.unwrap_or(50);
        if !(1..=200).contains(&size) {
            return Err(Fault::Invalid);
        }
        let sort = q.sort.as_deref().unwrap_or("requestedAt:desc");
        let (field, direction) = sort.split_once(':').ok_or(Fault::Invalid)?;
        if !matches!(
            field,
            "downloadId" | "requestedAt" | "status" | "expiresAt" | "correlationId"
        ) || !matches!(direction, "asc" | "desc")
        {
            return Err(Fault::Invalid);
        }
        if let Some(filter) = &q.filter {
            let parts = filter.splitn(3, ':').collect::<Vec<_>>();
            if parts.len() != 3
                || parts[1] != "eq"
                || !matches!(parts[0], "downloadId" | "status" | "correlationId")
            {
                return Err(Fault::Invalid);
            }
            items.retain(|v| v[parts[0]].as_str() == Some(parts[2]));
        }
        items.sort_by(|a, b| {
            let order = a[field]
                .as_str()
                .cmp(&b[field].as_str())
                .then_with(|| a["downloadId"].as_str().cmp(&b["downloadId"].as_str()));
            if direction == "desc" {
                order.reverse()
            } else {
                order
            }
        });
        let query = serde_json::to_string(&(size, sort, &q.filter)).map_err(|_| Fault::Invalid)?;
        let revision =
            crate::audit_core::digest(&serde_json::to_vec(&items).map_err(|_| Fault::Unavailable)?);
        self.cursors.retain(|_, c| c.until > now);
        let (offset, until) = if let Some(token) = q.cursor {
            let c = self.cursors.get(&token).ok_or(Fault::Cursor)?;
            if c.binding != binding || c.query != query || c.revision != revision {
                return Err(Fault::Cursor);
            }
            (c.offset, c.until)
        } else {
            (0, now + Duration::seconds(60))
        };
        let end = (offset + size).min(items.len());
        let mut result = json!({"items":items[offset..end]});
        if end < items.len() {
            if self.cursors.len() >= CURSOR_LIMIT {
                return Err(Fault::Unavailable);
            }
            let token = Uuid::new_v4().to_string();
            self.cursors.insert(
                token.clone(),
                Cursor {
                    binding: binding.to_owned(),
                    query,
                    revision,
                    offset: end,
                    until,
                },
            );
            result["nextCursor"] = json!(token);
        }
        Ok(result)
    }
}

#[cfg(test)]
mod tests;
