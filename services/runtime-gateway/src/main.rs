use anyhow::Result;
use quantos_core::HealthReport;

fn main() -> Result<()> {
    let report = HealthReport::ready("runtime-gateway");
    println!(
        "{} ready={}",
        report.service,
        if report.ready { "true" } else { "false" }
    );
    Ok(())
}
