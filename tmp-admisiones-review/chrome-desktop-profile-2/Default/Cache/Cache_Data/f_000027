/**
 * PDFGenerator - Utility for generating medical documents
 * Uses jsPDF (loaded via CDN in index.html)
 */
const PDFGenerator = (() => {

  // Función interna para validar si jsPDF existe
  function _checkLibrary() {
    if (!window.jspdf) {
      console.error("jsPDF library not loaded!");
      alert("Error: Librería PDF no cargada. Verifique su conexión.");
      return false;
    }
    return true;
  }

  const RX_TEMPLATE_SIZE = { width: 543, height: 768 };
  const _imageCache = new Map();

  function _resolveAssetUrl(path) {
    if (!path) return '';
    if (/^(data:|https?:)/i.test(path)) return path;

    const normalized = String(path).startsWith('/')
      ? String(path)
      : `/${String(path).replace(/^\/+/, '')}`;

    return new URL(normalized, window.location.origin).href;
  }

  async function _loadImageAsDataUrl(path) {
    const assetUrl = _resolveAssetUrl(path);
    if (!assetUrl) return null;
    if (_imageCache.has(assetUrl)) return _imageCache.get(assetUrl);

    const promise = fetch(assetUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`No se pudo cargar la plantilla: ${assetUrl}`);
        return response.blob();
      })
      .then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('No se pudo leer la plantilla.'));
        reader.readAsDataURL(blob);
      }))
      .catch((error) => {
        _imageCache.delete(assetUrl);
        throw error;
      });

    _imageCache.set(assetUrl, promise);
    return promise;
  }

  function _padNumber(value) {
    return String(value).padStart(2, '0');
  }

  function _formatPrescriptionDate(value) {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return `${_padNumber(safeDate.getDate())}-${_padNumber(safeDate.getMonth() + 1)}-${safeDate.getFullYear()}`;
  }

  function _formatAge(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number') return `${value} a\u00F1os`;
    const normalized = String(value).trim();
    if (!normalized) return '';
    if (/^\d+$/.test(normalized)) return `${normalized} a\u00F1os`;
    return normalized;
  }

  function _formatAllergies(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return 'Negadas';
    if (/^(ninguna|ninguno|ningunas|no|sin alergias|negadas?)$/i.test(normalized)) return 'Negadas';
    return normalized;
  }

  function _normalizeMultilineText(value) {
    return String(value || '')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line, index, arr) => line || arr.length === 1 || index < arr.length - 1);
  }

  function _splitPrescriptionLines(doc, text, maxWidth) {
    const sourceLines = _normalizeMultilineText(text);
    if (!sourceLines.length) sourceLines.push('Sin indicaciones adicionales.');

    return sourceLines.flatMap((line) => {
      const safeLine = line || ' ';
      return doc.splitTextToSize(safeLine, maxWidth);
    });
  }

  function _fitSingleLine(doc, text, x, y, maxWidth, options = {}) {
    const {
      font = 'helvetica',
      style = 'normal',
      maxFontSize = 12,
      minFontSize = 8,
      align = 'left'
    } = options;

    const safeText = String(text || '').trim() || '--';
    let fontSize = maxFontSize;
    doc.setFont(font, style);

    while (fontSize > minFontSize) {
      doc.setFontSize(fontSize);
      if (doc.getTextWidth(safeText) <= maxWidth) break;
      fontSize -= 0.25;
    }

    doc.text(safeText, x, y, { align });
    return fontSize;
  }

  function _drawGuideLine(doc, startX, endX, y) {
    doc.setDrawColor(125, 119, 112);
    doc.setLineWidth(1);
    doc.line(startX, y, endX, y);
  }

  function _normalizePrescriptionPayload(data = {}) {
    const student = data.student || {};
    const consultation = data.consultation || {};
    const doctorSource = data.doctor || {};
    const resolvedDoctor = window.MediService?.resolveProfessionalIdentity
      ? MediService.resolveProfessionalIdentity({
        displayName: doctorSource.name || doctorSource.displayName,
        specialty: doctorSource.specialty,
        cedula: doctorSource.cedula,
        cedulaLabel: doctorSource.cedulaLabel,
        phone: doctorSource.phone,
        email: doctorSource.email
      }, doctorSource.role || consultation.role || doctorSource.specialty || 'Medico', doctorSource.shift || consultation.shift || null)
      : {
        displayName: doctorSource.name || doctorSource.displayName || 'Profesional de Salud',
        specialty: doctorSource.specialty || 'Medico General',
        cedula: doctorSource.cedula || '',
        cedulaLabel: doctorSource.cedulaLabel || (doctorSource.cedula ? `CP ${doctorSource.cedula}` : ''),
        phone: doctorSource.phone || '',
        email: doctorSource.email || ''
      };

    return {
      templateUrl: data.templateUrl
        || doctorSource.templateUrl
        || (window.MediService?.getDefaultPrescriptionTemplateUrl
          ? MediService.getDefaultPrescriptionTemplateUrl()
          : '/images/Receta.png'),
      doctor: {
        name: resolvedDoctor.displayName || resolvedDoctor.name || 'Profesional de Salud',
        specialty: resolvedDoctor.specialty || 'Medico General',
        cedula: resolvedDoctor.cedula || '',
        cedulaLabel: resolvedDoctor.cedulaLabel || (resolvedDoctor.cedula ? `CP ${resolvedDoctor.cedula}` : ''),
        phone: resolvedDoctor.phone || '',
        email: resolvedDoctor.email || ''
      },
      student: {
        name: student.name || 'Paciente',
        matricula: student.matricula || '--',
        carrera: student.carrera || '--',
        age: _formatAge(student.age || student.edad || ''),
        allergies: _formatAllergies(student.allergies || student.alergias || '')
      },
      consultation: {
        date: consultation.date instanceof Date ? consultation.date : new Date(consultation.date || Date.now()),
        diagnosis: consultation.diagnosis || '',
        treatment: consultation.treatment || consultation.plan || consultation.diagnosis || 'Sin indicaciones adicionales.',
        signs: consultation.signs || {}
      }
    };
  }

  /**
   * Genera una receta con formato profesional institucional
   */
  const generateProfessionalPrescription = async (data) => {
    if (!_checkLibrary()) return;
    {

    const payload = _normalizePrescriptionPayload(data);
    const { jsPDF: jsPDFPrescription } = window.jspdf;
    const doc = new jsPDFPrescription({
      orientation: 'p',
      unit: 'px',
      format: [RX_TEMPLATE_SIZE.width, RX_TEMPLATE_SIZE.height]
    });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    try {
      const templateData = await _loadImageAsDataUrl(payload.templateUrl);
      if (templateData) {
        doc.addImage(templateData, 'PNG', 0, 0, width, height);
      }
    } catch (error) {
      console.warn('[PDFGenerator] No se pudo cargar la plantilla de receta:', error);
      doc.setFillColor(249, 242, 235);
      doc.rect(0, 0, width, height, 'F');
    }

    doc.setTextColor(42, 41, 41);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(23);
    doc.text('RECETA MEDICA', 52, 53);

    _fitSingleLine(doc, payload.doctor.name, 60, 131, 280, {
      font: 'helvetica',
      style: 'bold',
      maxFontSize: 13.5,
      minFontSize: 10
    });
    _fitSingleLine(doc, payload.doctor.specialty || 'Medico General', 60, 149, 190, {
      font: 'helvetica',
      style: 'normal',
      maxFontSize: 12,
      minFontSize: 9
    });
    _fitSingleLine(doc, _formatPrescriptionDate(payload.consultation.date), 476, 132, 90, {
      font: 'helvetica',
      style: 'normal',
      maxFontSize: 12,
      minFontSize: 10,
      align: 'right'
    });

    doc.setTextColor(58, 55, 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Nombre del Paciente', 37, 193);
    doc.text('Edad', 37, 219);
    doc.text('Alergias', 344, 219);

    _drawGuideLine(doc, 156, 471, 196);
    _drawGuideLine(doc, 71, 164, 221);
    _drawGuideLine(doc, 392, 480, 221);

    _fitSingleLine(doc, payload.student.name, 157, 193, 308, {
      font: 'helvetica',
      style: 'normal',
      maxFontSize: 11,
      minFontSize: 8.5
    });
    _fitSingleLine(doc, payload.student.age || '--', 73, 219, 86, {
      font: 'helvetica',
      style: 'normal',
      maxFontSize: 11,
      minFontSize: 8.5
    });
    _fitSingleLine(doc, payload.student.allergies, 394, 219, 82, {
      font: 'helvetica',
      style: 'normal',
      maxFontSize: 11,
      minFontSize: 8.3
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('PRESCRIPCION', 37, 302);

    doc.setTextColor(46, 44, 43);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    const prescriptionLines = _splitPrescriptionLines(doc, payload.consultation.treatment, 430);
    doc.text(prescriptionLines, 37, 334, { lineHeightFactor: 1.35 });

    doc.setTextColor(70, 65, 61);
    _fitSingleLine(doc, payload.doctor.name, 271.5, 630, 220, {
      font: 'helvetica',
      style: 'normal',
      maxFontSize: 11.5,
      minFontSize: 9,
      align: 'center'
    });
    _fitSingleLine(doc, payload.doctor.cedulaLabel || '--', 271.5, 652, 140, {
      font: 'helvetica',
      style: 'normal',
      maxFontSize: 10.5,
      minFontSize: 8.5,
      align: 'center'
    });

    _fitSingleLine(doc, payload.doctor.phone || '--', 117, 723, 150, {
      font: 'helvetica',
      style: 'normal',
      maxFontSize: 10.5,
      minFontSize: 8.5
    });
    _fitSingleLine(doc, payload.doctor.email || '--', 117, 749, 260, {
      font: 'helvetica',
      style: 'normal',
      maxFontSize: 10,
      minFontSize: 7.8
    });

    const safeMatricula = payload.student.matricula || 'PACIENTE';
    doc.save(`Receta_${safeMatricula}_${Date.now()}.pdf`);
    }
    return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const margin = 20;
    const width = doc.internal.pageSize.width;

    // --- ENCABEZADO ---
    doc.setFillColor(13, 110, 253); // Azul Primario SIA
    doc.rect(0, 0, width, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("SIA - SISTEMA INTEGRAL ACADÉMICO", margin, 18);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("SERVICIO MÉDICO INSTITUCIONAL", margin, 26);
    doc.text("TECNOLÓGICO NACIONAL DE MÉXICO CAMPUS LOS CABOS", margin, 32);

    // --- DATOS MÉDICO ---
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`DR(A). ${data.doctor.name}`, width - margin, 55, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text(data.doctor.specialty, width - margin, 60, { align: 'right' });
    doc.text(data.doctor.email, width - margin, 65, { align: 'right' });

    // --- DATOS PACIENTE (CUADRO) ---
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(margin, 75, width - (margin * 2), 25, 3, 3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("PACIENTE:", margin + 5, 82);
    doc.text("FECHA:", margin + 110, 82);
    doc.setFont("helvetica", "normal");
    doc.text(data.student.name, margin + 30, 82);
    doc.text(data.consultation.date.toLocaleDateString(), margin + 130, 82);

    doc.text(`Matrícula: ${data.student.matricula}`, margin + 5, 90);
    doc.text(`Carrera: ${data.student.carrera}`, margin + 60, 90);

    // --- SIGNOS VITALES ---
    const s = data.consultation.signs || {};
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`P.A: ${s.presion || '--'}  |  Temp: ${s.temp || '--'}°C  |  Peso: ${s.peso || '--'}kg`, margin + 5, 96);

    // --- CUERPO DE LA RECETA ---
    doc.setDrawColor(13, 110, 253);
    doc.setLineWidth(0.5);
    doc.line(margin, 105, width - margin, 105);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DIAGNÓSTICO:", margin, 115);
    doc.setFont("helvetica", "normal");
    const diagLines = doc.splitTextToSize(data.consultation.diagnosis || "No especificado", width - 60);
    doc.text(diagLines, margin + 35, 115);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(13, 110, 253);
    doc.text("Rx / INDICACIONES:", margin, 135);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const treatmentLines = doc.splitTextToSize(data.consultation.treatment || "Sin indicaciones adicionales.", width - (margin * 2));
    doc.text(treatmentLines, margin, 145);

    // --- PIE DE PÁGINA / FIRMA ---
    doc.setDrawColor(200, 200, 200);
    doc.line(width / 2 - 30, 260, width / 2 + 30, 260);
    doc.setFontSize(9);
    doc.text("FIRMA DEL MÉDICO", width / 2, 265, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Esta es una receta digital generada por SIA. Válida como comprobante de atención institucional.", width / 2, 280, { align: 'center' });

    doc.save(`Receta_${data.student.matricula}_${Date.now()}.pdf`);
  };

  /**
   * Generador básico (Fallback)
   */
  function generateReceta(data) {
    console.log("Legacy Generator Called", data);
    // Puedes mantener tu código anterior aquí si lo deseas
  }

  /**
   * Genera el Reporte Vocacional (Ruta Académica)
   */
  const generateVocationalReport = async (data) => {
    if (!_checkLibrary()) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const margin = 20;
    const width = doc.internal.pageSize.width;
    const height = doc.internal.pageSize.height;

    // --- ENCABEZADO ---
    doc.setFillColor(13, 110, 253); // Azul Primario SIA
    doc.rect(0, 0, width, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Reporte de Orientación Vocacional", margin, 20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("SIA - TECNOLÓGICO NACIONAL DE MÉXICO CAMPUS LOS CABOS", margin, 30);

    // --- DATOS DEL ASPIRANTE ---
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Datos del Perfil", margin, 55);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const pInfo = data.personalInfo || {};
    doc.text(`Nombre: ${pInfo.name || 'Aspirante'}`, margin, 65);
    doc.text(`Preparatoria: ${pInfo.highSchool || 'No especificada'}`, margin, 72);
    if (pInfo.technicalCareer) {
      doc.text(`Especialidad Técnica: ${pInfo.technicalCareer}`, margin, 79);
    }

    // --- RESULTADOS TOP 3 ---
    doc.setDrawColor(13, 110, 253);
    doc.setLineWidth(0.5);
    doc.line(margin, 90, width - margin, 90);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(13, 110, 253);
    doc.text("Ruta Académica Sugerida", margin, 102);

    const top3 = data.recommendedCareers || [];
    let currentY = 115;

    top3.forEach((c, idx) => {
      if (idx === 0) {
        // Top 1 Destacado
        doc.setFillColor(240, 248, 255); // Alice blue
        doc.roundedRect(margin, currentY - 8, width - (margin * 2), 25, 3, 3, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`1. ${c.name}`, margin + 5, currentY);
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Área: ${c.type} | Afinidad: ${c.percentage}%`, margin + 5, currentY + 7);
        if (c.isDirectMatch) {
          doc.setTextColor(25, 135, 84); // Success green
          doc.setFontSize(9);
          doc.text("✓ Coincidencia directa con tu especialidad técnica.", margin + 5, currentY + 13);
        }
        currentY += 35;
      } else {
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`${idx + 1}. ${c.name}`, margin, currentY);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Afinidad destacada: ${c.percentage}%`, margin, currentY + 6);
        currentY += 18;
      }
    });

    // --- FECHAS OFICIALES Y CONTACTO ---
    currentY += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, currentY, width - margin, currentY);
    currentY += 15;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Próximos Pasos - Admisión 2026", margin, currentY);

    currentY += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    // Cuadro de fechas
    doc.setFillColor(248, 249, 250);
    doc.rect(margin, currentY, width - (margin * 2), 35, 'F');

    currentY += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Entrega de Fichas:", margin + 5, currentY);
    doc.setFont("helvetica", "normal");
    doc.text("09 de febrero al 30 de abril", margin + 45, currentY);

    currentY += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Examen de Admisión:", margin + 5, currentY);
    doc.setFont("helvetica", "normal");
    doc.text("16 de mayo", margin + 45, currentY);

    currentY += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Curso Propedéutico:", margin + 5, currentY);
    doc.setFont("helvetica", "normal");
    doc.text("6 al 17 de julio", margin + 45, currentY);

    currentY += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Contacto:", margin + 5, currentY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(13, 110, 253);
    doc.text("desarrolloacademico@loscabos.tecnm.mx", margin + 45, currentY);

    // --- PIE DE PÁGINA ---
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.text("Documento orientativo generado por SIA. Este documento no asegura la admisión al instituto.", width / 2, height - 15, { align: 'center' });

    doc.save(`Ruta_Academica_${pInfo.name ? pInfo.name.replace(/\s+/g, '_') : 'Aspirante'}.pdf`);
  };

  // EXPORTACIÓN CRÍTICA
  return {
    generateReceta: generateProfessionalPrescription,
    generateProfessionalPrescription,
    generateVocationalReport,
    generateLactarioReport: async (stats, range) => {
      if (!_checkLibrary()) return;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const width = doc.internal.pageSize.width;

      doc.setFontSize(18);
      doc.text("Reporte de Uso - Lactario SIA", 15, 20);
      doc.setFontSize(12);
      doc.text(`Rango: ${range}`, 15, 30);
      doc.text(`Generado: ${new Date().toLocaleDateString()}`, 15, 36);

      doc.line(15, 40, width - 15, 40);

      // Metrics
      doc.text("Resumen General:", 15, 50);
      doc.setFontSize(10);
      doc.text(`Total Visitas: ${stats.total}`, 20, 60);
      doc.text(`H. Pico: ${stats.peakHour}:00`, 20, 66);
      doc.text(`Promedio Duración: ${stats.averageDuration} min`, 20, 72);

      // Tables (Mockup, ideal to use autoTable)
      doc.text("Detalle por Día:", 15, 85);
      let y = 92;
      Object.entries(stats.visitsByDate).forEach(([day, count]) => {
        doc.text(`${day}: ${count} visitas`, 20, y);
        y += 6;
      });

      doc.save(`Lactario_Reporte_${Date.now()}.pdf`);
    }
  };

})();

window.PDFGenerator = PDFGenerator;

// Exportaciones omitidas para compatibilidad global
