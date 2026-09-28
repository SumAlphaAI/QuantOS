mod live;
mod startup;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    live::serve().await
}
