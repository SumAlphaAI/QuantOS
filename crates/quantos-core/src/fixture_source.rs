//! Source identity for owned fixtures in checkouts and F01 source archives.
use std::{io, path::Path, process::Command};

/// Use HEAD in a checkout; a Git-free archive must supply its frozen source SHA.
/// This identifies fixture input, and does not attest deployment or acceptance.
pub fn fixture_source_commit(root: &Path, archive_sha: Option<&str>) -> io::Result<String> {
    let invalid = || {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "fixture source SHA unavailable or inconsistent",
        )
    };
    let valid = |sha: &str| {
        sha.len() == 40
            && sha
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
            && sha.bytes().any(|b| b != b'0')
    };
    if let Some(sha) = archive_sha
        && !valid(sha)
    {
        return Err(invalid());
    }
    if root.join(".git").exists() {
        let git = Command::new("git")
            .args(["rev-parse", "HEAD"])
            .current_dir(root)
            .output()?;
        if !git.status.success() {
            return Err(invalid());
        }
        let sha = String::from_utf8(git.stdout).map_err(|_| invalid())?;
        let sha = sha.trim();
        if !valid(sha) || archive_sha.is_some_and(|expected| expected != sha) {
            return Err(invalid());
        }
        return Ok(sha.to_owned());
    }
    archive_sha.map(str::to_owned).ok_or_else(invalid)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn git_free_archive_requires_a_valid_frozen_sha() {
        let root =
            std::env::temp_dir().join(format!("quantos-fixture-source-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let sha = "1234567890abcdef1234567890abcdef12345678";
        assert_eq!(fixture_source_commit(&root, Some(sha)).unwrap(), sha);
        for input in [
            None,
            Some(""),
            Some("short"),
            Some("0000000000000000000000000000000000000000"),
            Some("G234567890abcdef1234567890abcdef12345678"),
        ] {
            assert!(fixture_source_commit(&root, input).is_err());
        }
        // A damaged checkout must not be relabeled as a valid source archive.
        std::fs::create_dir(root.join(".git")).unwrap();
        assert!(fixture_source_commit(&root, Some(sha)).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn checkout_sha_cannot_be_overridden_by_archive_input() {
        let root =
            std::env::temp_dir().join(format!("quantos-fixture-checkout-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        assert!(
            Command::new("git")
                .args(["init", "--quiet"])
                .current_dir(&root)
                .status()
                .unwrap()
                .success()
        );
        assert!(
            Command::new("git")
                .args([
                    "-c",
                    "user.name=QuantOSFixture",
                    "-c",
                    "user.email=fixture@example.invalid",
                    "commit",
                    "--quiet",
                    "--allow-empty",
                    "-m",
                    "source fixture"
                ])
                .current_dir(&root)
                .status()
                .unwrap()
                .success()
        );
        let sha = fixture_source_commit(&root, None).unwrap();
        assert_eq!(fixture_source_commit(&root, Some(&sha)).unwrap(), sha);
        let other = if sha.starts_with('a') {
            "b".repeat(40)
        } else {
            "a".repeat(40)
        };
        assert!(fixture_source_commit(&root, Some(&other)).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
}
