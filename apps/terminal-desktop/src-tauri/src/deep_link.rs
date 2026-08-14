use tauri::Url;

const DEFAULT_ROUTE: &str = "/command";
const MAX_CODE_LEN: usize = 512;
const MAX_STATE_LEN: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeepLinkNavigation {
    AuthCallback {
        code: Option<String>,
        state: Option<String>,
        error: Option<String>,
    },
    Reauthorize {
        return_to: &'static str,
    },
}

fn safe_oauth_value(value: &str, max_len: usize) -> bool {
    !value.is_empty()
        && value.len() <= max_len
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~'))
}

/// Converts an external deep link to a closed, local navigation intent.
///
/// The raw URL is never forwarded to the webview. Unknown schemes, credentials,
/// ports, fragments, routes, query keys, and unsafe OAuth values fail closed.
pub fn sanitize_deep_link(url: &Url) -> Option<DeepLinkNavigation> {
    if url.scheme() != "quantos"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.fragment().is_some()
    {
        return None;
    }

    match (url.host_str(), url.path()) {
        (Some("auth"), "/callback") => {
            let mut code = None;
            let mut state = None;
            let mut error = None;
            for (key, value) in url.query_pairs() {
                match key.as_ref() {
                    "code" if code.is_none() && safe_oauth_value(&value, MAX_CODE_LEN) => {
                        code = Some(value.into_owned());
                    }
                    "state" if state.is_none() && safe_oauth_value(&value, MAX_STATE_LEN) => {
                        state = Some(value.into_owned());
                    }
                    "error" if error.is_none() && safe_oauth_value(&value, 64) => {
                        error = Some(value.into_owned());
                    }
                    _ => return None,
                }
            }
            let success = code.is_some() && state.is_some() && error.is_none();
            let denied = error.is_some() && code.is_none() && state.is_none();
            if success || denied {
                Some(DeepLinkNavigation::AuthCallback { code, state, error })
            } else {
                None
            }
        }
        (Some("command"), "") | (Some("command"), "/") if url.query().is_none() => {
            Some(DeepLinkNavigation::Reauthorize {
                return_to: DEFAULT_ROUTE,
            })
        }
        _ => None,
    }
}

pub fn local_navigation_url(base: &Url, navigation: &DeepLinkNavigation) -> Url {
    let mut target = base.clone();
    target.set_fragment(None);
    target.set_query(None);
    match navigation {
        DeepLinkNavigation::AuthCallback { code, state, error } => {
            target.set_path("/auth/callback");
            let mut query = target.query_pairs_mut();
            if let Some(code) = code {
                query.append_pair("code", code);
            }
            if let Some(state) = state {
                query.append_pair("state", state);
            }
            if let Some(error) = error {
                query.append_pair("error", error);
            }
        }
        DeepLinkNavigation::Reauthorize { return_to } => {
            target.set_path("/auth/deep-link");
            target.query_pairs_mut().append_pair("return_to", return_to);
        }
    }
    target
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(value: &str) -> Url {
        Url::parse(value).expect("test URL must parse")
    }

    #[test]
    fn command_deep_link_always_enters_reauthorization_gate() {
        let navigation = sanitize_deep_link(&parse("quantos://command")).unwrap();
        assert_eq!(
            navigation,
            DeepLinkNavigation::Reauthorize {
                return_to: "/command"
            }
        );
        assert_eq!(
            local_navigation_url(&parse("tauri://localhost/"), &navigation).as_str(),
            "tauri://localhost/auth/deep-link?return_to=%2Fcommand"
        );
    }

    #[test]
    fn auth_callback_forwards_only_code_and_matching_state_material() {
        let navigation = sanitize_deep_link(&parse(
            "quantos://auth/callback?code=abc-123&state=state_456",
        ))
        .unwrap();
        assert_eq!(
            local_navigation_url(&parse("http://localhost:3100/"), &navigation).as_str(),
            "http://localhost:3100/auth/callback?code=abc-123&state=state_456"
        );
    }

    #[test]
    fn provider_denial_is_safely_forwarded_without_description() {
        let navigation =
            sanitize_deep_link(&parse("quantos://auth/callback?error=access_denied")).unwrap();
        assert_eq!(
            local_navigation_url(&parse("tauri://localhost/"), &navigation).as_str(),
            "tauri://localhost/auth/callback?error=access_denied"
        );
    }

    #[test]
    fn rejects_unknown_routes_and_url_injection_material() {
        for unsafe_url in [
            "https://command",
            "quantos://evil.example/command",
            "quantos://command?token=secret",
            "quantos://command#fragment",
            "quantos://user:pass@command",
            "quantos://auth/callback?code=ok&state=ok&next=https%3A%2F%2Fevil.example",
            "quantos://auth/callback?code=contains%2Fslash&state=ok",
            "quantos://auth/callback?code=ok",
            "quantos://auth/callback?error=access_denied&error_description=secret",
        ] {
            assert_eq!(sanitize_deep_link(&parse(unsafe_url)), None, "{unsafe_url}");
        }
    }
}
