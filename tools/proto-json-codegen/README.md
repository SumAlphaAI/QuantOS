# quantos-proto-json-codegen

Build-only Rust tool that generates ProtoJSON serde implementations from the protocol descriptor. Invoked by `scripts/generate-proto.sh`; it accepts a descriptor path, writes to `crates/quantos-proto/src/generated`, then invokes `scripts/patch-protojson.py`. It belongs to the Cargo workspace and F01 build-output/reproducibility inventory, but is excluded from runtime release binaries. Validate through `make proto-check` and `make f01-check`.
