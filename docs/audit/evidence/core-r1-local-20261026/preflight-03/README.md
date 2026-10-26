# Evidence wrapper diagnostic

The first outer verification exited 1 at deepStrictEqual(manifest.files paths, files(directory)).
Python sorted Path objects by components, while JavaScript sorted full path strings;
for example `r1-browser.json` and `r1-browser/…` appeared in different positions.
This affected only outer inventory ordering, not candidate test outcomes or hashes.
The original generated manifest is preserved as initial-manifest.json. The final
manifest sorts full path strings, matching the verifier. No functional tests were
rerun or promoted because of this wrapper correction.
