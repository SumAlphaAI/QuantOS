//! Browser-visible APIs and content share one configured HTTPS BFF origin.
//! Never infer it from Host, Forwarded, a request URL or the Terminal origin.
use axum::{
    http::header,
    response::{IntoResponse, Response},
};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub(crate) struct DownloadOrigin(String);
impl DownloadOrigin {
    pub(crate) fn parse(raw: &str) -> anyhow::Result<Self> {
        let url = url::Url::parse(raw)?;
        anyhow::ensure!(
            url.scheme() == "https"
                && url.host_str().is_some()
                && url.username().is_empty()
                && url.password().is_none()
                && url.path() == "/"
                && url.query().is_none()
                && url.fragment().is_none()
                && !raw.contains(['\\', '\n', '\r', '\t'])
                && (raw == url.origin().ascii_serialization()
                    || raw == format!("{}/", url.origin().ascii_serialization())),
            "download origin must be a canonical HTTPS origin without path, credentials, query or fragment"
        );
        Ok(Self(url.origin().ascii_serialization()))
    }
    pub(crate) fn url(&self, ticket: Uuid, signature: &str) -> String {
        format!("{}/_bff/export-content/{ticket}/{signature}", self.0)
    }
}

pub(crate) fn content_response(bytes: Vec<u8>, media: String) -> Response {
    (
        [
            (header::CONTENT_TYPE, media),
            (header::CACHE_CONTROL, "no-store".to_owned()),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=quantos-audit-export".to_owned(),
            ),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff".to_owned()),
            (header::REFERRER_POLICY, "no-referrer".to_owned()),
        ],
        bytes,
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn origin_is_closed_and_never_a_caller_controlled_url_prefix() {
        for invalid in [
            "http://localhost:4010",
            "https://user:b@bff.test",
            "https://bff.test/path",
            "https://bff.test/?x=1",
            "https://bff.test/#x",
            "https://bff.test\\evil",
            "https://bff.test\n",
            "https://bff.test:443",
            "https://BFF.test",
            "https://@bff.test",
        ] {
            assert!(DownloadOrigin::parse(invalid).is_err(), "{invalid:?}");
        }
        let ticket = Uuid::nil();
        for origin in [
            "https://bff.test",
            "https://bff.test/",
            "https://127.0.0.1:8443",
        ] {
            assert!(
                DownloadOrigin::parse(origin)
                    .unwrap()
                    .url(ticket, &"a".repeat(64))
                    .starts_with(origin.trim_end_matches('/'))
            );
        }
    }
}
