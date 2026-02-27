import zipfile
import xml.etree.ElementTree as ET
import sys

def read_docx(file_path):
    try:
        doc = zipfile.ZipFile(file_path)
        xml_content = doc.read('word/document.xml')
        doc.close()
        tree = ET.XML(xml_content)
        WORD_NAMESPACE = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
        paragraphs = []
        for paragraph in tree.iter(WORD_NAMESPACE + 'p'):
            texts = [node.text for node in paragraph.iter(WORD_NAMESPACE + 't') if node.text]
            if texts:
                paragraphs.append(''.join(texts))
        print('\n'.join(paragraphs))
    except Exception as e:
        print("Error reading docx:", e)

if __name__ == '__main__':
    read_docx(sys.argv[1])
