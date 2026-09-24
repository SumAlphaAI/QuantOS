mod live;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    live::serve().await
}
