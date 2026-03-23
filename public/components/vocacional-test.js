// public/components/vocacional-test.js
// Dependencias cargadas globalmente en index.html (VocacionalService, VOCACIONAL_TEST_DATA)

class VocacionalTest extends HTMLElement {
    constructor() {
        super();
        this.aspiranteId = localStorage.getItem('sia_vocacional_id') || null;
        this.aspiranteData = null; // Cargar si viene de resume
        this.currentBlockIndex = 0;
        this.currentSubPage = 0; // Para paginar bloques largos
        this.QUESTIONS_PER_PAGE = 5;
        this.answers = {}; // Acumulado de progreso
        this.isCalculating = false;
    }

    connectedCallback() {
        // Se deja vacío. La inicialización real la dispara el router (app.js) mediante initTest()
    }

    getQuestionsForBlock(block) {
        let questionsToProcess = [];
        let tecCareer = null;
        if (this.aspiranteData && this.aspiranteData.personalInfo) {
            tecCareer = this.aspiranteData.personalInfo.technicalCareer;
        }
        if (block.isAdaptive && block.groups && tecCareer) {
            const activeGroup = block.groups.find(g => g.conditions && g.conditions.includes(tecCareer));
            if (activeGroup && activeGroup.questions) {
                questionsToProcess = activeGroup.questions;
            } else if (block.questions) {
                questionsToProcess = block.questions;
            }
        } else if (block.questions) {
            questionsToProcess = block.questions;
        }
        return questionsToProcess || [];
    }

    async initTest(ctx) {
        // Asegurarse de tener el ID más reciente
        this.aspiranteId = localStorage.getItem('sia_vocacional_id') || null;

        if (!this.aspiranteId) {
            this.showError("No se encontró una sesión activa. Redirigiendo...");
            setTimeout(() => {
                window.location.hash = '#/test-vocacional';
            }, 2000);
            return;
        }

        // Recuperar progreso si existe (para reconexiones o f5)
        try {
            this.showLoading();

            // Asegurar que la configuración y preguntas estén cargadas desde Firestore/JSON
            await VocacionalService.initTestData();

            const data = await VocacionalService.getAspiranteResults(this.aspiranteId);
            if (!data) throw new Error("Aspirante no encontrado");

            this.aspiranteData = data;

            if (data.testStatus === 'completed') {
                this.renderResultsScreen(data);
                return;
            }

            // Continuar desde el bloque guardado
            this.currentBlockIndex = (data.currentBlock || 1) - 1;
            this.currentSubPage = 0; // Reiniciar subpágina al reconectar
            this.answers = data.answers || {};

            this.render();

        } catch (e) {
            console.error(e);
            this.showError("Hubo un problema al cargar tu sesión.");
        }
    }

    showLoading() {
        this.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 50vh;">
                <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
    }

    showError(msg) {
        this.innerHTML = `
             <div class="alert alert-danger shadow-sm text-center">
                <i class="bi bi-exclamation-triangle-fill fs-3 d-block mb-2"></i>
                <p class="mb-0 fw-bold">${msg}</p>
             </div>
        `;
    }

    render() {
        const block = VocacionalService.VOCACIONAL_TEST_DATA[this.currentBlockIndex];
        const blockQuestions = this.getQuestionsForBlock(block);

        // Paginación del bloque
        const totalSubPages = Math.ceil(blockQuestions.length / this.QUESTIONS_PER_PAGE);
        const startIndex = this.currentSubPage * this.QUESTIONS_PER_PAGE;
        const currentQuestions = blockQuestions.slice(startIndex, startIndex + this.QUESTIONS_PER_PAGE);

        // Progreso global (estimado basado en bloques y subpáginas)
        const totalSubPagesGlobal = VocacionalService.VOCACIONAL_TEST_DATA.reduce((acc, b) => acc + Math.ceil(this.getQuestionsForBlock(b).length / this.QUESTIONS_PER_PAGE), 0);
        const currentGlobalSubPage = VocacionalService.VOCACIONAL_TEST_DATA.slice(0, this.currentBlockIndex).reduce((acc, b) => acc + Math.ceil(this.getQuestionsForBlock(b).length / this.QUESTIONS_PER_PAGE), 0) + this.currentSubPage;
        const progressPercent = totalSubPagesGlobal > 0 ? Math.round((currentGlobalSubPage / totalSubPagesGlobal) * 100) : 0;

        // Textos del botón
        const isLastSubPage = this.currentSubPage === totalSubPages - 1;
        const isLastBlock = this.currentBlockIndex === VocacionalService.VOCACIONAL_TEST_DATA.length - 1;

        let buttonText = 'Siguiente Parte <i class="bi bi-arrow-right-circle-fill fs-5 ms-2"></i>';
        if (isLastSubPage) {
            buttonText = isLastBlock ? 'Finalizar y ver Resultados <i class="bi bi-stars fs-5 ms-2"></i>' : 'Siguiente Bloque <i class="bi bi-arrow-right-circle-fill fs-5 ms-2"></i>';
        }

        this.innerHTML = `
            <div class="test-page-wrapper min-vh-100 py-4 py-md-5">
                <div class="container position-relative z-1" style="max-width: 900px;" id="test-container">
                    
                    <!-- Header del Test -->
                    <div class="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom border-light">
                        <img src="/images/logo-sia.png" alt="TecNM" style="height: 40px; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.1));">
                        <div class="d-flex align-items-center gap-3">
                            <div class="progress-indicator d-none d-sm-flex align-items-center bg-white rounded-pill px-3 py-2 shadow-sm">
                                <span class="fw-bold text-primary me-2">Bloque ${block.block}</span>
                                <span class="text-muted small">Parte ${this.currentSubPage + 1} de ${totalSubPages}</span>
                            </div>
                            <button class="btn btn-outline-danger btn-sm rounded-pill px-3 fw-bold btn-exit-test shadow-sm" id="v-exit-btn">Salir <i class="bi bi-x-lg ms-1"></i></button>
                        </div>
                    </div>

                    <!-- Progress Bar -->
                    <div class="progress mb-5 shadow-sm" style="height: 8px; background-color: rgba(255,255,255,0.5); border-radius: 10px; overflow: hidden;">
                        <div class="progress-bar bg-primary transition-all progress-bar-striped progress-bar-animated" role="progressbar" style="width: ${progressPercent}%; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                    </div>

                    <!-- Presentación del Bloque (Card estilo Mockup) -->
                    <div class="text-center mb-5 animate-slide-up bg-white rounded-4 p-4 p-md-5 shadow-sm border border-light" style="border-radius: 20px;">
                        <span class="badge text-primary px-3 py-2 mb-3 fw-bold tracking-wider text-uppercase" style="background-color: #e6f0ff; font-size: 0.75rem; border-radius: 20px;">BLOQUE ${block.block}</span>
                        <h2 class="fw-bolder mb-3 text-gradient" style="font-size: 2.2rem; letter-spacing: -0.5px; color: #1a365d;">${block.title}</h2>
                        <p class="fs-5 text-secondary mb-4" style="line-height: 1.6; color: #6c757d;">${block.subtitle}</p>
                        <div class="d-inline-flex align-items-center rounded-pill px-4 py-2 text-muted small fw-bold text-uppercase tracking-wider" style="background-color: #f8f9fa;">
                            <div class="rounded-circle text-white d-flex align-items-center justify-content-center me-2" style="background-color: #0d6efd; width: 18px; height: 18px; font-size: 11px;">i</div>
                            Califica de "Nada" (1) a "Totalmente" (5)
                        </div>
                    </div>

                    <!-- Tarjetas de Preguntas -->
                    <form id="vocacional-block-form">
                        <div class="row g-4 mb-4">
                            ${currentQuestions.map((q, idx) => this.renderQuestionCard(q, startIndex + idx)).join('')}
                        </div>

                        <div class="d-flex justify-content-center justify-content-md-end mt-5 pb-5">
                            <button type="submit" class="btn btn-primary btn-lg rounded-pill px-5 py-3 shadow-lg hover-elevate-lg fw-bold d-flex align-items-center justify-content-center" id="v-next-btn" style="background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%); border: none; min-width: 250px;">
                                ${buttonText}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <style>
                /* Fondo y layout base */
                .test-page-wrapper {
                    background-color: #eef2f6; /* Fondo azul grisáceo muy claro */
                    background-image: 
                        linear-gradient(to right bottom, rgba(230,240,255,0.7), rgba(240,245,250,0.4));
                    background-attachment: fixed;
                }
                
                .text-gradient {
                    color: #1a365d;
                }

                .tracking-wider { letter-spacing: 0.05em; }
                .transition-all { transition: all 0.4s ease; }

                .q-card { 
                    border: none;
                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); 
                    border-radius: 20px; 
                    background: #ffffff; 
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03); 
                }
                .q-card:hover { 
                    transform: translateY(-2px); 
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.06); 
                }

                /* Animaciones de Entrada */
                .animate-slide-up { animation: slideUpFade 0.5s ease-out forwards; }
                @keyframes slideUpFade {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }

                /* Escala Likert de colores Premium Interactivo (Mockup exacto) */
                .likert-radio { display: none; }
                
                .likert-container {
                    background-color: #fbfbfc;
                    border-radius: 50px;
                    padding: 8px 12px;
                    border: 1px solid #eef0f3;
                }

                .likert-label {
                    cursor: pointer;
                    width: 44px; height: 44px;
                    display: flex; align-items: center; justify-content: center;
                    border-radius: 50%;
                    background-color: #ffffff;
                    border: 1px solid #e2e8f0;
                    font-weight: 700;
                    color: #64748b;
                    transition: all 0.2s ease; 
                    font-size: 1.05rem;
                }
                .likert-label:hover { 
                    background-color: #f8fafc; 
                    border-color: #cbd5e1; 
                }
                
                /* Estado seleccionado dinámico - Gradiente azul */
                .likert-radio:checked + .likert-label { 
                    background: #0d6efd;
                    border-color: transparent; 
                    color: white; 
                    box-shadow: 0 4px 12px rgba(13,110,253,0.25); 
                }

                /* Botones de acción */
                .btn-exit-test {
                    transition: all 0.2s ease;
                    background-color: white;
                }
                .btn-exit-test:hover {
                    background-color: #dc3545;
                    color: white;
                }
                
                .hover-elevate-lg { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
                .hover-elevate-lg:hover { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(13,110,253,0.3) !important; }

                /* Responsividad extra */
                @media (max-width: 768px) {
                    .likert-label { width: 38px; height: 38px; font-size: 1rem; }
                    .likert-container { padding: 6px 8px; flex-wrap: wrap; }
                    .q-card { padding: 1.5rem !important; }
                }
            </style>
        `;

        this.setupEventListeners();
    }


    renderQuestionCard(q, idx) {
        const delay = (idx % this.QUESTIONS_PER_PAGE) * 0.08;
        const prevAnswer = this.answers[q.id];

        const generateRadios = () => {
            let html = '';
            for (let i = 1; i <= 5; i++) {
                const id = `q_${q.id}_val_${i}`;
                const checked = prevAnswer == i ? 'checked' : '';
                html += `
                    <div class="mx-1 mx-sm-2 text-center position-relative">
                        <input type="radio" class="likert-radio" name="${q.id}" id="${id}" value="${i}" required ${checked}>
                        <label class="likert-label" for="${id}">${i}</label>
                    </div>
                 `;
            }
            return html;
        };

        return `
            <div class="col-12 animate-slide-up" style="animation-delay: ${delay}s; opacity: 0;">
                <div class="q-card p-4 p-md-5">
                    <div class="row text-center text-md-start">
                        <div class="col-12 mb-4">
                            <span class="d-inline-flex align-items-center fw-bold text-uppercase tracking-wider rounded-pill text-secondary px-3 py-1 mb-3" style="font-size: 0.75rem; background-color: #f1f5f9;">
                                PREGUNTA ${idx + 1}
                            </span>
                            <h5 class="fw-bold mb-0 lh-base" style="font-size: 1.35rem; color: #1e293b;">${q.text}</h5>
                        </div>
                        <div class="col-12">
                            <div class="d-flex align-items-center justify-content-center justify-content-md-start likert-container mx-auto mx-md-0" style="width: fit-content;">
                                <span class="small fw-bold me-2 me-sm-3 d-none d-sm-block text-secondary" style="font-size: 0.85rem;">Nada</span>
                                ${generateRadios()}
                                <span class="small fw-bold ms-2 ms-sm-3 d-none d-sm-block text-secondary" style="font-size: 0.85rem;">Totalmente</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const form = this.querySelector('#vocacional-block-form');
        const exitBtn = this.querySelector('#v-exit-btn');

        if (exitBtn) {
            exitBtn.addEventListener('click', () => {
                if (confirm("Tu progreso hasta esta parte ha sido guardado automáticamente. ¿Seguro que deseas salir del test?")) {
                    window.location.hash = '#/test-vocacional';
                }
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btn = this.querySelector('#v-next-btn');
            const originalContent = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

            const formData = new FormData(form);
            const currentBlockAnswers = {};
            for (let [key, value] of formData.entries()) {
                currentBlockAnswers[key] = parseInt(value);
            }

            try {
                this.answers = { ...this.answers, ...currentBlockAnswers };

                const blockObj = VocacionalService.VOCACIONAL_TEST_DATA[this.currentBlockIndex];
                await VocacionalService.saveTestProgress(this.aspiranteId, blockObj.block, this.answers);

                const blockQuestions = this.getQuestionsForBlock(blockObj);
                const totalSubPages = Math.ceil(blockQuestions.length / this.QUESTIONS_PER_PAGE);

                if (this.currentSubPage < totalSubPages - 1) {
                    this.currentSubPage++;
                    this.transitionAndRender();
                } else if (this.currentBlockIndex < VocacionalService.VOCACIONAL_TEST_DATA.length - 1) {
                    this.currentBlockIndex++;
                    this.currentSubPage = 0;
                    this.transitionAndRender();
                } else {
                    this.isCalculating = true;
                    this.showCalculatingScreen();
                    const resultsData = await VocacionalService.calculateAndFinish(this.aspiranteId);
                    setTimeout(() => {
                        this.isCalculating = false;
                        this.renderResultsScreen(resultsData);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }, 2000);
                }
            } catch (error) {
                console.error(error);
                alert("Ocurrió un error al guardar tus respuestas. Revisa tu conexión.");
                btn.disabled = false;
                btn.innerHTML = originalContent;
            }
        });

    }

    transitionAndRender() {
        const container = this.querySelector('#test-container');
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.2s ease';
        setTimeout(() => {
            this.render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 200);
    }

    showCalculatingScreen() {
        this.innerHTML = `
            <div class="container py-5 text-center d-flex flex-column align-items-center justify-content-center" style="min-height: 70vh;">
                <div class="spinner-grow text-primary mb-4" style="width: 4rem; height: 4rem;" role="status">
                  <span class="visually-hidden">Calculando...</span>
                </div>
                <h2 class="fw-bold text-dark animate-fade-in-up">Procesando tu perfil vocacional...</h2>
                <p class="text-muted fs-5 animate-fade-in-up" style="animation-delay: 0.1s;">Analizando tus intereses, aptitudes y antecedentes técnicos a través de nuestro modelo de Afinidad ($A_f$)...</p>
            </div>
            <style>
                .animate-fade-in-up {animation: fadeInUp 0.5s ease-out forwards; }
                @keyframes fadeInUp {from {opacity: 0; transform: translateY(20px); } to {opacity: 1; transform: translateY(0); } }
            </style>
        `;
    }

    renderResultsScreen(data) {
        const top3 = data.recommendedCareers || [];
        const top1 = top3[0] || null;

        if (!top1) {
            this.showError("No se pudieron generar los resultados.");
            return;
        }

        // Lanzar Confetti festivo
        if (typeof window.confetti === 'function') {
            window.confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, zIndex: 9999, colors: ['#0d6efd', '#20c997', '#ffc107', '#dc3545'] });
        } else {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
            script.onload = () => {
                window.confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, zIndex: 9999, colors: ['#0d6efd', '#20c997', '#ffc107', '#dc3545'] });
            };
            document.head.appendChild(script);
        }

        this.innerHTML = `
            <div class="container py-5 animate-fade-in-up" style="max-width: 900px;">
                
                <!-- HEADER RESULTADOS -->
                <div class="text-center mb-5">
                    <span class="badge bg-success bg-opacity-10 text-success mb-3 px-3 py-2 rounded-pill fs-6 border border-success border-opacity-25">
                        <i class="bi bi-patch-check-fill me-2"></i>Test Completado
                    </span>
                    <h1 class="fw-bold text-dark display-5 mb-2">Tu Perfil Ideal</h1>
                    <p class="text-muted fs-5">Basado en tu análisis, esta es la ruta académica que mejor potenciará tus habilidades.</p>
                </div>

                <!-- TOP 1 CARD (RECOMENDACIÓN PRINCIPAL) -->
                <div class="card border-0 shadow-lg rounded-4 overflow-hidden mb-5 position-relative bg-white top-card-glow">
                    <!-- Banda lateral de color para Top 1 -->
                    <div class="position-absolute top-0 bottom-0 start-0" style="width: 8px; background: linear-gradient(180deg, #0d6efd 0%, #0dcaf0 100%);"></div>
                    
                    <div class="card-body p-4 p-md-5 ms-2">
                        <div class="row align-items-center">
                            <div class="col-md-8 text-center text-md-start mb-4 mb-md-0">
                                <span class="badge bg-primary rounded-pill mb-2 px-3 py-1 fw-normal"><i class="bi bi-trophy-fill text-warning me-2"></i>Opción Principal</span>
                                <h2 class="fw-bold mb-2 text-dark" style="font-size: 2.5rem;">${top1.name}</h2>
                                <h5 class="text-primary mb-3"><i class="bi ${top1.icon} me-2"></i>Área: ${top1.type}</h5>
                                
                                ${top1.isDirectMatch ? `
                                    <div class="alert alert-info border-0 bg-info bg-opacity-10 d-inline-block shadow-sm">
                                        <i class="bi bi-lightning-charge-fill text-info me-2"></i>
                                        <strong>¡Afinidad Técnica!</strong> Detectamos que tus conocimientos técnicos de la prepa son directamente transferibles a esta carrera.
                                    </div>
                                ` : ''}

                                <p class="text-muted mt-3 mb-0">Esta carrera se alinea fuertemente con la forma en que resuelves problemas y tus áreas de interés personal.</p>
                            </div>
                            
                            <!-- Gráfica Radial o Medidor -->
                            <div class="col-md-4 d-flex flex-column align-items-center justify-content-center border-start-md">
                                <div class="position-relative d-flex align-items-center justify-content-center mb-3" style="width: 150px; height: 150px;">
                                    <svg class="progress-ring" width="150" height="150">
                                        <circle class="progress-ring__circle" stroke="#e9ecef" stroke-width="12" fill="transparent" r="65" cx="75" cy="75"/>
                                        <circle class="progress-ring__circle-fill" stroke="#0d6efd" stroke-width="12" stroke-linecap="round" fill="transparent" r="65" cx="75" cy="75" 
                                        style="stroke-dasharray: 408; stroke-dashoffset: ${408 - (408 * top1.percentage) / 100}; transition: stroke-dashoffset 1.5s ease-in-out; transform: rotate(-90deg); transform-origin: 50% 50%;"/>
                                    </svg>
                                    <div class="position-absolute text-center">
                                        <h3 class="fw-bold text-dark mb-0">${top1.percentage}%</h3>
                                        <span class="small text-muted fw-bold">Afinidad</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- OTRAS OPCIONES & ACCIONES -->
                <div class="row g-4">
                    <!-- Alternativas Top 2 y 3 -->
                    <div class="col-lg-6">
            <h5 class="fw-bold mb-3 text-secondary">Otras Opciones Compatibles</h5>

            ${top3.slice(1).map((c, i) => `
                            <div class="card border border-light shadow-sm rounded-4 mb-3 hover-elevate bg-white">
                                <div class="card-body p-4 d-flex align-items-center">
                                    <div class=" rounded-circle p-3 me-4 text-primary">
                                        <i class="bi ${c.icon} fs-3"></i>
                                    </div>
                                    <div class="flex-grow-1">
                                        <h5 class="fw-bold text-dark mb-1">${c.name}</h5>
                                        <span class="small text-muted">${c.type}</span>
                                    </div>
                                    <div class="text-end ms-3">
                                        <h5 class="fw-bold text-primary mb-0">${c.percentage}%</h5>
                                        <span class="extra-small text-muted fw-bold d-block">Afinidad</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
        </div>

        <!-- Call to Action / PDF -->
        <div class="col-lg-6">
            <div class="card border-0 shadow-sm rounded-4 bg-primary text-white h-100 banner-cta">
                <div class="card-body p-4 p-md-5 d-flex flex-column justify-content-center align-items-center text-center">
                    <i class="bi bi-file-earmark-pdf-fill display-4 mb-3 text-white opacity-75"></i>
                    <h4 class="fw-bold mb-2">Tu Ruta Académica</h4>
                    <p class="opacity-75 mb-4 px-3">Descarga tu análisis completo. Incluye fechas oficiales de entrega de fichas, examen y contactos directos.</p>

                    <button class="btn btn-light btn-lg rounded-pill fw-bold w-100 shadow-sm pdf-btn mb-3" id="generate-pdf-btn">
                        <i class="bi bi-download me-2 text-primary"></i>Descargar Reporte PDF
                    </button>

                    <button class="btn btn-outline-light btn-lg rounded-pill fw-bold w-100 shadow-sm border-2 mb-3 px-3 py-2" id="restart-test-btn" style="transition: all 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">
                        <i class="bi bi-arrow-repeat me-2"></i>Volver a hacer el test
                    </button>

                    <a href="#/test-vocacional" class="btn btn-link text-white text-decoration-none mt-auto opacity-75 hover-opacity-100">
                        <i class="bi bi-house-door-fill me-1"></i>Volver al Inicio
                    </a>
                </div>
            </div>
        </div>
    </div>

            </div>

    <style>
        .top-card-glow {box-shadow: 0 1rem 3rem rgba(13,110,253,0.1) !important; border: 1px solid rgba(13,110,253,0.1); }
        .hover-elevate {transition: transform 0.2s ease, box-shadow 0.2s ease; cursor: pointer; }
        .hover-elevate:hover {transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.08) !important; }
        .banner-cta {
            background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
            position: relative; overflow: hidden;
        }
        .banner-cta::before {
            content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%);
            transform: rotate(30deg);
            pointer-events: none;
        }
        .banner-cta .card-body {
            position: relative;
            z-index: 10;
        }
        .pdf-btn {transition: transform 0.2s; }
        .pdf-btn:hover {transform: scale(1.05); }
        .border-start-md {border-left: 1px solid #dee2e6; }
        @media (max-width: 767.98px) { .border-start-md {border-left: none; border-top: 1px solid #dee2e6; margin-top: 1.5rem; padding-top: 1.5rem; } }
    </style>
`;

        // Generación del PDF Delegate
        this.querySelector('#generate-pdf-btn').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generando...';
            btn.disabled = true;

            try {
                // Cargar dinámicamente jspdf si no existe
                if (!window.jspdf) {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }

                // Cargar pdf-generator.js local si no existe
                if (!window.PDFGenerator) {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'utils/pdf-generator.js';
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }

                // Usamos el generador global
                if (window.PDFGenerator && window.PDFGenerator.generateVocationalReport) {
                    await window.PDFGenerator.generateVocationalReport(data);
                } else {
                    throw new Error("Librería PDF no cargada.");
                }
            } catch (error) {
                console.error(error);
                alert("Hubo un error al generar tu PDF. Intenta en un momento.");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });

        const restartBtn = this.querySelector('#restart-test-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                if (confirm('¿Estás seguro de querer repetir el test? Tu resultado actual se ha guardado.')) {
                    localStorage.removeItem('sia_vocacional_id');
                    window.location.hash = '#/test-vocacional';
                    window.location.reload();
                }
            });
        }
    }
}

customElements.define('vocacional-test', VocacionalTest);
