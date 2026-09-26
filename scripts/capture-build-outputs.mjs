import fs from 'node:fs';
import path from 'node:path';
import { digest, files } from './f01-lib.mjs';

// Preserve the exact bytes covered by the receipt before deleting the workspace.
// Never merge into an older snapshot or silently archive changed output.
export function captureBuildOutputs(workspace, inventory, validated, destination) {
    fs.mkdirSync(destination);
    for (const item of inventory.js) {
        const target = path.join(destination, item.directory);
        fs.cpSync(path.join(workspace, item.output), target, { recursive: true });
        const expected = validated.typescript.find(entry => entry.directory === item.directory);
        if (!expected || digest(files(target), target).sha256 !== expected.sha256)
            throw new Error(`Captured output differs from receipt: ${item.directory}`);
    }
}
