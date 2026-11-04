"""Read-only validation of the delivered OpenXML package."""
import sys
import zipfile
import xml.etree.ElementTree as ET

MAIN = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
with zipfile.ZipFile(sys.argv[1]) as package:
    assert package.testzip() is None, 'ZIP CRC validation failed'
    roots = {name: ET.fromstring(package.read(name)) for name in package.namelist()}
    styles = roots['xl/styles.xml']
    style_count = len(styles.find(MAIN + 'cellXfs'))
    workbook = roots['xl/workbook.xml']
    sheets = workbook.find(MAIN + 'sheets')
    assert len(sheets) == 6
    for i in range(1, 7):
        sheet = roots[f'xl/worksheets/sheet{i}.xml']
        assert sheet.find(MAIN + 'pageSetup').attrib['paperSize'] == '9'
        for cell in sheet.iter(MAIN + 'c'):
            assert 0 <= int(cell.attrib['s']) < style_count
            assert cell.attrib.get('t') != 'e', 'Cached Excel error'
            if cell.find(MAIN + 'f') is not None:
                assert cell.find(MAIN + 'v') is not None, 'Missing formula cache'
    assert len(workbook.find(MAIN + 'definedNames')) == 11
    print('Valid ZIP CRC, XML, style indexes, 6 sheets, formula caches and A4 print settings')
