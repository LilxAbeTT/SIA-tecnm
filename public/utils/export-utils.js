/**
 * ExportUtils - Utilidades para exportar reportes a PDF y Excel
 * Formatos profesionales con marcos, gráficas y firmas
 */

window.ExportUtils = (function() {

    // ================= PDF EXPORT =================
    async function generatePDF(config, data, area) {
        try {
            console.log('Iniciando generación de PDF...', { config, dataLength: data.length, area });

            // Verificar librerías
            if (!window.jspdf || !window.jspdf.jsPDF) {
                throw new Error('jsPDF no está cargado. Verifica que la librería esté incluida.');
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'letter'); // Tamaño carta

            // Verificar que autoTable esté disponible
            if (typeof doc.autoTable !== 'function') {
                throw new Error('El plugin jspdf-autotable no está cargado. Verifica que la librería esté incluida DESPUÉS de jsPDF.');
            }

            // Configuración
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;
            const contentWidth = pageWidth - (margin * 2);
            let yPos = margin;

        // ================= PÁGINA 1: PORTADA =================
        drawPageBorder(doc, margin);

        // Logo TecNM (centrado)
        yPos = 30;
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(27, 57, 106); // TecNM Blue
        doc.text('TecNM - ITES Los Cabos', pageWidth / 2, yPos, { align: 'center' });

        yPos += 15;
        doc.setFontSize(18);
        doc.setTextColor(80, 80, 80);
        const areaName = area === 'BIBLIO' ? 'Biblioteca' : 'Servicios Médicos';
        doc.text(`Reporte de ${areaName}`, pageWidth / 2, yPos, { align: 'center' });

        // Fecha y período
        yPos += 20;
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        const periodLabel = getPeriodLabel(config.period);
        doc.text(`Período: ${periodLabel}`, pageWidth / 2, yPos, { align: 'center' });

        yPos += 7;
        const dateStr = new Date().toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        doc.text(`Fecha de generación: ${dateStr}`, pageWidth / 2, yPos, { align: 'center' });

        // Ícono decorativo (simulado con formas)
        yPos += 30;
        doc.setDrawColor(27, 57, 106);
        doc.setFillColor(27, 57, 106);
        doc.circle(pageWidth / 2, yPos, 20, 'S');

        doc.setFillColor(255, 255, 255);
        doc.setFontSize(30);
        doc.setTextColor(255, 255, 255);
        const icon = area === 'BIBLIO' ? '📚' : '⚕️';
        doc.text(icon, pageWidth / 2, yPos + 3, { align: 'center' });

        // Footer institucional
        yPos = pageHeight - 30;
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text('Desarrollo Académico', pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;
        doc.text('Tecnológico Nacional de México', pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;
        doc.text('Campus Los Cabos', pageWidth / 2, yPos, { align: 'center' });

        // ================= PÁGINA 2: RESUMEN EJECUTIVO =================
        doc.addPage();
        yPos = margin;
        drawPageBorder(doc, margin);

        // Título sección
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(27, 57, 106);
        doc.text('1. Resumen Ejecutivo', margin, yPos);

        yPos += 10;
        drawSectionDivider(doc, margin, yPos, contentWidth);
        yPos += 8;

        // Indicadores clave
        const stats = calculateStats(data, config);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);

        // Grid de métricas (2 columnas)
        const col1X = margin + 10;
        const col2X = pageWidth / 2 + 5;
        const rowHeight = 25;

        // Fila 1
        drawMetricBox(doc, col1X, yPos, 'Total de Registros', stats.total.toString(), '#3b82f6');
        drawMetricBox(doc, col2X, yPos, 'Promedio Diario', stats.avgDaily.toFixed(1), '#10b981');

        yPos += rowHeight;

        // Fila 2
        if (area === 'BIBLIO') {
            drawMetricBox(doc, col1X, yPos, 'Visitas', (stats.visitas || 0).toString(), '#f59e0b');
            drawMetricBox(doc, col2X, yPos, 'Préstamos', (stats.prestamos || 0).toString(), '#6366f1');
        } else {
            drawMetricBox(doc, col1X, yPos, 'Consultas Médicas', (stats.medicas || 0).toString(), '#3b82f6');
            drawMetricBox(doc, col2X, yPos, 'Consultas Psicológicas', (stats.psicologicas || 0).toString(), '#0ea5e9');
        }

        yPos += rowHeight + 10;

        // Tabla de distribución por tipo
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Distribución por Tipo', margin, yPos);
        yPos += 5;

        const tableData = Object.entries(stats.byTipo)
            .map(([tipo, count]) => [tipo, count.toString(), `${((count / stats.total) * 100).toFixed(1)}%`]);

        doc.autoTable({
            startY: yPos,
            head: [['Tipo', 'Cantidad', 'Porcentaje']],
            body: tableData,
            margin: { left: margin, right: margin },
            theme: 'grid',
            headStyles: {
                fillColor: [27, 57, 106],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 10
            },
            bodyStyles: {
                fontSize: 9,
                textColor: [60, 60, 60]
            },
            alternateRowStyles: {
                fillColor: [245, 247, 250]
            },
            columnStyles: {
                0: { cellWidth: 80 },
                1: { halign: 'center', cellWidth: 40 },
                2: { halign: 'center', cellWidth: 40 }
            }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // ================= PÁGINA 3: ANÁLISIS DEMOGRÁFICO =================
        doc.addPage();
        yPos = margin;
        drawPageBorder(doc, margin);

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(27, 57, 106);
        doc.text('2. Análisis Demográfico', margin, yPos);

        yPos += 10;
        drawSectionDivider(doc, margin, yPos, contentWidth);
        yPos += 10;

        // Por género
        if (Object.keys(stats.byGenero).length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(60, 60, 60);
            doc.text('Por Género', margin, yPos);
            yPos += 5;

            const generoData = Object.entries(stats.byGenero)
                .map(([genero, count]) => [genero, count.toString(), `${((count / stats.total) * 100).toFixed(1)}%`]);

            doc.autoTable({
                startY: yPos,
                head: [['Género', 'Cantidad', 'Porcentaje']],
                body: generoData,
                margin: { left: margin, right: margin },
                theme: 'grid',
                headStyles: {
                    fillColor: [59, 130, 246],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 10
                },
                bodyStyles: {
                    fontSize: 9,
                    textColor: [60, 60, 60]
                },
                alternateRowStyles: {
                    fillColor: [245, 247, 250]
                }
            });

            yPos = doc.lastAutoTable.finalY + 12;
        }

        // Por carrera (Top 5)
        if (Object.keys(stats.byCarrera).length > 0) {
            if (yPos > pageHeight - 80) {
                doc.addPage();
                yPos = margin;
                drawPageBorder(doc, margin);
            }

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Por Carrera (Top 5)', margin, yPos);
            yPos += 5;

            const carreraData = Object.entries(stats.byCarrera)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([carrera, count]) => [carrera, count.toString(), `${((count / stats.total) * 100).toFixed(1)}%`]);

            doc.autoTable({
                startY: yPos,
                head: [['Carrera', 'Cantidad', 'Porcentaje']],
                body: carreraData,
                margin: { left: margin, right: margin },
                theme: 'grid',
                headStyles: {
                    fillColor: [99, 102, 241],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 10
                },
                bodyStyles: {
                    fontSize: 9,
                    textColor: [60, 60, 60]
                },
                alternateRowStyles: {
                    fillColor: [245, 247, 250]
                }
            });

            yPos = doc.lastAutoTable.finalY + 12;
        }

        // Por generación
        if (Object.keys(stats.byGeneracion).length > 0) {
            if (yPos > pageHeight - 80) {
                doc.addPage();
                yPos = margin;
                drawPageBorder(doc, margin);
            }

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Por Generación', margin, yPos);
            yPos += 5;

            const genData = Object.entries(stats.byGeneracion)
                .sort((a, b) => b[0] - a[0])
                .map(([gen, count]) => [gen.toString(), count.toString(), `${((count / stats.total) * 100).toFixed(1)}%`]);

            doc.autoTable({
                startY: yPos,
                head: [['Generación', 'Cantidad', 'Porcentaje']],
                body: genData,
                margin: { left: margin, right: margin },
                theme: 'grid',
                headStyles: {
                    fillColor: [139, 92, 246],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 10
                },
                bodyStyles: {
                    fontSize: 9,
                    textColor: [60, 60, 60]
                },
                alternateRowStyles: {
                    fillColor: [245, 247, 250]
                }
            });

            yPos = doc.lastAutoTable.finalY + 12;
        }

        // ================= PÁGINA FINAL: FIRMA =================
        doc.addPage();
        yPos = margin;
        drawPageBorder(doc, margin);

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(27, 57, 106);
        doc.text('Validación', margin, yPos);

        yPos += 10;
        drawSectionDivider(doc, margin, yPos, contentWidth);
        yPos += 20;

        // Notas finales
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        const note = `Este documento ha sido generado automáticamente por el Sistema de Integración Académico (SIA) del TecNM Campus Los Cabos. Los datos presentados corresponden al período ${periodLabel} y fueron extraídos el ${dateStr}.`;
        const noteLines = doc.splitTextToSize(note, contentWidth - 20);
        doc.text(noteLines, margin + 10, yPos);

        yPos += (noteLines.length * 5) + 20;

        // Línea de firma
        const signatureY = pageHeight - 60;
        const signatureX = pageWidth / 2;

        doc.setLineWidth(0.5);
        doc.setDrawColor(100, 100, 100);
        doc.line(signatureX - 40, signatureY, signatureX + 40, signatureY);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Responsable de Desarrollo Académico', signatureX, signatureY + 7, { align: 'center' });

        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text('Tecnológico Nacional de México', signatureX, signatureY + 12, { align: 'center' });
        doc.text('Campus Los Cabos', signatureX, signatureY + 17, { align: 'center' });

        // Pie de página en todas las páginas (numeración)
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        }

        // Descargar
        const filename = `Reporte_${area}_${config.period}_${Date.now()}.pdf`;
        console.log('PDF generado exitosamente:', filename);
        doc.save(filename);

        } catch (error) {
            console.error('Error detallado en generatePDF:', error);
            throw error; // Re-lanzar para que sea capturado arriba
        }
    }

    // ================= EXCEL EXPORT =================
    function generateExcel(config, data, area) {
        const workbook = XLSX.utils.book_new();

        // Hoja 1: Resumen
        const summaryData = generateSummarySheet(data, config, area);
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

        // Aplicar estilos (anchos de columna)
        summarySheet['!cols'] = [
            { wch: 30 },
            { wch: 15 },
            { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

        // Hoja 2: Datos detallados
        const detailData = data.map(d => ({
            'Fecha': d.fecha instanceof Date ? d.fecha.toLocaleDateString('es-MX') : d.fecha,
            'Usuario': d.usuario || 'N/A',
            'Matrícula': d.matricula || 'N/A',
            'Área': d.area || 'N/A',
            'Subárea': d.subarea || 'N/A',
            'Tipo': d.tipo || 'N/A',
            'Detalle': d.detalle || 'N/A',
            'Género': d.genero || 'N/A',
            'Carrera': d.carrera || 'N/A',
            'Turno': d.turno || 'N/A',
            'Generación': d.generacion || 'N/A',
            'Diagnóstico': d.diagnostico || 'N/A'
        }));

        const detailSheet = XLSX.utils.json_to_sheet(detailData);

        // Anchos de columna para detalles
        detailSheet['!cols'] = [
            { wch: 12 }, // Fecha
            { wch: 25 }, // Usuario
            { wch: 12 }, // Matrícula
            { wch: 15 }, // Área
            { wch: 15 }, // Subárea
            { wch: 20 }, // Tipo
            { wch: 35 }, // Detalle
            { wch: 12 }, // Género
            { wch: 30 }, // Carrera
            { wch: 12 }, // Turno
            { wch: 12 }, // Generación
            { wch: 30 }  // Diagnóstico
        ];

        XLSX.utils.book_append_sheet(workbook, detailSheet, 'Datos Detallados');

        // Hoja 3: Demográfico
        const demoData = generateDemographicSheet(data);
        const demoSheet = XLSX.utils.aoa_to_sheet(demoData);
        demoSheet['!cols'] = [
            { wch: 25 },
            { wch: 15 },
            { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(workbook, demoSheet, 'Análisis Demográfico');

        // Descargar
        const filename = `Reporte_${area}_${config.period}_${Date.now()}.xlsx`;
        XLSX.writeFile(workbook, filename);
    }

    // ================= HELPER FUNCTIONS =================

    function drawPageBorder(doc, margin) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setDrawColor(27, 57, 106);
        doc.setLineWidth(0.8);
        doc.rect(margin - 5, margin - 5, pageWidth - (margin * 2) + 10, pageHeight - (margin * 2) + 10);

        doc.setLineWidth(0.3);
        doc.rect(margin - 3, margin - 3, pageWidth - (margin * 2) + 6, pageHeight - (margin * 2) + 6);
    }

    function drawSectionDivider(doc, x, y, width) {
        doc.setDrawColor(27, 57, 106);
        doc.setLineWidth(1);
        doc.line(x, y, x + width, y);
    }

    function drawMetricBox(doc, x, y, label, value, color) {
        const boxWidth = 75;
        const boxHeight = 20;

        // Convertir color hex a RGB
        const rgb = hexToRgb(color);

        // Fondo
        doc.setFillColor(rgb.r, rgb.g, rgb.b, 0.1);
        doc.setDrawColor(rgb.r, rgb.g, rgb.b);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'FD');

        // Label
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(label, x + boxWidth / 2, y + 6, { align: 'center' });

        // Value
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(rgb.r, rgb.g, rgb.b);
        doc.text(value, x + boxWidth / 2, y + 15, { align: 'center' });
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    function getPeriodLabel(period) {
        const labels = {
            'daily': 'Día Actual',
            'weekly': 'Semana Actual',
            'monthly': 'Mes Actual',
            'quarterly': 'Trimestre Actual',
            'semester': 'Semestre Actual',
            'annual': 'Año Actual'
        };
        return labels[period] || period;
    }

    function calculateStats(data, config) {
        const stats = {
            total: data.length,
            byTipo: {},
            byGenero: {},
            byCarrera: {},
            byTurno: {},
            byGeneracion: {},
            avgDaily: 0,
            visitas: 0,
            prestamos: 0,
            medicas: 0,
            psicologicas: 0
        };

        data.forEach(item => {
            // Por tipo
            stats.byTipo[item.tipo] = (stats.byTipo[item.tipo] || 0) + 1;

            // Por género
            if (item.genero) stats.byGenero[item.genero] = (stats.byGenero[item.genero] || 0) + 1;

            // Por carrera
            if (item.carrera) stats.byCarrera[item.carrera] = (stats.byCarrera[item.carrera] || 0) + 1;

            // Por turno
            if (item.turno) stats.byTurno[item.turno] = (stats.byTurno[item.turno] || 0) + 1;

            // Por generación
            if (item.generacion) stats.byGeneracion[item.generacion] = (stats.byGeneracion[item.generacion] || 0) + 1;

            // Específicos
            if (item.subarea === 'Visitas') stats.visitas++;
            if (item.subarea === 'Préstamos') stats.prestamos++;
            if (item.tipo === 'Consulta Médica') stats.medicas++;
            if (item.tipo === 'Consulta Psicológica') stats.psicologicas++;
        });

        // Calcular promedio diario
        const days = getDaysInPeriod(config.period);
        stats.avgDaily = days > 0 ? stats.total / days : 0;

        return stats;
    }

    function getDaysInPeriod(period) {
        const map = {
            'daily': 1,
            'weekly': 7,
            'monthly': 30,
            'quarterly': 90,
            'semester': 180,
            'annual': 365
        };
        return map[period] || 30;
    }

    function generateSummarySheet(data, config, area) {
        const stats = calculateStats(data, config);
        const areaName = area === 'BIBLIO' ? 'Biblioteca' : 'Servicios Médicos';

        const summaryData = [
            ['REPORTE DE ' + areaName.toUpperCase()],
            ['TecNM - ITES Los Cabos'],
            [],
            ['Período:', getPeriodLabel(config.period)],
            ['Fecha de generación:', new Date().toLocaleDateString('es-MX')],
            [],
            ['RESUMEN EJECUTIVO'],
            [],
            ['Métrica', 'Valor', 'Unidad'],
            ['Total de Registros', stats.total, 'registros'],
            ['Promedio Diario', stats.avgDaily.toFixed(1), 'registros/día'],
            [],
            ['DISTRIBUCIÓN POR TIPO'],
            [],
            ['Tipo', 'Cantidad', 'Porcentaje'],
            ...Object.entries(stats.byTipo).map(([tipo, count]) => [
                tipo,
                count,
                `${((count / stats.total) * 100).toFixed(1)}%`
            ])
        ];

        return summaryData;
    }

    function generateDemographicSheet(data) {
        const stats = calculateStats(data, {});

        const demoData = [
            ['ANÁLISIS DEMOGRÁFICO'],
            [],
            ['POR GÉNERO'],
            ['Género', 'Cantidad', 'Porcentaje'],
            ...Object.entries(stats.byGenero).map(([gen, count]) => [
                gen,
                count,
                `${((count / stats.total) * 100).toFixed(1)}%`
            ]),
            [],
            ['POR CARRERA'],
            ['Carrera', 'Cantidad', 'Porcentaje'],
            ...Object.entries(stats.byCarrera)
                .sort((a, b) => b[1] - a[1])
                .map(([carr, count]) => [
                    carr,
                    count,
                    `${((count / stats.total) * 100).toFixed(1)}%`
                ]),
            [],
            ['POR GENERACIÓN'],
            ['Generación', 'Cantidad', 'Porcentaje'],
            ...Object.entries(stats.byGeneracion)
                .sort((a, b) => b[0] - a[0])
                .map(([gen, count]) => [
                    gen,
                    count,
                    `${((count / stats.total) * 100).toFixed(1)}%`
                ])
        ];

        return demoData;
    }

    return {
        generatePDF,
        generateExcel
    };

})();
