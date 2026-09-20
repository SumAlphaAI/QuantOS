"""Adapt pinned pbjson 0.7 output to proto3 open-enum JSON semantics."""
from pathlib import Path
import re

for path in Path('crates/quantos-proto/src/generated').glob('*.serde.rs'):
    source = path.read_text()
    source = re.sub(r'([\w:]+)::try_from\((self\.\w+|v)\)\s*\.map_err\(\|_\| serde::ser::Error::custom\(format!\("Invalid variant \{\}", (?:self\.\w+|v)\)\)\)', r'crate::protojson::enum_value::<\1>(\2).map_err(serde::ser::Error::custom)', source)
    source = re.sub(r'map_\.next_value::<([\w:]+)>\(\)\? as i32', r'map_.next_value::<crate::protojson::OpenEnum<\1>>()?.value', source)
    source = re.sub(r'map_\.next_value::<Vec<([\w:]+)>>\(\)\?\.into_iter\(\)\.map\(\|x\| x as i32\)', r'map_.next_value::<Vec<crate::protojson::OpenEnum<\1>>>()?.into_iter().map(|x| x.value)', source)
    path.write_text("\n".join(line.rstrip() for line in source.splitlines()) + "\n")
