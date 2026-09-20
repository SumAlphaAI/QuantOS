use std::io::{self, BufRead};

use prost::Message;
use quantos_proto::{
    quantos::{
        events::v1::EventEnvelope,
        research::v1::{DataSnapshot, ResearchArtifact},
        strategy::v1::{Signal, StrategyRelease},
        trading::v1::{Fill, Order, Position, RiskDecision, TradeCommand, TradeProposal},
    },
    validate_message_metadata,
};

fn decode_hex(value: &str) -> Result<Vec<u8>, String> {
    if !value.len().is_multiple_of(2) {
        return Err("hex input has odd length".into());
    }
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| {
            let pair = std::str::from_utf8(pair).map_err(|error| error.to_string())?;
            u8::from_str_radix(pair, 16).map_err(|error| error.to_string())
        })
        .collect()
}

fn encode_hex(value: &[u8]) -> String {
    value.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    for line in io::stdin().lock().lines() {
        let line = line?;
        let (type_name, encoded) = line.split_once('\t').ok_or("missing fixture type")?;
        let bytes = decode_hex(encoded)?;
        macro_rules! roundtrip {
            ($type:ty) => {{
                let message = <$type>::decode(bytes.as_slice())?;
                validate_message_metadata(&message)?;
                message.encode_to_vec()
            }};
        }
        let output = match type_name {
            "DataSnapshot" => roundtrip!(DataSnapshot),
            "ResearchArtifact" => roundtrip!(ResearchArtifact),
            "StrategyRelease" => roundtrip!(StrategyRelease),
            "Signal" => roundtrip!(Signal),
            "TradeProposal" => roundtrip!(TradeProposal),
            "RiskDecision" => roundtrip!(RiskDecision),
            "TradeCommand" => roundtrip!(TradeCommand),
            "Order" => roundtrip!(Order),
            "Fill" => roundtrip!(Fill),
            "Position" => roundtrip!(Position),
            "EventEnvelope" => roundtrip!(EventEnvelope),
            _ => return Err(format!("unknown fixture type: {type_name}").into()),
        };
        println!("{type_name}\t{}", encode_hex(&output));
    }
    Ok(())
}
