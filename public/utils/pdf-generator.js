
/**
 * PDFGenerator - Utility for generating medical documents
 * Uses jsPDF (loaded via CDN in index.html)
 */

const PDFGenerator = (() => {

    function generateReceta(data) {
        if (!window.jspdf) {
            console.error("jsPDF library not loaded!");
            alert("Error: Librería PDF no cargada. Verifique su conexión.");
            return;
        }
        const { jsPDF } = window.jspdf;

        const doc = new jsPDF();

        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let y = 20;

        // --- HEADER ---
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 51, 102); // Dark Blue
        doc.text("TECNM - Servicio Médico", margin, y);

        y += 10;
        const splitMeds = doc.splitTextToSize(data.meds, pageWidth - (margin * 2));
        doc.text(splitMeds, margin, y);

        // --- FOOTER ---
        const pageHeight = doc.internal.pageSize.getHeight();
        y = pageHeight - 40;

        doc.setDrawColor(0);
        doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y); // Signature line

        y += 5;
        doc.setFontSize(10);
        doc.text("Firma del Médico", pageWidth / 2, y, { align: 'center' });

        // Save
        const filename = `Receta_${data.patientName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
        doc.save(filename);
    }

    return {
        generateReceta
    };

})();

window.PDFGenerator = PDFGenerator;
