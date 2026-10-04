use axum::{Router,body::Body,http::{Request,HeaderValue,HeaderName,Method,header}};
use tower::ServiceExt;
use tower_http::cors::CorsLayer;
fn source_cors() -> CorsLayer { let origin_header=HeaderValue::from_static("https://terminal.example.invalid"); CorsLayer::new()
                .allow_origin(origin_header)
                .allow_credentials(true)
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::PUT,
                    Method::DELETE,
                    Method::OPTIONS,
                ])
                .allow_headers([
                    header::AUTHORIZATION,
                    header::CONTENT_TYPE,
                    HeaderName::from_static("x-account-id"),
                    HeaderName::from_static("x-csrf-token"),
                    HeaderName::from_static("idempotency-key"),
                    HeaderName::from_static("if-match"),
                    HeaderName::from_static("x-request-id"),
                    HeaderName::from_static("x-correlation-id"),
                    HeaderName::from_static("traceparent"),
                ])
                .expose_headers([HeaderName::from_static("x-correlation-id")]) }
async fn preflight(headers:&str)->String {
 let response=Router::new().layer(source_cors()).oneshot(Request::builder().method("OPTIONS").uri("/v1/settings/sessions/session-remote").header("origin","https://terminal.example.invalid").header("access-control-request-method","DELETE").header("access-control-request-headers",headers).body(Body::empty()).unwrap()).await.unwrap();
 response.headers().get("access-control-allow-headers").unwrap().to_str().unwrap().to_owned()
}
#[tokio::test] async fn declared_common_headers_are_allowed(){let allowed=preflight("x-csrf-token,idempotency-key,x-request-id").await;for name in ["x-csrf-token","idempotency-key","x-request-id"]{assert!(allowed.contains(name));}}
#[tokio::test] async fn required_recent_auth_header_is_allowed(){let allowed=preflight("x-csrf-token,idempotency-key,x-request-id,x-reauth-token-ref").await;println!("access-control-allow-headers: {allowed}");assert!(allowed.contains("x-reauth-token-ref"),"OpenAPI/consumer/live recent-auth header must be allowed by preflight");}
