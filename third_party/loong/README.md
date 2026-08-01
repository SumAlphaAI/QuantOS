# TP13 Read-Only Reference

This directory holds the evaluation baseline for `eastreams/loong`.

## Purpose

- lock the upstream repository, commit, license, and descriptor digests;
- store the protocol/UX comparison and adoption decision inputs for TP13;
- record a reproducible reference without any upstream type entering the QuantOS protocol or core.

## Files

- `baseline.lock.json`: authoritative baseline metadata for TP13 monitoring.
- `protocol-ux-comparison.md`: comparison across session, workflow, tool, memory, permissions, audit (plus protocol, runtime, UX).

## Rebuild procedure

```bash
git init loong-readonly
git -C loong-readonly remote add upstream https://github.com/eastreams/loong.git
git -C loong-readonly fetch upstream 3ab7936638e4772c1db95ebee7f5f643852697c2
git -C loong-readonly checkout --detach 3ab7936638e4772c1db95ebee7f5f643852697c2
```

## Hard boundary

`third_party/loong/` is not a production source tree. Loong is evaluated for design ideas only (protocol/Runtime/UI). No Loong crate, type, or schema may enter QuantOS `proto/`, `crates/quantos-core`, or any lockfile.
