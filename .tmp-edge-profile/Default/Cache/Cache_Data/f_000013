/**
 * ============================================================
 *  ExportUtils — Utilidades de Exportación para Reportes SIA
 * ============================================================
 *  Genera archivos PDF y Excel profesionales con formato
 *  institucional TecNM para el módulo de Reportes.
 *
 *  @version 4.1.0
 *  @requires jsPDF 2.5+, jspdf-autotable 3.8+, XLSX 0.18+
 * ============================================================
 */
window.ExportUtils = (function () {
    'use strict';

    const BLUE = [27, 57, 106];
    const ACCENT = [99, 102, 241];
    const GREEN = [16, 185, 129];
    const AMBER = [245, 158, 11];
    const ALT_ROW = [245, 247, 250];
    const M = 14; // margin

    const AREA_NAMES = {
        BIBLIO: 'Biblioteca',
        MEDICO: 'Servicios Médicos',
        POBLACION: 'Población SIA',
        VOCACIONAL: 'Test Vocacional'
    };

    const PERIOD_LABELS = {
        current: 'Periodo Actual',
        daily: 'Día Actual', weekly: 'Semana Actual', monthly: 'Mes Actual',
        quarterly: 'Trimestre', semester: 'Semestre', annual: 'Año Completo',
        custom: 'Rango Personalizado'
    };

    const AREA_PALETTES = {
        BIBLIO: {
            primary: [180, 83, 9],
            accent: [245, 158, 11],
            success: [21, 128, 61],
            warning: [217, 119, 6],
            danger: [190, 24, 93],
            light: [255, 247, 237],
            dark: [120, 53, 15]
        },
        MEDICO: {
            primary: [79, 70, 229],
            accent: [99, 102, 241],
            success: [5, 150, 105],
            warning: [37, 99, 235],
            danger: [220, 38, 38],
            light: [238, 242, 255],
            dark: [49, 46, 129]
        },
        POBLACION: {
            primary: [15, 118, 110],
            accent: [13, 148, 136],
            success: [22, 163, 74],
            warning: [202, 138, 4],
            danger: [225, 29, 72],
            light: [240, 253, 250],
            dark: [17, 94, 89]
        },
        VOCACIONAL: {
            primary: [14, 116, 144],
            accent: [6, 182, 212],
            success: [22, 163, 74],
            warning: [217, 119, 6],
            danger: [220, 38, 38],
            light: [236, 254, 255],
            dark: [14, 73, 87]
        },
        DEFAULT: {
            primary: BLUE,
            accent: ACCENT,
            success: GREEN,
            warning: AMBER,
            danger: [220, 38, 38],
            light: [243, 244, 246],
            dark: [31, 41, 55]
        }
    };

    function _isGenericPayload(data) {
        return !!data && !Array.isArray(data) && data.kind === 'generic';
    }

    // ==================== PDF ====================

    async function generatePDF(config, data, area) {
        if (_isGenericPayload(data)) {
            return _generateGenericPDF(config, data, area);
        }

        if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF no cargado.');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'letter');
        if (typeof doc.autoTable !== 'function') throw new Error('jspdf-autotable no disponible.');

        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();
        const cw = pw - M * 2;
        const areaName = AREA_NAMES[area] || area;
        const periodLabel = PERIOD_LABELS[config.period] || config.period;
        const dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
        const stats = _calcStats(data, area);

        // Helper para controlar posición y saltos de página
        function ensureSpace(needed) {
            if (doc.lastAutoTable) y = doc.lastAutoTable.finalY + 6;
            if (y + needed > ph - 20) {
                doc.addPage();
                _headerBar(doc, pw, areaName);
                y = 22;
            }
        }

        // ===== PORTADA (compacta) =====
        _headerBar(doc, pw, 'REPORTE');
        let y = 35;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text('TECNOLÓGICO NACIONAL DE MÉXICO', pw / 2, y, { align: 'center' });
        y += 7;
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...BLUE);
        doc.text('ITES Los Cabos', pw / 2, y, { align: 'center' });

        y += 12;
        doc.setDrawColor(...BLUE);
        doc.setLineWidth(1);
        doc.line(pw / 2 - 25, y, pw / 2 + 25, y);

        y += 10;
        doc.setFontSize(15);
        doc.setTextColor(50, 50, 50);
        doc.text('Reporte de ' + areaName, pw / 2, y, { align: 'center' });

        y += 8;
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        doc.text(periodLabel, pw / 2, y, { align: 'center' });

        if (config.dateStart && config.dateEnd) {
            y += 6;
            doc.setFontSize(9);
            const ds = new Date(config.dateStart).toLocaleDateString('es-MX');
            const de = new Date(config.dateEnd).toLocaleDateString('es-MX');
            doc.text(ds + ' — ' + de, pw / 2, y, { align: 'center' });
        }

        // KPI boxes en la portada (sin desperdiciar una página entera)
        y += 15;
        const boxes = _getMetricBoxes(stats, area);
        const bw = (cw - 6) / 2;
        for (let i = 0; i < boxes.length; i++) {
            const bx = M + (i % 2) * (bw + 6);
            const by = y + Math.floor(i / 2) * 20;
            _drawMetricBox(doc, bx, by, bw, 16, boxes[i].label, boxes[i].value, boxes[i].color);
        }
        y += Math.ceil(boxes.length / 2) * 20 + 8;

        // Resumen texto
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(110, 110, 110);
        const summary = 'Total: ' + stats.total + ' registros | Promedio diario: ' + stats.avgDaily.toFixed(1) +
            ' | Hora pico: ' + stats.peakHour + ' | Completado: ' + stats.completionRate + '%';
        doc.text(summary, pw / 2, y, { align: 'center' });

        // ===== DISTRIBUCIÓN POR TIPO (misma página si cabe) =====
        y += 8;
        if (Object.keys(stats.byTipo).length > 0) {
            ensureSpace(40);
            _sectionLabel(doc, 'Distribución por Tipo', y);
            y += 5;
            doc.autoTable({
                startY: y,
                head: [['Tipo', 'Cant.', '%']],
                body: Object.entries(stats.byTipo).sort((a, b) => b[1] - a[1]).map(([t, c]) => [t, c, _pct(c, stats.total)]),
                margin: { left: M, right: M },
                theme: 'striped',
                headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
                bodyStyles: { fontSize: 7.5, cellPadding: 1.5 },
                alternateRowStyles: { fillColor: ALT_ROW },
                columnStyles: { 1: { halign: 'center', cellWidth: 20 }, 2: { halign: 'center', cellWidth: 20 } }
            });
            y = doc.lastAutoTable.finalY + 6;
        }

        // ===== DISTRIBUCIÓN POR ESTADO =====
        if (Object.keys(stats.byStatus).length > 0) {
            ensureSpace(40);
            _sectionLabel(doc, 'Distribución por Estado', y);
            y += 5;
            doc.autoTable({
                startY: y,
                head: [['Estado', 'Cant.', '%']],
                body: Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]).map(([s, c]) => [s, c, _pct(c, stats.total)]),
                margin: { left: M, right: M },
                theme: 'striped',
                headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
                bodyStyles: { fontSize: 7.5, cellPadding: 1.5 },
                alternateRowStyles: { fillColor: ALT_ROW },
                columnStyles: { 1: { halign: 'center', cellWidth: 20 }, 2: { halign: 'center', cellWidth: 20 } }
            });
            y = doc.lastAutoTable.finalY + 6;
        }

        // ===== GRÁFICA (si existe) =====
        const chartImg = _captureMainChart(area);
        if (chartImg) {
            ensureSpace(60);
            _sectionLabel(doc, 'Tendencia', y);
            y += 4;
            const imgW = cw - 10;
            const imgH = imgW * 0.35;
            doc.addImage(chartImg, 'PNG', M + 5, y, imgW, imgH);
            y += imgH + 6;
        }

        // ===== ANÁLISIS TEMPORAL =====
        if (Object.keys(stats.byDay).length > 0) {
            ensureSpace(50);
            _sectionLabel(doc, 'Conteo por Fecha (últimos 20 días)', y);
            y += 5;
            const dayRows = Object.entries(stats.byDay).sort((a, b) => a[0].localeCompare(b[0])).slice(-20)
                .map(([d, c]) => [d, c]);
            doc.autoTable({
                startY: y,
                head: [['Fecha', 'Registros']],
                body: dayRows,
                margin: { left: M, right: pw / 2 + 5 }, // half-width table
                theme: 'striped',
                headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
                bodyStyles: { fontSize: 7, cellPadding: 1.2 },
                alternateRowStyles: { fillColor: ALT_ROW },
                columnStyles: { 1: { halign: 'center' } }
            });

            // Distribución por hora (lado derecho si hay espacio)
            if (Object.keys(stats.byHour).length > 0) {
                const hourY = doc.lastAutoTable.startY || y;
                doc.autoTable({
                    startY: hourY,
                    head: [['Hora', 'Cant.', '%']],
                    body: Object.entries(stats.byHour).sort((a, b) => a[0].localeCompare(b[0])).map(([h, c]) => [h, c, _pct(c, stats.total)]),
                    margin: { left: pw / 2 + 5, right: M },
                    theme: 'striped',
                    headStyles: { fillColor: AMBER, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
                    bodyStyles: { fontSize: 7, cellPadding: 1.2 },
                    alternateRowStyles: { fillColor: ALT_ROW },
                    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } }
                });
            }
            y = doc.lastAutoTable.finalY + 6;
        }

        // ===== DEMOGRÁFICO =====
        var hasDemo = Object.keys(stats.byGenero).length > 0 || Object.keys(stats.byCarrera).length > 0;
        if (hasDemo) {
            ensureSpace(50);
            _sectionLabel(doc, 'Análisis Demográfico', y);
            y += 5;

            if (Object.keys(stats.byGenero).length > 0) {
                y = _compactTable(doc, 'Género', stats.byGenero, stats.total, y, [59, 130, 246]);
            }
            if (Object.keys(stats.byCarrera).length > 0) {
                ensureSpace(40);
                y = _compactTable(doc, 'Carrera', stats.byCarrera, stats.total, y, ACCENT);
            }
            if (Object.keys(stats.byGeneracion).length > 0) {
                ensureSpace(30);
                y = _compactTable(doc, 'Generación', stats.byGeneracion, stats.total, y, [139, 92, 246], true);
            }
            if (Object.keys(stats.byTurno).length > 0) {
                ensureSpace(25);
                y = _compactTable(doc, 'Turno', stats.byTurno, stats.total, y, [20, 184, 166]);
            }
        }

        // ===== DIAGNÓSTICOS (solo Médico) =====
        if (area === 'MEDICO' && Object.keys(stats.byDiagnostico).length > 0) {
            ensureSpace(50);
            _sectionLabel(doc, 'Diagnósticos Frecuentes', y);
            y += 5;
            const diagRows = Object.entries(stats.byDiagnostico).sort((a, b) => b[1] - a[1]).slice(0, 15)
                .map(([d, c]) => [d.substring(0, 50), c, _pct(c, stats.total)]);
            doc.autoTable({
                startY: y,
                head: [['Diagnóstico', 'Cant.', '%']],
                body: diagRows,
                margin: { left: M, right: M },
                theme: 'striped',
                headStyles: { fillColor: [220, 38, 127], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
                bodyStyles: { fontSize: 7, cellPadding: 1.5 },
                alternateRowStyles: { fillColor: ALT_ROW },
                columnStyles: { 1: { halign: 'center', cellWidth: 18 }, 2: { halign: 'center', cellWidth: 18 } }
            });
            y = doc.lastAutoTable.finalY + 6;
        }

        // ===== MUESTRA DE REGISTROS (solo top 30, no todos) =====
        if (data.length > 0 && area !== 'POBLACION') {
            ensureSpace(50);
            _sectionLabel(doc, 'Muestra de Registros (últimos ' + Math.min(30, data.length) + ')', y);
            y += 5;
            const detailCols = _getDetailColumns(area);
            const detailRows = data.slice(0, 30).map(d => _getDetailRow(d, area));
            doc.autoTable({
                startY: y,
                head: [detailCols],
                body: detailRows,
                margin: { left: M, right: M },
                theme: 'striped',
                headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, cellPadding: 1.5 },
                bodyStyles: { fontSize: 6, cellPadding: 1, textColor: [50, 50, 50] },
                alternateRowStyles: { fillColor: ALT_ROW },
                styles: { overflow: 'linebreak', cellWidth: 'wrap' },
                didDrawPage: function () { _headerBar(doc, pw, areaName); }
            });
            y = doc.lastAutoTable.finalY + 6;
        }

        // ===== FIRMAS (en la última página, al fondo) =====
        ensureSpace(50);
        y = ph - 50;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        var noteText = 'Generado por SIA — ' + dateStr + ' | ' + data.length + ' registros | ' + periodLabel;
        doc.text(noteText, pw / 2, y, { align: 'center' });

        y += 20;
        var sigX1 = M + 35, sigX2 = pw - M - 35;
        doc.setLineWidth(0.4);
        doc.setDrawColor(140, 140, 140);
        doc.line(sigX1 - 25, y, sigX1 + 25, y);
        doc.line(sigX2 - 25, y, sigX2 + 25, y);
        doc.setFontSize(7);
        doc.text('Elaboró', sigX1, y + 4, { align: 'center' });
        doc.text('Vo.Bo. Desarrollo Académico', sigX2, y + 4, { align: 'center' });

        // Numeración de páginas
        var totalPages = doc.internal.getNumberOfPages();
        for (var i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(6.5);
            doc.setTextColor(160, 160, 160);
            doc.text('Pág. ' + i + '/' + totalPages, pw - M, ph - 5, { align: 'right' });
            doc.text('SIA — TecNM Campus Los Cabos', M, ph - 5);
        }

        doc.save('Reporte_' + area + '_' + new Date().toISOString().slice(0, 10) + '.pdf');
    }

    // ==================== EXCEL ====================

    function generateExcel(config, data, area) {
        if (_isGenericPayload(data)) {
            return _generateGenericExcel(config, data, area);
        }

        var wb = XLSX.utils.book_new();
        var areaName = AREA_NAMES[area] || area;
        var periodLabel = PERIOD_LABELS[config.period] || config.period;
        var dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
        var stats = _calcStats(data, area);

        // ===== HOJA 1: RESUMEN (combina portada + resumen en una sola hoja) =====
        var resumen = [
            ['REPORTE DE ' + areaName.toUpperCase()],
            ['TecNM — ITES Los Cabos | Desarrollo Académico'],
            [''],
            ['Período', periodLabel],
        ];
        if (config.dateStart && config.dateEnd) {
            resumen.push(['Desde', new Date(config.dateStart).toLocaleDateString('es-MX')]);
            resumen.push(['Hasta', new Date(config.dateEnd).toLocaleDateString('es-MX')]);
        }
        resumen.push(['Generado', dateStr]);
        resumen.push(['Total registros', stats.total]);
        resumen.push(['']);
        resumen.push(['INDICADORES CLAVE']);
        resumen.push(['Métrica', 'Valor']);
        resumen.push(['Promedio diario', stats.avgDaily.toFixed(1)]);
        resumen.push(['Hora pico', stats.peakHour]);
        resumen.push(['Tasa de completado', stats.completionRate + '%']);

        // Métricas específicas por área
        if (area === 'BIBLIO') {
            resumen.push(['Visitas', stats.visitas]);
            resumen.push(['Préstamos', stats.prestamos]);
        } else if (area === 'MEDICO') {
            resumen.push(['Consultas Médicas', stats.medicas]);
            resumen.push(['Consultas Psicológicas', stats.psicologicas]);
        } else {
            resumen.push(['Estudiantes', stats.estudiantes]);
            resumen.push(['Docentes', stats.docentes]);
            resumen.push(['Administrativos', stats.administrativos]);
            resumen.push(['Admins de Módulo', stats.adminsModulo]);
        }

        resumen.push(['']);
        if (Object.keys(stats.byTipo).length > 0) {
            resumen.push(['DISTRIBUCIÓN POR TIPO']);
            resumen.push(['Tipo', 'Cantidad', 'Porcentaje']);
            Object.entries(stats.byTipo).sort((a, b) => b[1] - a[1]).forEach(function (e) {
                resumen.push([e[0], e[1], _pct(e[1], stats.total)]);
            });
        }

        resumen.push(['']);
        if (Object.keys(stats.byStatus).length > 0) {
            resumen.push(['DISTRIBUCIÓN POR ESTADO']);
            resumen.push(['Estado', 'Cantidad', 'Porcentaje']);
            Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]).forEach(function (e) {
                resumen.push([e[0], e[1], _pct(e[1], stats.total)]);
            });
        }

        var wsRes = XLSX.utils.aoa_to_sheet(resumen);
        wsRes['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 12 }];
        wsRes['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');

        // ===== HOJA 2: DATOS =====
        var headers = _getExcelHeaders(area);
        var rows = data.map(function (d) { return _getExcelRow(d, area); });
        var wsData = XLSX.utils.aoa_to_sheet([headers].concat(rows));
        wsData['!cols'] = _getExcelWidths(area);
        if (headers.length <= 26) {
            wsData['!autofilter'] = { ref: 'A1:' + String.fromCharCode(64 + headers.length) + '1' };
        }
        XLSX.utils.book_append_sheet(wb, wsData, 'Datos');

        // ===== HOJA 3: DEMOGRÁFICO =====
        var demo = [['ANÁLISIS DEMOGRÁFICO'], ['']];
        _addExcelSection(demo, 'GÉNERO', stats.byGenero, stats.total);
        _addExcelSection(demo, 'CARRERA', stats.byCarrera, stats.total);
        _addExcelSection(demo, 'GENERACIÓN', stats.byGeneracion, stats.total, true);
        _addExcelSection(demo, 'TURNO', stats.byTurno, stats.total);

        var wsDemo = XLSX.utils.aoa_to_sheet(demo);
        wsDemo['!cols'] = [{ wch: 35 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsDemo, 'Demográfico');

        // ===== HOJA 4: TEMPORAL =====
        var temporal = [['ANÁLISIS TEMPORAL'], ['']];
        temporal.push(['CONTEO POR FECHA']);
        temporal.push(['Fecha', 'Registros']);
        Object.entries(stats.byDay).sort(function (a, b) { return a[0].localeCompare(b[0]); }).forEach(function (e) {
            temporal.push([e[0], e[1]]);
        });
        temporal.push(['']);
        temporal.push(['DISTRIBUCIÓN POR HORA']);
        temporal.push(['Hora', 'Registros', 'Porcentaje']);
        Object.entries(stats.byHour).sort(function (a, b) { return a[0].localeCompare(b[0]); }).forEach(function (e) {
            temporal.push([e[0], e[1], _pct(e[1], stats.total)]);
        });

        var wsTemp = XLSX.utils.aoa_to_sheet(temporal);
        wsTemp['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsTemp, 'Temporal');

        // ===== HOJA 5 (MÉDICO): DIAGNÓSTICOS =====
        if (area === 'MEDICO' && Object.keys(stats.byDiagnostico).length > 0) {
            var diag = [['DIAGNÓSTICOS FRECUENTES'], [''], ['Diagnóstico', 'Cantidad', 'Porcentaje']];
            Object.entries(stats.byDiagnostico).sort(function (a, b) { return b[1] - a[1]; }).forEach(function (e) {
                diag.push([e[0], e[1], _pct(e[1], stats.total)]);
            });
            var wsDiag = XLSX.utils.aoa_to_sheet(diag);
            wsDiag['!cols'] = [{ wch: 45 }, { wch: 12 }, { wch: 12 }];
            XLSX.utils.book_append_sheet(wb, wsDiag, 'Diagnósticos');
        }

        XLSX.writeFile(wb, 'Reporte_' + area + '_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    }

    async function _generateGenericPDF(config, payload, area) {
        if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF no cargado.');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'letter');
        if (typeof doc.autoTable !== 'function') throw new Error('jspdf-autotable no disponible.');

        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();
        const areaName = AREA_NAMES[area] || area;
        const periodLabel = PERIOD_LABELS[config.period] || config.period || 'Actual';
        const filename = (payload.filenameBase || ('Reporte_' + area)) + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
        let y = 24;

        function ensureSpace(needed) {
            if (doc.lastAutoTable) y = doc.lastAutoTable.finalY + 6;
            if (y + needed > ph - 15) {
                doc.addPage();
                _headerBar(doc, pw, areaName);
                y = 22;
            }
        }

        _headerBar(doc, pw, areaName);
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...BLUE);
        doc.text(payload.title || 'Exportación', M, y);
        y += 6;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(110, 110, 110);
        const sub = [payload.subtitle, periodLabel].filter(Boolean).join(' · ');
        if (sub) {
            doc.text(sub, M, y);
            y += 6;
        }

        if (Array.isArray(payload.summary) && payload.summary.length > 0) {
            ensureSpace(25);
            doc.autoTable({
                startY: y,
                head: [['Concepto', 'Valor']],
                body: payload.summary,
                margin: { left: M, right: M },
                theme: 'striped',
                headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
                bodyStyles: { fontSize: 7.5, cellPadding: 1.5 },
                alternateRowStyles: { fillColor: ALT_ROW }
            });
            y = doc.lastAutoTable.finalY + 6;
        }

        (payload.sections || []).forEach(section => {
            if (!section || !Array.isArray(section.rows) || section.rows.length === 0) return;
            ensureSpace(35);
            _sectionLabel(doc, section.title || 'Detalle', y);
            y += 4;
            doc.autoTable({
                startY: y,
                head: [section.headers || ['Valor', 'Cantidad']],
                body: section.rows,
                margin: { left: M, right: M },
                theme: 'striped',
                headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
                bodyStyles: { fontSize: 7, cellPadding: 1.4 },
                alternateRowStyles: { fillColor: ALT_ROW }
            });
            y = doc.lastAutoTable.finalY + 6;
        });

        if (Array.isArray(payload.columns) && Array.isArray(payload.rows)) {
            ensureSpace(50);
            _sectionLabel(doc, 'Datos', y);
            y += 4;
            doc.autoTable({
                startY: y,
                head: [payload.columns],
                body: payload.rows,
                margin: { left: M, right: M },
                theme: 'striped',
                headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', cellPadding: 1.6 },
                bodyStyles: { fontSize: 6.3, cellPadding: 1.1 },
                alternateRowStyles: { fillColor: ALT_ROW },
                styles: { overflow: 'linebreak', cellWidth: 'wrap' },
                didDrawPage: function () { _headerBar(doc, pw, areaName); }
            });
        }

        var totalPages = doc.internal.getNumberOfPages();
        for (var i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(6.5);
            doc.setTextColor(160, 160, 160);
            doc.text('Pág. ' + i + '/' + totalPages, pw - M, ph - 5, { align: 'right' });
            doc.text('SIA — TecNM Campus Los Cabos', M, ph - 5);
        }

        doc.save(filename);
    }

    function _generateGenericExcelLegacy(config, payload, area) {
        var wb = XLSX.utils.book_new();
        var areaName = AREA_NAMES[area] || area;
        var periodLabel = PERIOD_LABELS[config.period] || config.period || 'Actual';
        var filename = (payload.filenameBase || ('Reporte_' + area)) + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';

        var resumen = [
            [payload.title || 'Exportación'],
            [payload.subtitle || areaName],
            ['Periodo', periodLabel],
            ['']
        ];

        (payload.summary || []).forEach(function (row) {
            resumen.push(row);
        });

        var wsRes = XLSX.utils.aoa_to_sheet(resumen);
        wsRes['!cols'] = [{ wch: 32 }, { wch: 24 }];
        XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');

        (payload.sections || []).forEach(function (section, index) {
            if (!section || !Array.isArray(section.rows) || section.rows.length === 0) return;
            var rows = [section.headers || ['Valor', 'Cantidad']].concat(section.rows);
            var ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{ wch: 28 }, { wch: 14 }];
            XLSX.utils.book_append_sheet(wb, ws, ('Detalle_' + (index + 1)).slice(0, 31));
        });

        if (Array.isArray(payload.columns) && Array.isArray(payload.rows)) {
            var wsData = XLSX.utils.aoa_to_sheet([payload.columns].concat(payload.rows));
            wsData['!cols'] = payload.columns.map(function () { return { wch: 22 }; });
            XLSX.utils.book_append_sheet(wb, wsData, 'Datos');
        }

        XLSX.writeFile(wb, filename);
    }

    async function _generateGenericPDF(config, payload, area) {
        if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF no cargado.');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'letter');
        if (typeof doc.autoTable !== 'function') throw new Error('jspdf-autotable no disponible.');

        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();
        const cw = pw - (M * 2);
        const areaName = AREA_NAMES[area] || area;
        const palette = _getAreaPalette(area);
        const periodLabel = PERIOD_LABELS[config.period] || config.period || 'Actual';
        const generatedAt = new Date().toLocaleString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        const filename = (payload.filenameBase || ('Reporte_' + area)) + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
        const totalRows = Number.isFinite(payload.recordCount)
            ? payload.recordCount
            : (Array.isArray(payload.rows) ? payload.rows.length : 0);
        const detailRows = Array.isArray(payload.pdfRows) && payload.pdfRows.length
            ? payload.pdfRows
            : (Array.isArray(payload.rows) ? payload.rows : []);
        const showDetailTable = !(payload.pdfOptions && payload.pdfOptions.showDetailTable === false);
        const chartSpecs = window.Chart && Array.isArray(payload.charts)
            ? payload.charts.filter(function (spec) {
                return spec
                    && Array.isArray(spec.labels)
                    && Array.isArray(spec.values)
                    && spec.labels.length
                    && spec.labels.length === spec.values.length;
            })
            : [];
        let y = 20;

        function drawHeader() {
            doc.setFillColor(...palette.primary);
            doc.rect(0, 0, pw, 15, 'F');
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('SIA · Reporte Ejecutivo', M, 9);
            doc.setFont('helvetica', 'normal');
            doc.text(areaName, M, 12.5);
            doc.text(generatedAt, pw - M, 9, { align: 'right' });
        }

        function ensureSpace(needed) {
            if (doc.lastAutoTable && doc.lastAutoTable.finalY > y) {
                y = doc.lastAutoTable.finalY + 6;
            }
            if (y + needed > ph - 18) {
                doc.addPage();
                drawHeader();
                y = 22;
            }
        }

        function drawSectionTitle(title) {
            doc.setFontSize(10.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...palette.dark);
            doc.text(title, M, y);
            doc.setDrawColor(...palette.accent);
            doc.setLineWidth(0.45);
            doc.line(M, y + 1.5, pw - M, y + 1.5);
            y += 5;
        }

        async function drawChartRow(specs) {
            var gap = 6;
            var isHalfRow = specs.length > 1 || (specs[0] && specs[0].layout === 'half');
            var cardWidth = isHalfRow ? ((cw - gap) / 2) : cw;
            var legendLimit = isHalfRow ? 4 : 6;
            var legendSets = specs.map(function (spec) {
                return _buildChartLegendRows(spec, area, legendLimit);
            });
            var maxLegendRows = legendSets.reduce(function (max, rows) {
                return Math.max(max, rows.length);
            }, 0);
            var legendHeight = maxLegendRows ? ((maxLegendRows * 4.2) + 6) : 0;
            var cardHeight = (isHalfRow ? 76 : 88) + legendHeight;
            var rowY;

            ensureSpace(cardHeight + 6);
            rowY = y;

            for (var index = 0; index < specs.length; index++) {
                var spec = specs[index];
                if (!spec) continue;

                var cardX = isHalfRow
                    ? (specs.length === 1 ? (M + ((cw - cardWidth) / 2)) : (M + (index * (cardWidth + gap))))
                    : M;
                var titleLines = doc.splitTextToSize(spec.title || 'Grafica', cardWidth - 10);
                var imageY = rowY + 7 + (titleLines.length * 3.5);
                var imageHeight = cardHeight - (imageY - rowY) - legendHeight - 5;
                var chartImage = await _renderChartImage(spec, area);
                var legendRows = legendSets[index] || [];

                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(...palette.accent);
                doc.setLineWidth(0.2);
                doc.roundedRect(cardX, rowY, cardWidth, cardHeight, 3, 3, 'FD');
                doc.setFillColor(...palette.light);
                doc.roundedRect(cardX, rowY, cardWidth, 7, 3, 3, 'F');
                doc.setFontSize(8.1);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...palette.dark);
                doc.text(titleLines, cardX + 5, rowY + 5);

                if (chartImage) {
                    doc.addImage(chartImage, 'PNG', cardX + 4, imageY, cardWidth - 8, imageHeight);
                } else {
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'italic');
                    doc.setTextColor(107, 114, 128);
                    doc.text('Grafica no disponible', cardX + (cardWidth / 2), imageY + (imageHeight / 2), { align: 'center' });
                }

                if (legendRows.length) {
                    var legendY = imageY + imageHeight + 4;
                    doc.setFontSize(6.6);
                    doc.setFont('helvetica', 'normal');

                    legendRows.forEach(function (row, rowIndex) {
                        var legendLineY = legendY + (rowIndex * 4.2);
                        doc.setFillColor(...row.color);
                        doc.roundedRect(cardX + 5, legendLineY - 2.2, 2.8, 2.8, 0.6, 0.6, 'F');
                        doc.setTextColor(...palette.dark);
                        doc.text(row.label, cardX + 10, legendLineY);
                        doc.setTextColor(75, 85, 99);
                        doc.text([row.value, row.pct].filter(Boolean).join(' · '), cardX + cardWidth - 5, legendLineY, { align: 'right' });
                    });
                }
            }

            y += cardHeight + 7;
        }

        drawHeader();

        doc.setFillColor(...palette.light);
        doc.roundedRect(M, y, cw, 30, 4, 4, 'F');
        doc.setFillColor(...palette.accent);
        doc.roundedRect(M, y, 5, 30, 4, 4, 'F');
        doc.setFontSize(17);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...palette.dark);
        doc.text(payload.title || 'Exportacion', M + 10, y + 8);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(95, 99, 104);
        doc.text(payload.subtitle || 'Centro de reportes SIA', M + 10, y + 14);
        doc.text(`Periodo: ${periodLabel}`, M + 10, y + 20);
        doc.text(`Registros: ${totalRows.toLocaleString('es-MX')}`, M + 10, y + 25.5);
        doc.text(`Generado: ${generatedAt}`, pw - M - 2, y + 20, { align: 'right' });
        doc.text(`Area: ${areaName}`, pw - M - 2, y + 25.5, { align: 'right' });
        y += 38;

        if (Array.isArray(payload.summary) && payload.summary.length > 0) {
            ensureSpace(34);
            drawSectionTitle('Resumen ejecutivo');
            doc.autoTable({
                startY: y,
                head: [['Concepto', 'Valor']],
                body: payload.summary.map(function (row) {
                    return [String(row[0] ?? ''), _formatExportValue(row[1])];
                }),
                margin: { left: M, right: M },
                theme: 'grid',
                styles: { fontSize: 7.6, cellPadding: 2.1, lineColor: [226, 232, 240], lineWidth: 0.1 },
                headStyles: { fillColor: palette.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.2 },
                bodyStyles: { textColor: [55, 65, 81] },
                alternateRowStyles: { fillColor: ALT_ROW }
            });
            y = doc.lastAutoTable.finalY + 7;
        }

        if (Array.isArray(payload.highlights) && payload.highlights.length > 0) {
            drawSectionTitle('Indicadores clave');
            var gap = 5;
            var cardWidth = (cw - gap) / 2;
            var cardHeight = 17;
            payload.highlights.forEach(function (item, index) {
                if (index > 0 && index % 2 === 0) {
                    y += cardHeight + 4;
                }
                ensureSpace(cardHeight + 6);
                var cardX = M + ((index % 2) * (cardWidth + gap));
                var cardY = y;
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(...palette.accent);
                doc.setLineWidth(0.25);
                doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3, 3, 'FD');
                doc.setFillColor(...palette.accent);
                doc.rect(cardX, cardY, 3, cardHeight, 'F');
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...palette.dark);
                doc.text(String(item.label || '--'), cardX + 6, cardY + 5.5);
                doc.setFontSize(12.5);
                doc.text(String(item.value ?? '--'), cardX + 6, cardY + 11.7);
                doc.setFontSize(6.4);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(107, 114, 128);
                doc.text(String(item.hint || ''), cardX + 6, cardY + 15);
            });
            y += (Math.ceil(payload.highlights.length / 2) * (cardHeight + 4));
        }

        if (chartSpecs.length) {
            drawSectionTitle('Graficas clave');
            var halfRow = [];

            for (const spec of chartSpecs) {
                if (spec.layout === 'half') {
                    halfRow.push(spec);
                    if (halfRow.length === 2) {
                        await drawChartRow(halfRow);
                        halfRow = [];
                    }
                    continue;
                }

                if (halfRow.length) {
                    await drawChartRow(halfRow);
                    halfRow = [];
                }
                await drawChartRow([spec]);
            }

            if (halfRow.length) {
                await drawChartRow(halfRow);
            }
        }

        (payload.sections || []).forEach(function (section) {
            if (!section || !Array.isArray(section.rows) || !section.rows.length) return;
            ensureSpace(34);
            drawSectionTitle(section.title || 'Detalle');
            doc.autoTable({
                startY: y,
                head: [section.headers || ['Valor', 'Cantidad']],
                body: section.rows.map(function (row) {
                    return row.map(_formatExportValue);
                }),
                margin: { left: M, right: M },
                theme: 'grid',
                styles: { fontSize: 7.2, cellPadding: 1.8, lineColor: [226, 232, 240], lineWidth: 0.1 },
                headStyles: {
                    fillColor: _getToneColor(area, section.tone),
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 7.8
                },
                bodyStyles: { textColor: [55, 65, 81] },
                alternateRowStyles: { fillColor: ALT_ROW }
            });
            y = doc.lastAutoTable.finalY + 7;
        });

        if (showDetailTable && Array.isArray(payload.columns) && payload.columns.length && detailRows.length) {
            ensureSpace(48);
            drawSectionTitle(payload.dataTitle || 'Detalle');
            doc.autoTable({
                startY: y,
                head: [payload.columns.map(_formatExportValue)],
                body: detailRows.map(function (row) {
                    return row.map(_formatExportValue);
                }),
                margin: { left: M, right: M },
                theme: 'striped',
                styles: { fontSize: 6.1, cellPadding: 1.2, overflow: 'linebreak', cellWidth: 'wrap' },
                headStyles: { fillColor: palette.dark, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.8, cellPadding: 1.4 },
                bodyStyles: { textColor: [55, 65, 81] },
                alternateRowStyles: { fillColor: ALT_ROW },
                didDrawPage: function () {
                    drawHeader();
                }
            });
            y = doc.lastAutoTable.finalY + 7;
        }

        if (Array.isArray(payload.notes) && payload.notes.length) {
            ensureSpace((payload.notes.length * 5) + 10);
            drawSectionTitle('Notas');
            doc.setFontSize(7.2);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(75, 85, 99);
            payload.notes.forEach(function (note) {
                var lines = doc.splitTextToSize(`• ${_formatExportValue(note)}`, cw);
                doc.text(lines, M, y);
                y += (lines.length * 3.8) + 1.2;
            });
        }

        var totalPages = doc.internal.getNumberOfPages();
        for (var i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(6.4);
            doc.setTextColor(148, 163, 184);
            doc.text('SIA · TecNM Campus Los Cabos', M, ph - 5);
            doc.text('Pag. ' + i + '/' + totalPages, pw - M, ph - 5, { align: 'right' });
        }

        doc.save(filename);
    }

    function _generateGenericExcelLegacyCurrent(config, payload, area) {
        if (!window.XLSX) throw new Error('XLSX no cargado.');

        var wb = XLSX.utils.book_new();
        var areaName = AREA_NAMES[area] || area;
        var periodLabel = PERIOD_LABELS[config.period] || config.period || 'Actual';
        var generatedAt = new Date().toLocaleString('es-MX');
        var filename = (payload.filenameBase || ('Reporte_' + area)) + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        var totalRows = Number.isFinite(payload.recordCount)
            ? payload.recordCount
            : (Array.isArray(payload.rows) ? payload.rows.length : 0);

        wb.Props = {
            Title: payload.title || 'Reporte SIA',
            Subject: payload.subtitle || areaName,
            Author: 'SIA',
            Company: 'TecNM Campus Los Cabos',
            CreatedDate: new Date()
        };

        var summaryMatrix = [
            [payload.title || 'Exportacion'],
            [payload.subtitle || areaName],
            [''],
            ['Area', areaName],
            ['Periodo', periodLabel],
            ['Generado', generatedAt],
            ['Registros', totalRows],
            ['']
        ];

        (payload.summary || []).forEach(function (row) {
            summaryMatrix.push([_formatExportValue(row[0]), _formatExportValue(row[1])]);
        });

        if (Array.isArray(payload.notes) && payload.notes.length) {
            summaryMatrix.push(['']);
            summaryMatrix.push(['Notas']);
            payload.notes.forEach(function (note) {
                summaryMatrix.push([_formatExportValue(note)]);
            });
        }

        _appendGenericSheet(wb, 'Resumen', summaryMatrix, {
            merges: [
                { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }
            ],
            cols: [{ wch: 28 }, { wch: 40 }, { wch: 20 }]
        });

        if (Array.isArray(payload.highlights) && payload.highlights.length) {
            var highlightsMatrix = [['Indicador', 'Valor', 'Lectura']];
            payload.highlights.forEach(function (item) {
                highlightsMatrix.push([
                    _formatExportValue(item.label),
                    _formatExportValue(item.value),
                    _formatExportValue(item.hint)
                ]);
            });
            _appendGenericSheet(wb, 'Indicadores', highlightsMatrix, {
                cols: [{ wch: 24 }, { wch: 16 }, { wch: 44 }],
                autofilterRow: 0
            });
        }

        (payload.sections || []).forEach(function (section, index) {
            if (!section || !Array.isArray(section.rows) || !section.rows.length) return;
            var matrix = [
                [section.title || ('Seccion ' + (index + 1))],
                [''],
                (section.headers || ['Valor', 'Cantidad']).map(_formatExportValue)
            ];
            section.rows.forEach(function (row) {
                matrix.push(row.map(_formatExportValue));
            });
            _appendGenericSheet(wb, `${index + 1}_${section.title || 'Seccion'}`, matrix, {
                merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(((section.headers || []).length - 1), 2) } }],
                autofilterRow: 2
            });
        });

        if (Array.isArray(payload.columns) && payload.columns.length) {
            var detailMatrix = [payload.columns.map(_formatExportValue)];
            (payload.rows || []).forEach(function (row) {
                detailMatrix.push(row.map(_formatExportValue));
            });
            _appendGenericSheet(wb, payload.detailSheetName || 'Detalle', detailMatrix, {
                autofilterRow: 0
            });
        }

        XLSX.writeFile(wb, filename);
    }

    function _rgbToHex(rgb) {
        return rgb.map(function (value) {
            return Number(value).toString(16).padStart(2, '0');
        }).join('').toUpperCase();
    }

    function _getExcelStyleKit(area) {
        var palette = _getAreaPalette(area);
        var border = {
            top: { style: 'thin', color: { rgb: 'D9E2EC' } },
            bottom: { style: 'thin', color: { rgb: 'D9E2EC' } },
            left: { style: 'thin', color: { rgb: 'D9E2EC' } },
            right: { style: 'thin', color: { rgb: 'D9E2EC' } }
        };

        return {
            title: {
                font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
                fill: { patternType: 'solid', fgColor: { rgb: _rgbToHex(palette.primary) } },
                alignment: { horizontal: 'center', vertical: 'center' }
            },
            subtitle: {
                font: { bold: true, italic: true, sz: 11, color: { rgb: _rgbToHex(palette.dark) } },
                fill: { patternType: 'solid', fgColor: { rgb: _rgbToHex(palette.light) } },
                alignment: { horizontal: 'center', vertical: 'center' }
            },
            section: {
                font: { bold: true, sz: 12, color: { rgb: _rgbToHex(palette.dark) } },
                fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
                alignment: { horizontal: 'left', vertical: 'center' },
                border: border
            },
            header: {
                font: { bold: true, color: { rgb: 'FFFFFF' } },
                fill: { patternType: 'solid', fgColor: { rgb: _rgbToHex(palette.accent) } },
                alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                border: border
            },
            label: {
                font: { bold: true, color: { rgb: _rgbToHex(palette.dark) } },
                fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } },
                alignment: { vertical: 'top', wrapText: true },
                border: border
            },
            body: {
                font: { sz: 11, color: { rgb: '374151' } },
                alignment: { vertical: 'top', wrapText: true },
                border: border
            },
            bodyAlt: {
                font: { sz: 11, color: { rgb: '374151' } },
                alignment: { vertical: 'top', wrapText: true },
                fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } },
                border: border
            },
            note: {
                font: { italic: true, color: { rgb: '64748B' } },
                alignment: { vertical: 'top', wrapText: true },
                border: border
            }
        };
    }

    function _applyCellStyle(ws, row, col, style) {
        var address = XLSX.utils.encode_cell({ r: row, c: col });
        if (!ws[address]) return;
        ws[address].s = style;
    }

    function _applyRowStyle(ws, row, maxCol, style) {
        for (var col = 0; col <= maxCol; col++) {
            _applyCellStyle(ws, row, col, style);
        }
    }

    function _decorateGenericSheet(ws, area, options) {
        if (!ws || !ws['!ref']) return ws;

        var opts = options || {};
        var styles = _getExcelStyleKit(area);
        var range = XLSX.utils.decode_range(ws['!ref']);
        var sectionRows = new Set(opts.sectionRows || []);
        var noteRows = new Set(opts.noteRows || []);

        ws['!rows'] = ws['!rows'] || [];

        if (Number.isFinite(opts.titleRow)) {
            _applyRowStyle(ws, opts.titleRow, range.e.c, styles.title);
            ws['!rows'][opts.titleRow] = { hpt: 24 };
        }

        if (Number.isFinite(opts.subtitleRow)) {
            _applyRowStyle(ws, opts.subtitleRow, range.e.c, styles.subtitle);
            ws['!rows'][opts.subtitleRow] = { hpt: 20 };
        }

        sectionRows.forEach(function (row) {
            _applyRowStyle(ws, row, range.e.c, styles.section);
            ws['!rows'][row] = { hpt: 19 };
        });

        if (Number.isFinite(opts.headerRow)) {
            _applyRowStyle(ws, opts.headerRow, range.e.c, styles.header);
            ws['!rows'][opts.headerRow] = { hpt: 22 };
        }

        if (Number.isFinite(opts.bodyStartRow)) {
            for (var row = opts.bodyStartRow; row <= range.e.r; row++) {
                if (sectionRows.has(row) || noteRows.has(row) || row === opts.headerRow) continue;

                _applyRowStyle(ws, row, range.e.c, ((row - opts.bodyStartRow) % 2 === 0) ? styles.body : styles.bodyAlt);

                if (Number.isFinite(opts.labelCol)) {
                    _applyCellStyle(ws, row, opts.labelCol, styles.label);
                }
            }
        }

        noteRows.forEach(function (row) {
            _applyRowStyle(ws, row, range.e.c, styles.note);
        });

        return ws;
    }

    function _generateGenericExcel(config, payload, area) {
        if (!window.XLSX) throw new Error('XLSX no cargado.');

        var wb = XLSX.utils.book_new();
        var areaName = AREA_NAMES[area] || area;
        var periodLabel = PERIOD_LABELS[config.period] || config.period || 'Actual';
        var generatedAt = new Date().toLocaleString('es-MX');
        var filename = (payload.filenameBase || ('Reporte_' + area)) + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        var totalRows = Number.isFinite(payload.recordCount)
            ? payload.recordCount
            : (Array.isArray(payload.rows) ? payload.rows.length : 0);

        wb.Props = {
            Title: payload.title || 'Reporte SIA',
            Subject: payload.subtitle || areaName,
            Author: 'SIA',
            Company: 'TecNM Campus Los Cabos',
            CreatedDate: new Date()
        };

        var summaryMatrix = [
            [payload.title || 'Exportacion'],
            [payload.subtitle || areaName],
            [''],
            ['Resumen ejecutivo', ''],
            ['Area', areaName],
            ['Periodo', periodLabel],
            ['Generado', generatedAt],
            ['Registros', totalRows]
        ];

        (payload.summary || []).forEach(function (row) {
            summaryMatrix.push([_formatExportValue(row[0]), _formatExportValue(row[1])]);
        });

        var summarySectionRows = [3];
        var noteRows = [];
        if (Array.isArray(payload.notes) && payload.notes.length) {
            summaryMatrix.push(['']);
            summaryMatrix.push(['Notas', '']);
            summarySectionRows.push(summaryMatrix.length - 1);
            payload.notes.forEach(function (note) {
                summaryMatrix.push([_formatExportValue(note), '']);
                noteRows.push(summaryMatrix.length - 1);
            });
        }

        var wsSummary = _appendGenericSheet(wb, 'Resumen', summaryMatrix, {
            merges: [
                { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
                { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } }
            ].concat(summarySectionRows.slice(1).map(function (row) {
                return { s: { r: row, c: 0 }, e: { r: row, c: 2 } };
            })),
            cols: [{ wch: 28 }, { wch: 42 }, { wch: 18 }]
        });
        _decorateGenericSheet(wsSummary, area, {
            titleRow: 0,
            subtitleRow: 1,
            sectionRows: summarySectionRows,
            bodyStartRow: 4,
            labelCol: 0,
            noteRows: noteRows
        });

        if (Array.isArray(payload.highlights) && payload.highlights.length) {
            var highlightsMatrix = [
                [payload.title || 'Exportacion'],
                ['Indicadores clave'],
                [''],
                ['Indicador', 'Valor', 'Lectura']
            ];

            payload.highlights.forEach(function (item) {
                highlightsMatrix.push([
                    _formatExportValue(item.label),
                    _formatExportValue(item.value),
                    _formatExportValue(item.hint)
                ]);
            });

            var wsHighlights = _appendGenericSheet(wb, 'Indicadores', highlightsMatrix, {
                merges: [
                    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
                    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }
                ],
                cols: [{ wch: 26 }, { wch: 18 }, { wch: 46 }],
                autofilterRow: 3
            });
            _decorateGenericSheet(wsHighlights, area, {
                titleRow: 0,
                subtitleRow: 1,
                headerRow: 3,
                bodyStartRow: 4
            });
        }

        if (Array.isArray(payload.charts) && payload.charts.length) {
            var chartsMatrix = [
                [payload.title || 'Exportacion'],
                ['Graficas clave'],
                [''],
                ['Grafica', 'Categoria', 'Valor', 'Participacion']
            ];

            payload.charts.forEach(function (chart) {
                var total = (chart.values || []).reduce(function (sum, value) {
                    return sum + (Number(value) || 0);
                }, 0);

                (chart.labels || []).forEach(function (label, index) {
                    var value = Number(chart.values[index]) || 0;
                    chartsMatrix.push([
                        index === 0 ? _formatExportValue(chart.title) : '',
                        _formatExportValue(label),
                        value,
                        total > 0 ? ((value / total) * 100).toFixed(1) + '%' : ''
                    ]);
                });

                chartsMatrix.push(['', '', '', '']);
            });

            var wsCharts = _appendGenericSheet(wb, 'Graficas', chartsMatrix, {
                merges: [
                    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
                    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }
                ],
                cols: [{ wch: 32 }, { wch: 32 }, { wch: 12 }, { wch: 14 }],
                autofilterRow: 3
            });
            _decorateGenericSheet(wsCharts, area, {
                titleRow: 0,
                subtitleRow: 1,
                headerRow: 3,
                bodyStartRow: 4,
                labelCol: 0
            });
        }

        (payload.sections || []).forEach(function (section, index) {
            if (!section || !Array.isArray(section.rows) || !section.rows.length) return;

            var headers = (section.headers || ['Valor', 'Cantidad']).map(_formatExportValue);
            var matrix = [
                [payload.title || 'Exportacion'],
                [section.title || ('Seccion ' + (index + 1))],
                [''],
                headers
            ];

            section.rows.forEach(function (row) {
                matrix.push(row.map(_formatExportValue));
            });

            var wsSection = _appendGenericSheet(wb, `${String(index + 1).padStart(2, '0')}_${section.title || 'Seccion'}`, matrix, {
                merges: [
                    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(headers.length - 1, 2) } },
                    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(headers.length - 1, 2) } }
                ],
                cols: _buildColumnWidths(matrix, 14, 34),
                autofilterRow: 3
            });
            _decorateGenericSheet(wsSection, area, {
                titleRow: 0,
                subtitleRow: 1,
                headerRow: 3,
                bodyStartRow: 4
            });
        });

        if (Array.isArray(payload.columns) && payload.columns.length) {
            var detailHeaders = payload.columns.map(_formatExportValue);
            var detailMatrix = [
                [payload.dataTitle || 'Detalle'],
                [payload.subtitle || areaName],
                [''],
                detailHeaders
            ];

            (payload.rows || []).forEach(function (row) {
                detailMatrix.push(row.map(_formatExportValue));
            });

            var wsDetail = _appendGenericSheet(wb, payload.detailSheetName || 'Detalle', detailMatrix, {
                merges: [
                    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(detailHeaders.length - 1, 2) } },
                    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(detailHeaders.length - 1, 2) } }
                ],
                cols: _buildColumnWidths(detailMatrix, 12, detailHeaders.length > 10 ? 20 : 30),
                autofilterRow: 3
            });
            _decorateGenericSheet(wsDetail, area, {
                titleRow: 0,
                subtitleRow: 1,
                headerRow: 3,
                bodyStartRow: 4
            });
        }

        XLSX.writeFile(wb, filename);
    }

    function _getAreaPalette(area) {
        return AREA_PALETTES[area] || AREA_PALETTES.DEFAULT;
    }

    function _getToneColor(area, tone) {
        var palette = _getAreaPalette(area);
        switch (tone) {
            case 'success': return palette.success;
            case 'warning': return palette.warning;
            case 'danger': return palette.danger;
            case 'accent': return palette.accent;
            case 'secondary': return [107, 114, 128];
            case 'info': return palette.accent;
            default: return palette.primary;
        }
    }

    function _toRgba(rgb, alpha) {
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
    }

    function _buildChartColors(area, tone, count) {
        var palette = _getAreaPalette(area);
        var base = _getToneColor(area, tone);
        var swatches = [
            base,
            palette.accent,
            palette.success,
            palette.warning,
            palette.danger,
            palette.dark,
            palette.primary,
            [107, 114, 128]
        ];
        var fills = [];
        var borders = [];
        var raws = [];

        for (var i = 0; i < Math.max(count || 0, 1); i++) {
            var color = swatches[i % swatches.length];
            raws.push(color);
            fills.push(_toRgba(color, 0.82));
            borders.push(_toRgba(color, 1));
        }

        return { fills: fills, borders: borders, raws: raws };
    }

    function _truncateChartLabel(value, maxLength) {
        var label = _formatExportValue(value).replace(/\s+/g, ' ').trim();
        var limit = maxLength || 28;
        if (!label) return '--';
        return label.length > limit ? label.slice(0, limit - 1) + '…' : label;
    }

    function _buildChartLegendRows(spec, area, maxItems) {
        if (!spec || !Array.isArray(spec.labels) || !Array.isArray(spec.values)) return [];

        var colors = _buildChartColors(area, spec.tone, spec.labels.length);
        var total = spec.values.reduce(function (sum, value) {
            return sum + (Number(value) || 0);
        }, 0);
        var limit = Math.min(spec.labels.length, maxItems || spec.labels.length);
        var rows = [];

        for (var i = 0; i < limit; i++) {
            var rawValue = Number(spec.values[i]) || 0;
            rows.push({
                color: colors.raws[i] || [148, 163, 184],
                label: _truncateChartLabel(spec.labels[i], spec.layout === 'half' ? 22 : 34),
                value: rawValue.toLocaleString('es-MX'),
                pct: total > 0 ? ((rawValue / total) * 100).toFixed(1) + '%' : ''
            });
        }

        if (spec.labels.length > limit) {
            rows.push({
                color: [148, 163, 184],
                label: '+' + (spec.labels.length - limit) + ' categorias mas',
                value: '',
                pct: ''
            });
        }

        return rows;
    }

    async function _renderChartImage(spec, area) {
        if (!window.Chart || !document.body || !spec || !Array.isArray(spec.labels) || !Array.isArray(spec.values)) return null;
        if (!spec.labels.length || spec.labels.length !== spec.values.length) return null;

        var palette = _getAreaPalette(area);
        var isCircular = spec.type === 'doughnut' || spec.type === 'pie';
        var isHorizontal = spec.type === 'bar-horizontal';
        var chartType = isHorizontal ? 'bar' : (spec.type || 'bar');
        var width = spec.layout === 'half' ? 520 : 920;
        var height = isCircular ? 320 : (isHorizontal ? 380 : 340);
        var mount = document.createElement('div');
        var canvas = document.createElement('canvas');
        var chart = null;

        mount.style.position = 'fixed';
        mount.style.left = '-10000px';
        mount.style.top = '0';
        mount.style.width = width + 'px';
        mount.style.height = height + 'px';
        mount.style.opacity = '0';
        mount.style.pointerEvents = 'none';

        canvas.width = width * 2;
        canvas.height = height * 2;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        mount.appendChild(canvas);
        document.body.appendChild(mount);

        try {
            var colors = _buildChartColors(area, spec.tone, spec.labels.length);
            var labels = spec.labels.map(function (label) {
                return _truncateChartLabel(label, isHorizontal ? 28 : 22);
            });
            var values = spec.values.map(function (value) {
                return Number(value) || 0;
            });

            chart = new window.Chart(canvas.getContext('2d'), {
                type: chartType,
                data: {
                    labels: labels,
                    datasets: [{
                        label: spec.title || 'Serie',
                        data: values,
                        backgroundColor: colors.fills,
                        borderColor: isCircular ? 'rgba(255,255,255,0.92)' : colors.borders,
                        borderWidth: isCircular ? 2 : 1.2,
                        borderRadius: isCircular ? 0 : 6,
                        maxBarThickness: isHorizontal ? 22 : 28
                    }]
                },
                options: {
                    responsive: false,
                    maintainAspectRatio: false,
                    animation: false,
                    indexAxis: isHorizontal ? 'y' : 'x',
                    layout: {
                        padding: { top: 6, right: 8, bottom: 2, left: 8 }
                    },
                    plugins: {
                        legend: {
                            display: spec.legend !== false && isCircular,
                            position: 'bottom',
                            labels: {
                                boxWidth: 10,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                color: palette.dark,
                                font: { size: 10 }
                            }
                        },
                        tooltip: { enabled: false }
                    },
                    scales: isCircular ? {} : {
                        x: {
                            beginAtZero: true,
                            grid: { color: 'rgba(148, 163, 184, 0.16)' },
                            ticks: {
                                color: palette.dark,
                                precision: 0,
                                font: { size: 10 }
                            }
                        },
                        y: {
                            grid: { display: false },
                            ticks: {
                                color: palette.dark,
                                font: { size: 10 }
                            }
                        }
                    }
                }
            });

            await new Promise(function (resolve) { setTimeout(resolve, 40); });
            return canvas.toDataURL('image/png', 1.0);
        } catch (e) {
            return null;
        } finally {
            if (chart) {
                try { chart.destroy(); } catch (destroyError) { /* noop */ }
            }
            mount.remove();
        }
    }

    function _formatExportValue(value) {
        if (value === undefined || value === null) return '';
        if (value instanceof Date) return value.toLocaleString('es-MX');
        if (Array.isArray(value)) return value.map(_formatExportValue).join(', ');
        return String(value);
    }

    function _safeSheetName(name, fallback) {
        var clean = String(name || fallback || 'Hoja')
            .replace(/[\\/*?:[\]]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return (clean || fallback || 'Hoja').slice(0, 31);
    }

    function _buildColumnWidths(matrix, fallbackWidth, maxWidth) {
        var rows = Array.isArray(matrix) ? matrix : [];
        var maxCols = rows.reduce(function (max, row) {
            return Math.max(max, Array.isArray(row) ? row.length : 0);
        }, 0);
        var floor = fallbackWidth || 14;
        var ceiling = maxWidth || 40;
        var cols = [];

        for (var c = 0; c < maxCols; c++) {
            var width = floor;
            rows.forEach(function (row) {
                var len = _formatExportValue(row[c]).length;
                width = Math.max(width, Math.min(ceiling, len + 2));
            });
            cols.push({ wch: width });
        }

        return cols;
    }

    function _appendGenericSheet(wb, name, matrix, options) {
        var opts = options || {};
        var ws = XLSX.utils.aoa_to_sheet(matrix);
        ws['!cols'] = opts.cols || _buildColumnWidths(matrix, 14, 42);
        if (opts.merges) ws['!merges'] = opts.merges;

        if (Number.isFinite(opts.autofilterRow) && matrix[opts.autofilterRow] && matrix[opts.autofilterRow].length) {
            ws['!autofilter'] = {
                ref: XLSX.utils.encode_range({
                    s: { r: opts.autofilterRow, c: 0 },
                    e: { r: opts.autofilterRow, c: matrix[opts.autofilterRow].length - 1 }
                })
            };
        }

        XLSX.utils.book_append_sheet(wb, ws, _safeSheetName(name, 'Hoja'));
        return ws;
    }

    // ==================== PDF HELPERS ====================

    function _headerBar(doc, pw, title) {
        doc.setFillColor(...BLUE);
        doc.rect(0, 0, pw, 12, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('SIA — ' + title, M, 8);
        doc.text(new Date().toLocaleDateString('es-MX'), pw - M, 8, { align: 'right' });
    }

    function _sectionLabel(doc, text, y) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...BLUE);
        doc.text(text, M, y);
        var pw = doc.internal.pageSize.getWidth();
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(M, y + 1.5, pw - M, y + 1.5);
    }

    function _drawMetricBox(doc, x, y, w, h, label, value, color) {
        var rgb = _hexToRgb(color);
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.roundedRect(x, y, w, h, 2, 2, 'F');
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(255, 255, 255);
        doc.text(label, x + 4, y + 6);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(String(value), x + w - 4, y + 12, { align: 'right' });
    }

    function _compactTable(doc, title, dataObj, total, y, headerColor, sortDesc) {
        var entries = Object.entries(dataObj);
        if (sortDesc) entries.sort(function (a, b) { return b[0] - a[0]; });
        else entries.sort(function (a, b) { return b[1] - a[1]; });
        var rows = entries.map(function (e) { return [String(e[0]), e[1], _pct(e[1], total)]; });

        doc.autoTable({
            startY: y,
            head: [[title, 'Cant.', '%']],
            body: rows,
            margin: { left: M, right: M },
            theme: 'striped',
            headStyles: { fillColor: headerColor, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold', cellPadding: 1.5 },
            bodyStyles: { fontSize: 7, cellPadding: 1.2 },
            alternateRowStyles: { fillColor: ALT_ROW },
            columnStyles: { 1: { halign: 'center', cellWidth: 18 }, 2: { halign: 'center', cellWidth: 18 } }
        });
        return doc.lastAutoTable.finalY + 5;
    }

    function _captureMainChart(area) {
        var ids = { BIBLIO: 'biblio-visit-line', MEDICO: 'medico-consult-line', POBLACION: 'pob-demo-carrera-bar' };
        var canvas = document.getElementById(ids[area]);
        if (!canvas) return null;
        try { return canvas.toDataURL('image/png', 1.0); } catch (e) { return null; }
    }

    function _getMetricBoxes(stats, area) {
        if (area === 'BIBLIO') return [
            { label: 'Total Registros', value: stats.total.toLocaleString('es-MX'), color: '#3b82f6' },
            { label: 'Promedio/Día', value: stats.avgDaily.toFixed(1), color: '#10b981' },
            { label: 'Visitas', value: (stats.visitas || 0).toLocaleString('es-MX'), color: '#f59e0b' },
            { label: 'Préstamos', value: (stats.prestamos || 0).toLocaleString('es-MX'), color: '#6366f1' }
        ];
        if (area === 'MEDICO') return [
            { label: 'Total Consultas', value: stats.total.toLocaleString('es-MX'), color: '#3b82f6' },
            { label: 'Promedio/Día', value: stats.avgDaily.toFixed(1), color: '#10b981' },
            { label: 'Médicas', value: (stats.medicas || 0).toLocaleString('es-MX'), color: '#6366f1' },
            { label: 'Psicológicas', value: (stats.psicologicas || 0).toLocaleString('es-MX'), color: '#0ea5e9' }
        ];
        return [
            { label: 'Total Usuarios', value: stats.total.toLocaleString('es-MX'), color: '#10b981' },
            { label: 'Estudiantes', value: (stats.estudiantes || 0).toLocaleString('es-MX'), color: '#3b82f6' },
            { label: 'Docentes', value: (stats.docentes || 0).toLocaleString('es-MX'), color: '#f59e0b' },
            { label: 'Administrativos', value: (stats.administrativos || 0).toLocaleString('es-MX'), color: '#8b5cf6' },
            { label: 'Admins Módulo', value: (stats.adminsModulo || 0).toLocaleString('es-MX'), color: '#6b7280' }
        ];
    }

    function _getDetailColumns(area) {
        if (area === 'BIBLIO') return ['Fecha', 'Usuario', 'Matrícula', 'Tipo', 'Detalle', 'Estado'];
        if (area === 'MEDICO') return ['Fecha', 'Paciente', 'Tipo', 'Motivo', 'Profesional'];
        return ['Nombre', 'Matrícula', 'Carrera', 'Género', 'Turno'];
    }

    function _getDetailRow(d, area) {
        var f = d.fecha instanceof Date ? d.fecha.toLocaleDateString('es-MX') : '';
        if (area === 'BIBLIO') return [f, d.usuario || '', d.matricula || '', d.tipo || '', (d.detalle || '').substring(0, 35), d.status || ''];
        if (area === 'MEDICO') return [f, d.usuario || '', d.tipo || '', (d.detalle || '').substring(0, 30), d.profesional || ''];
        return [d.usuario || '', d.matricula || '', d.carrera || '', d.genero || '', d.turno || ''];
    }

    // ==================== EXCEL HELPERS ====================

    function _getExcelHeaders(area) {
        if (area === 'BIBLIO') return ['Fecha', 'Usuario', 'Matrícula', 'Tipo', 'Detalle', 'Estado', 'Carrera', 'Género', 'Turno'];
        if (area === 'MEDICO') return ['Fecha', 'Paciente', 'Tipo', 'Motivo', 'Diagnóstico', 'Profesional', 'Carrera', 'Género'];
        return ['Nombre', 'Matrícula', 'Carrera', 'Género', 'Turno', 'Generación', 'Estado Civil', 'Beca'];
    }

    function _getExcelRow(d, area) {
        var f = d.fecha instanceof Date ? d.fecha.toLocaleDateString('es-MX') : '';
        if (area === 'BIBLIO') return [f, d.usuario || '', d.matricula || '', d.tipo || '', d.detalle || '', d.status || '', d.carrera || '', d.genero || '', d.turno || ''];
        if (area === 'MEDICO') return [f, d.usuario || '', d.tipo || '', d.detalle || '', d.diagnostico || '', d.profesional || '', d.carrera || '', d.genero || ''];
        return [d.usuario || '', d.matricula || '', d.carrera || '', d.genero || '', d.turno || '', d.generacion || '', d.estadoCivil || '', d.beca || ''];
    }

    function _getExcelWidths(area) {
        if (area === 'BIBLIO') return [{ wch: 12 }, { wch: 25 }, { wch: 14 }, { wch: 18 }, { wch: 30 }, { wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 12 }];
        if (area === 'MEDICO') return [{ wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 22 }, { wch: 25 }, { wch: 10 }];
        return [{ wch: 25 }, { wch: 14 }, { wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 12 }];
    }

    function _addExcelSection(arr, title, dataObj, total, sortDesc) {
        if (Object.keys(dataObj).length === 0) return;
        arr.push([title]);
        arr.push([title.charAt(0) + title.slice(1).toLowerCase(), 'Cantidad', 'Porcentaje']);
        var entries = Object.entries(dataObj);
        if (sortDesc) entries.sort(function (a, b) { return b[0] - a[0]; });
        else entries.sort(function (a, b) { return b[1] - a[1]; });
        entries.forEach(function (e) { arr.push([String(e[0]), e[1], _pct(e[1], total)]); });
        arr.push(['']);
    }

    // ==================== SHARED ====================

    function _pct(count, total) {
        return total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%';
    }

    function _hexToRgb(hex) {
        var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : { r: 0, g: 0, b: 0 };
    }

    function _calcStats(data, area) {
        var stats = {
            total: data.length,
            byTipo: {}, byGenero: {}, byCarrera: {}, byTurno: {}, byGeneracion: {},
            byStatus: {}, byDay: {}, byHour: {}, byDiagnostico: {},
            avgDaily: 0, peakHour: '--', completionRate: 0,
            visitas: 0, prestamos: 0, medicas: 0, psicologicas: 0,
            estudiantes: 0, docentes: 0, administrativos: 0, adminsModulo: 0
        };

        data.forEach(function (item) {
            if (item.tipo) stats.byTipo[item.tipo] = (stats.byTipo[item.tipo] || 0) + 1;
            if (item.genero) stats.byGenero[item.genero] = (stats.byGenero[item.genero] || 0) + 1;
            if (item.carrera && item.carrera !== 'N/A') stats.byCarrera[item.carrera] = (stats.byCarrera[item.carrera] || 0) + 1;
            if (item.turno && item.turno !== 'N/A') stats.byTurno[item.turno] = (stats.byTurno[item.turno] || 0) + 1;
            if (item.generacion) stats.byGeneracion[item.generacion] = (stats.byGeneracion[item.generacion] || 0) + 1;
            if (item.status) stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;

            if (item.fecha instanceof Date) {
                var dk = item.fecha.toISOString().split('T')[0];
                stats.byDay[dk] = (stats.byDay[dk] || 0) + 1;
            }
            if (item.hora !== undefined) {
                var hk = String(item.hora).padStart(2, '0') + ':00';
                stats.byHour[hk] = (stats.byHour[hk] || 0) + 1;
            }
            if (item.diagnostico) stats.byDiagnostico[item.diagnostico] = (stats.byDiagnostico[item.diagnostico] || 0) + 1;

            if (item.subarea === 'Visitas') stats.visitas++;
            if (item.subarea === 'Préstamos') stats.prestamos++;
            if (item.tipo === 'Consulta Médica') stats.medicas++;
            if (item.tipo === 'Consulta Psicológica') stats.psicologicas++;
            if (item.subarea === 'ESTUDIANTE') stats.estudiantes++;
            if (item.subarea === 'DOCENTE') stats.docentes++;
            if (item.subarea === 'ADMINISTRATIVO') stats.administrativos++;
            if (item.subarea === 'ADMIN_MODULO') stats.adminsModulo++;
        });

        var days = Object.keys(stats.byDay).length || 1;
        stats.avgDaily = Math.round(stats.total / days * 10) / 10;

        var peakCount = 0;
        Object.entries(stats.byHour).forEach(function (e) {
            if (e[1] > peakCount) { peakCount = e[1]; stats.peakHour = e[0]; }
        });

        var completed = Object.entries(stats.byStatus)
            .filter(function (e) {
                var sl = e[0].toLowerCase();
                return sl.includes('completado') || sl.includes('finaliz') || sl.includes('devuelto') || sl === 'entregado';
            })
            .reduce(function (sum, e) { return sum + e[1]; }, 0);
        stats.completionRate = stats.total > 0 ? Math.round(completed / stats.total * 100) : 0;

        return stats;
    }

    return { generatePDF: generatePDF, generateExcel: generateExcel };
})();
