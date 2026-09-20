#![allow(clippy::empty_docs, clippy::large_enum_variant)]

pub mod google {
    pub mod protobuf {
        pub use pbjson_types::{Duration, Struct, Timestamp};
    }
}

pub mod quantos {
    pub mod common {
        pub mod v1 {
            include!("generated/quantos.common.v1.rs");
            include!("generated/quantos.common.v1.serde.rs");
        }
    }

    pub mod research {
        pub mod v1 {
            include!("generated/quantos.research.v1.rs");
            include!("generated/quantos.research.v1.serde.rs");
        }
    }

    pub mod strategy {
        pub mod v1 {
            include!("generated/quantos.strategy.v1.rs");
            include!("generated/quantos.strategy.v1.serde.rs");
        }
    }

    pub mod trading {
        pub mod v1 {
            include!("generated/quantos.trading.v1.rs");
            include!("generated/quantos.trading.v1.serde.rs");
        }
    }

    pub mod engine {
        pub mod v1 {
            include!("generated/quantos.engine.v1.rs");
            include!("generated/quantos.engine.v1.serde.rs");
        }
    }

    pub mod events {
        pub mod v1 {
            include!("generated/quantos.events.v1.rs");
            include!("generated/quantos.events.v1.serde.rs");
        }
    }
}
