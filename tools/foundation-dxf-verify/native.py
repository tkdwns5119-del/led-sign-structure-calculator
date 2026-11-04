"""Open only generated test files in a separate, hidden AutoCAD Core Console."""
from pathlib import Path
import subprocess
import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')
here = Path(__file__).resolve().parent
scratch = here / 'tmp'
name = sys.argv[1] if len(sys.argv) > 1 else 'default'
script = scratch / 'verify.scr'
script.write_text('''(princ "\\nFDXF_BEGIN")
(princ (strcat "\\nFDXF_UNITS=" (itoa (getvar "INSUNITS"))))
(setq ss (ssget "_X" '((0 . "DIMENSION"))))
(princ (strcat "\\nFDXF_DIMENSIONS=" (itoa (if ss (sslength ss) 0))))
(setq ss (ssget "_X" '((8 . "FND_COLUMN") (0 . "LWPOLYLINE"))))
(princ (strcat "\\nFDXF_COLUMNS=" (itoa (if ss (sslength ss) 0))))
(setq ss (ssget "_X" '((8 . "FND_COLUMN") (0 . "CIRCLE"))))
(princ (strcat "\\nFDXF_COLUMN_CIRCLES=" (itoa (if ss (sslength ss) 0))))
(if ss (princ (strcat "\\nFDXF_COLUMN_RADIUS=" (rtos (cdr (assoc 40 (entget (ssname ss 0)))) 2 4))))
(setq ss (ssget "_X" '((8 . "FND_PLATE") (0 . "CIRCLE"))))
(if ss (princ (strcat "\\nFDXF_PLATE_RADIUS=" (rtos (cdr (assoc 40 (entget (ssname ss 0)))) 2 4))))
(setq ss (ssget "_X" '((8 . "FND_BOLT_CIRCLE") (0 . "CIRCLE"))))
(if ss (princ (strcat "\\nFDXF_BOLT_CIRCLE_RADIUS=" (rtos (cdr (assoc 40 (entget (ssname ss 0)))) 2 4))))
(setq ss (ssget "_X" '((8 . "FND_ANCHOR") (0 . "CIRCLE"))))
(princ (strcat "\\nFDXF_ANCHORS=" (itoa (if ss (sslength ss) 0))))
(setq ss (ssget "_X" '((0 . "TEXT"))))
(princ (strcat "\\nFDXF_TEXTS=" (itoa (if ss (sslength ss) 0))))
(setq ss (ssget "_X" '((0 . "DIMENSION"))))
(if ss (progn (setq i 0) (repeat (sslength ss) (setq dd (entget (ssname ss i))) (princ (strcat "\\nFDXF_MEASURE=" (rtos (distance (cdr (assoc 13 dd)) (cdr (assoc 14 dd))) 2 4))) (setq i (1+ i))) (princ)))
(setq ss (ssget "_X" '((0 . "TEXT"))))
(if ss (princ (strcat "\\nFDXF_FIRSTTEXT=" (cdr (assoc 1 (entget (ssname ss 0)))))))
_.AUDIT
_N
_.ZOOM
_E
(princ "\\nFDXF_END")
_.QUIT
_Y
''', encoding='ascii')
args = ['C:/Program Files/Autodesk/AutoCAD 2020/accoreconsole.exe', '/i', str(scratch / (name+'.dxf')), '/s', str(script), '/l', 'en-US']
process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
try:
    raw, _ = process.communicate(timeout=60)
except subprocess.TimeoutExpired:
    process.kill(); raw, _ = process.communicate()
    print('Stopped timed-out verification process.')
output = raw.decode('utf-16le', errors='replace').replace('\r','')
(scratch / (name+'-native.log')).write_text(output, encoding='utf-8')
try:
    expected = next(c for c in json.loads((scratch / 'cases.json').read_text(encoding='utf-8')) if c['name'] == name)
    assert process.returncode == 0
    assert 'FDXF_END' in output and '; 오류:' not in output
    assert re.search(r'FDXF_UNITS=4', output)
    columns = int(re.search(r'FDXF_COLUMNS=(\d+)', output)[1])
    measurements = [float(m) for m in re.findall(r'\nFDXF_MEASURE=([\d.]+)', output)]
    assert columns == expected['columnsDrawn']
    for dimension in expected['footing']:
        assert any(abs(dimension - value) < 1e-5 for value in measurements)
    assert re.search(r'전체\s+0건의 오류를 찾아서\s+0건이 수정됨|Total errors found 0', output)
    summary = {'case':name,'nativeExit':0,'units':'mm','columns':columns,'dimensions':measurements,'auditErrors':0}
    if 'plateRadius' in expected:
        for field, marker in [('plateRadius','PLATE_RADIUS'),('columnRadius','COLUMN_RADIUS'),('boltCircleRadius','BOLT_CIRCLE_RADIUS'),('anchorCount','ANCHORS')]:
            value = float(re.search(r'\nFDXF_'+marker+r'=([\d.]+)', output)[1])
            assert abs(value-expected[field]) < 1e-5
            summary[field] = value
        assert re.search(r'\nFDXF_COLUMN_CIRCLES=3\b', output)
    (scratch / (name+'-verified.json')).write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
except Exception:
    print(output[-18000:])
    raise
