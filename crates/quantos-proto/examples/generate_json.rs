//! Run after local buf build; never contacts remote generators.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let descriptor = std::fs::read(std::env::args().nth(1).ok_or("descriptor path required")?)?;
    pbjson_build::Builder::new()
        .out_dir("crates/quantos-proto/src/generated")
        .register_descriptors(&descriptor)?
        .extern_path(".google.protobuf", "::pbjson_types")
        .build(&[".quantos"])?;
    let status = std::process::Command::new("python3")
        .arg("scripts/patch-protojson.py")
        .status()?;
    if !status.success() {
        return Err("ProtoJSON adaptation failed".into());
    }
    Ok(())
}
