from pathlib import Path
import ast
import hashlib
import json

root = Path.cwd()
ledgerfile = (
    root / "docs/audit/evidence/bff-fe-001-remediation-20261003/ruff-lineage.json"
)
ledger = json.loads(ledgerfile.read_text())


# Normalize only the documented import splitting/removal and lambda-to-def transformations.
class Normalize(ast.NodeTransformer):
    def visit_Import(self, node):
        return [
            ast.copy_location(ast.Import(names=[alias]), node) for alias in node.names
        ]

    def visit_FunctionDef(self, node):
        if (
            len(node.body) == 1
            and isinstance(node.body[0], ast.Return)
            and not node.decorator_list
        ):
            return ast.Assign(
                targets=[ast.Name(id=node.name, ctx=ast.Store())],
                value=ast.Lambda(args=node.args, body=node.body[0].value),
            )
        return self.generic_visit(node)

    def visit_Module(self, node):
        self.generic_visit(node)
        used = {
            n.id
            for n in ast.walk(node)
            if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load)
        }
        imports = []
        body = []
        for n in node.body:
            if isinstance(n, (ast.Import, ast.ImportFrom)):
                n.names = [
                    a for a in n.names if (a.asname or a.name.split(".")[0]) in used
                ]
                if n.names:
                    imports.append(n)
            else:
                body.append(n)
        node.body = (
            sorted(imports, key=lambda n: ast.dump(n, include_attributes=False)) + body
        )
        return node


for row in ledger:
    old = (root / row["original"]).read_text()
    current = (root / row["file"]).read_text()

    def normal(s):
        return ast.dump(Normalize().visit(ast.parse(s)), include_attributes=False)

    row["normalizedAstEquivalent"] = normal(old) == normal(current)
    row["formattedSha256"] = hashlib.sha256(current.encode()).hexdigest()
    if not row["normalizedAstEquivalent"]:
        print("Mismatch", row["file"])
assert all(r["normalizedAstEquivalent"] for r in ledger)
ledgerfile.write_text(json.dumps(ledger, indent=2) + "\n")
print("PASS", len(ledger), "script AST equivalence after documented transformations")
