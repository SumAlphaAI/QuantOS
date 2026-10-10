from fractions import Fraction
from decimal import Decimal, ROUND_HALF_EVEN
from pathlib import Path
import json
root=Path.cwd()
fixture=json.loads((root/'third_party/qlib/fixture.json').read_text())
labels=[]
for symbol in fixture['symbols']:
 rows=[r for r in fixture['rows'] if r['symbol']==symbol]
 labels.extend(abs(Fraction(rows[i+1]['close'],rows[i]['close'])-1) for i in range(4,11))
mean=sum(labels,Fraction(0))/len(labels)
rounded=str((Decimal(mean.numerator)/Decimal(mean.denominator)).quantize(Decimal('0.00000001'),rounding=ROUND_HALF_EVEN))
p=next((root/'third_party/qlib/mappings/objects').glob('tp08-metrics-*.json'))
assert json.loads(p.read_text())['mean_absolute_error']==rounded=='0.02485689'
assert len(labels)==21
record={'schema':'quantos-tp08-independent-metric-oracle/v1','status':'PASS','formalAccepted':False,'method':'exact rational arithmetic on fixture next-day labels; independent of experiments.py Decimal accumulation','samples':len(labels),'exactFraction':str(mean),'roundedMAE':rounded,'metricsFile':str(p.relative_to(root))}
(root/'docs/audit/evidence/tp08-20261010/independent-oracle.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record))
