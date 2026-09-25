use std::{env, error::Error, fs, path::PathBuf};

use quantos_engine_manager::{
    EngineApproval, EngineManifest, EngineRoutingPolicy, review_manifest,
};
use sha2::{Digest, Sha256};

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 6 {
        return Err("usage: f08-approval MANIFEST_JSON ROUTING_POLICY_JSON ARTIFACT_FILE REVIEWER OUTPUT_JSON".into());
    }
    let manifest: EngineManifest = serde_json::from_slice(&fs::read(&args[1])?)?;
    review_manifest(&manifest)?;
    let policy: EngineRoutingPolicy = serde_json::from_slice(&fs::read(&args[2])?)?;
    let artifact = fs::read(&args[3])?;
    let artifact_sha256: String = Sha256::digest(artifact)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    let secret = env::var("QUANTOS_ENGINE_APPROVAL_KEY_HEX")
        .map_err(|_| "QUANTOS_ENGINE_APPROVAL_KEY_HEX is required")?;
    if secret.len() < 64 || !secret.len().is_multiple_of(2) {
        return Err("approval key must contain at least 32 bytes of hex".into());
    }
    let key: Vec<u8> = secret
        .as_bytes()
        .chunks_exact(2)
        .map(|part| {
            let text = std::str::from_utf8(part)?;
            Ok(u8::from_str_radix(text, 16)?)
        })
        .collect::<Result<_, Box<dyn Error>>>()?;
    let approval =
        EngineApproval::sign_with_policy(&manifest, &artifact_sha256, &args[4], policy, &key)?;
    let output = PathBuf::from(&args[5]);
    if output.exists() {
        return Err("approval output exists; choose a new path".into());
    }
    fs::write(output, serde_json::to_vec_pretty(&approval)?)?;
    Ok(())
}
