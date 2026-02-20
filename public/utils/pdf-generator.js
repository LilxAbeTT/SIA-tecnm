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

  /**
   * Genera una receta con formato profesional institucional
   */
  const generateProfessionalPrescription = async (data) => {
    if (!_checkLibrary()) return;

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

  // EXPORTACIÓN CRÍTICA
  return {
    generateReceta: generateProfessionalPrescription,
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