/**
 * time-utils.js
 * Utilidades centralizadas para manejo de fechas y tiempos en SIA.
 * Soluciona la inconsistencia entre Firestore Timestamps, Dates nativos y Strings.
 */

const TimeUtils = {
    /**
     * Convierte cualquier entrada de fecha (Firestore Timestamp, Date, String ISO)
     * a un objeto Date nativo de JavaScript válido.
     * @param {any} input - La entrada a convertir.
     * @returns {Date|null} - Objeto Date válido o null si la entrada no es válida.
     */
    toDate(input) {
        if (!input) return null;

        // Caso 1: Firestore Timestamp (tiene método toDate)
        if (typeof input.toDate === 'function') {
            try {
                return input.toDate();
            } catch (e) {
                console.warn("[TimeUtils] Error convirtiendo Timestamp:", e);
                return null;
            }
        }

        // Caso 2: Objeto Date nativo
        if (input instanceof Date) {
            return isNaN(input.getTime()) ? null : input;
        }

        // Caso 3: String (ISO) o Number (ms)
        if (typeof input === 'string' || typeof input === 'number') {
            const date = new Date(input);
            return isNaN(date.getTime()) ? null : date;
        }

        // Caso 4: Objeto tipo { seconds, nanoseconds } crudo (serialización a veces pasa esto)
        if (typeof input === 'object' && 'seconds' in input) {
            return new Date(input.seconds * 1000);
        }

        return null;
    },

    /**
     * Formatea una fecha a String local legible.
     * @param {any} input 
     * @param {Intl.DateTimeFormatOptions} options 
     */
    formatDate(input, options = { dateStyle: 'medium', timeStyle: 'short' }) {
        const date = this.toDate(input);
        if (!date) return 'Fecha inválida';
        try {
            return new Intl.DateTimeFormat('es-MX', options).format(date);
        } catch (e) {
            return date.toLocaleString();
        }
    },

    /**
     * Devuelve texto relativo "hace X tiempo" (Simple)
     */
    timeAgo(input) {
        const date = this.toDate(input);
        if (!date) return '';
        
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
      
        if (interval > 1) return `hace ${Math.floor(interval)} años`;
        interval = seconds / 2592000;
        if (interval > 1) return `hace ${Math.floor(interval)} meses`;
        interval = seconds / 86400;
        if (interval > 1) return `hace ${Math.floor(interval)} días`;
        interval = seconds / 3600;
        if (interval > 1) return `hace ${Math.floor(interval)} h`;
        interval = seconds / 60;
        if (interval > 1) return `hace ${Math.floor(interval)} min`;
        return "hace un momento";
    }
};

// Exportar globalmente para uso en módulos sin build system (vanilla JS)
window.TimeUtils = TimeUtils;
