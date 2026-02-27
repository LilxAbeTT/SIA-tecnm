import zipfile
import xml.etree.ElementTree as ET
import sys
import os

def extract_text_from_docx(docx_path):
    try:
        doc = zipfile.ZipFile(docx_path)
        xml_content = doc.read('word/document.xml')
        doc.close()
        tree = ET.XML(xml_content)
        
        NAMESPACE = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
        TEXT = NAMESPACE + 't'
        P = NAMESPACE + 'p'
        
        paragraphs = []
        for paragraph in tree.iter(P):
            texts = [node.text for node in paragraph.iter(TEXT) if node.text]
            if texts:
                paragraphs.append(''.join(texts))
        return '\n'.join(paragraphs)
    except Exception as e:
        return str(e)

if __name__ == '__main__':
    path = r"c:\Users\larr_\Documents\SIA-tecnm-main\BancoPreguntas_SIA_v2.docx"
    content = extract_text_from_docx(path)
    with open('c:\\Users\\larr_\\Documents\\SIA-tecnm-main\\tmp_preguntas.txt', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Extracted to tmp_preguntas.txt")
