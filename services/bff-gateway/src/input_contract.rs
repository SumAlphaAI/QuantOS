//! Reference-provider request constraints generated from the same OpenAPI as the client.
use crate::{ProviderData, authenticate, error, mutation_guard};
use axum::{
    body::{Body, to_bytes},
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use serde_json::Value;
use std::sync::{Arc, OnceLock};
use tokio::sync::Mutex;

fn policy() -> &'static Value {
    static POLICY: OnceLock<Value> = OnceLock::new();
    POLICY.get_or_init(|| {
        serde_json::from_str(include_str!("generated-input-policy.json"))
            .expect("generated OpenAPI input policy")
    })
}
fn valid(schema: &Value, value: &Value) -> bool {
    if let Some(reference) = schema["$ref"].as_str() {
        return valid(
            &policy()["schemas"][reference.rsplit('/').next().unwrap()],
            value,
        );
    }
    if let Some(choices) = schema["enum"].as_array()
        && !choices.contains(value)
    {
        return false;
    }
    match schema["type"].as_str() {
        Some("object") => {
            let Some(object) = value.as_object() else {
                return false;
            };
            if schema["required"].as_array().is_some_and(|keys| {
                keys.iter()
                    .any(|k| !object.contains_key(k.as_str().unwrap()))
            }) {
                return false;
            }
            for (key, value) in object {
                if let Some(property) = schema["properties"].get(key) {
                    if !valid(property, value) {
                        return false;
                    }
                } else if schema["additionalProperties"] == false
                    || schema["additionalProperties"].is_object()
                        && !valid(&schema["additionalProperties"], value)
                {
                    return false;
                }
            }
        }
        Some("array") => {
            let Some(items) = value.as_array() else {
                return false;
            };
            if schema["minItems"]
                .as_u64()
                .is_some_and(|min| items.len() < (min as usize))
                || schema["maxItems"]
                    .as_u64()
                    .is_some_and(|max| items.len() > (max as usize))
            {
                return false;
            }
            if items.iter().any(|v| !valid(&schema["items"], v)) {
                return false;
            }
        }
        Some("string") => {
            let Some(text) = value.as_str() else {
                return false;
            };
            if schema["minLength"]
                .as_u64()
                .is_some_and(|min| text.chars().count() < (min as usize))
                || schema["maxLength"]
                    .as_u64()
                    .is_some_and(|max| text.chars().count() > (max as usize))
            {
                return false;
            }
            if schema["format"] == "uuid" && uuid::Uuid::parse_str(text).is_err() {
                return false;
            }
            if let Some(pattern) = schema["pattern"].as_str() {
                let regex = regex::RegexBuilder::new(pattern)
                    .unicode(false)
                    .build()
                    .expect("generated pattern");
                if !regex.is_match(text) {
                    return false;
                }
            }
            if schema["format"] == "date-time"
                && chrono::DateTime::parse_from_rfc3339(text).is_err()
            {
                return false;
            }
        }
        Some("boolean") => {
            if !value.is_boolean() {
                return false;
            }
        }
        Some("integer") => {
            if !value.is_i64() && !value.is_u64() {
                return false;
            }
        }
        Some("number") => {
            if !value.is_number() {
                return false;
            }
        }
        _ => {}
    }
    if let Some(number) = value.as_f64()
        && (schema["minimum"].as_f64().is_some_and(|min| number < min)
            || schema["maximum"].as_f64().is_some_and(|max| number > max))
    {
        return false;
    }
    true
}
fn route_matches(template: &str, path: &str) -> bool {
    let a = template.split('/').collect::<Vec<_>>();
    let b = path.split('/').collect::<Vec<_>>();
    a.len() == b.len()
        && a.iter()
            .zip(b.iter())
            .all(|(x, y)| x.starts_with('{') || x == y)
}
pub(crate) async fn guard(
    State(data): State<Arc<Mutex<ProviderData>>>,
    request: Request,
    next: Next,
) -> Response {
    let Some(op) = policy()["operations"]
        .as_array()
        .unwrap()
        .iter()
        .find(|op| {
            op["method"] == request.method().as_str()
                && route_matches(op["path"].as_str().unwrap(), request.uri().path())
        })
    else {
        return next.run(request).await;
    };
    let write = matches!(
        request.method().as_str(),
        "POST" | "PUT" | "DELETE" | "PATCH"
    );
    if op["authenticated"] == true {
        let result = if write {
            mutation_guard(request.headers(), &data).await
        } else {
            authenticate(request.headers(), &data).await
        };
        if let Err(response) = result {
            return response;
        }
    }
    let mut query = std::collections::BTreeMap::new();
    for (key, value) in url::form_urlencoded::parse(request.uri().query().unwrap_or("").as_bytes())
    {
        if query.insert(key.into_owned(), value.into_owned()).is_some() {
            return error(
                StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_REQUEST",
                "重复查询参数。 ",
            );
        }
    }
    for parameter in op["parameters"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|p| p["in"] == "query")
    {
        let name = parameter["name"].as_str().unwrap();
        if let Some(value) = query.get(name) {
            let value = if parameter["schema"]["type"] == "integer" {
                value.parse::<i64>().map(Value::from).unwrap_or(Value::Null)
            } else {
                Value::String(value.clone())
            };
            if !valid(&parameter["schema"], &value) {
                return error(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "INVALID_REQUEST",
                    "查询参数未通过契约校验。",
                );
            }
        } else if parameter["required"] == true {
            return error(
                StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_REQUEST",
                "缺少必需查询参数。",
            );
        }
    }
    for (name, key) in [("sort", "sort"), ("filter", "filter")] {
        if let Some(value) = query.get(name) {
            let parts = value.splitn(3, ':').collect::<Vec<_>>();
            let allowed = op["policy"][key].as_array().is_some_and(|fields| {
                fields
                    .iter()
                    .any(|field| field.as_str() == parts.first().copied())
            });
            let shape = if name == "sort" {
                parts.len() == 2 && matches!(parts[1], "asc" | "desc")
            } else {
                parts.len() == 3 && parts[1] == "eq" && !parts[2].is_empty()
            };
            if !allowed || !shape {
                return error(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "INVALID_REQUEST",
                    "排序或筛选条件未获允许。",
                );
            }
        }
    }
    for parameter in op["parameters"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|p| p["in"] == "header")
    {
        let name = parameter["name"].as_str().unwrap();
        if let Some(value) = request.headers().get(name).and_then(|v| v.to_str().ok()) {
            if !valid(&parameter["schema"], &Value::String(value.to_owned())) {
                return error(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "INVALID_REQUEST",
                    "请求未通过契约校验。",
                );
            }
        } else if parameter["required"] == true {
            return error(
                if name == "X-Reauth-Token-Ref" {
                    StatusCode::FORBIDDEN
                } else {
                    StatusCode::UNPROCESSABLE_ENTITY
                },
                "INVALID_REQUEST",
                "请求缺少必需信息。",
            );
        }
    }
    if write {
        let (parts, body) = request.into_parts();
        let Ok(bytes) = to_bytes(body, 65536).await else {
            return error(
                StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_REQUEST",
                "请求超出大小限制。",
            );
        };
        if !op["body"].is_null() {
            let Ok(value) = serde_json::from_slice::<Value>(&bytes) else {
                return error(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "INVALID_REQUEST",
                    "请求未通过契约校验。",
                );
            };
            if !valid(&op["body"], &value) {
                return error(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "INVALID_REQUEST",
                    "请求未通过契约校验。",
                );
            }
        } else if !bytes.is_empty() {
            return error(
                StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_REQUEST",
                "请求不允许正文。",
            );
        }
        return next
            .run(Request::from_parts(parts, Body::from(bytes)))
            .await;
    }
    next.run(request).await
}
