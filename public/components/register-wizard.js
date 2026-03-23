
class SiaRegisterWizard extends HTMLElement {
   constructor() {
      super();
   }

   connectedCallback() {
      this.render();
   }

   render() {
      this.className = 'd-none min-vh-100 d-flex align-items-center py-5';
      this.innerHTML = `
    <div class="container animate-fade-in p-2 p-md-3">
      <div class="row justify-content-center">
        <div class="col-lg-9" style="max-width: 900px;">
          <div class="card border-0 shadow-lg rounded-4 overflow-hidden position-relative">
            
            <div class="progress" style="height: 6px;">
              <div id="reg-progress-bar" class="progress-bar bg-primary transition-all" role="progressbar" style="width: 15%"></div>
            </div>

            <button onclick="SIA_Register.logout()" class="btn btn-sm btn-light position-absolute top-0 end-0 m-3 rounded-pill shadow-sm z-3" title="Salir">
              <i class="bi bi-box-arrow-right text-danger"></i>
            </button>

            <div class="card-body p-4 p-md-5">

              <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-4">
                <div>
                  <div class="small text-uppercase fw-bold text-primary mb-1" id="reg-step-caption">Paso 1 de 5 · Bienvenida</div>
                  <h3 class="fw-bold text-dark mb-1">Registro de Expediente</h3>
                  <p class="text-muted small mb-0" id="reg-step-copy">Conoce el proceso y personaliza tu ruta antes de iniciar.</p>
                </div>
                <div class="text-start text-lg-end">
                  <div class="small text-muted">Duración estimada</div>
                  <div class="fw-bold text-dark" id="reg-estimated-time">2 a 5 min</div>
                  <div class="small text-success" id="reg-draft-status">Guardado automático activo</div>
                </div>
              </div>

              <div class="d-flex flex-wrap gap-2 mb-4" id="reg-stepper">
                <span class="badge rounded-pill text-bg-primary" data-reg-step-pill="0">Bienvenida</span>
                <span class="badge rounded-pill text-bg-light border text-dark" data-reg-step-pill="1">Identidad</span>
                <span class="badge rounded-pill text-bg-light border text-dark" data-reg-step-pill="2">Salud</span>
                <span class="badge rounded-pill text-bg-light border text-dark" data-reg-step-pill="3">Apoyos</span>
                <span class="badge rounded-pill text-bg-light border text-dark" data-reg-step-pill="4">Revisión</span>
              </div>

              <!-- PASO 0: BIENVENIDA -->
              <div id="reg-step-0" class="reg-step-container fade-in text-center py-4">
                <div class="mb-4">
                    <div class="d-inline-flex align-items-center justify-content-center bg-primary bg-opacity-10 text-primary rounded-circle mb-3" style="width: 80px; height: 80px;">
                        <i class="bi bi-shield-check display-4"></i>
                    </div>
                </div>
                <h3 class="fw-bold text-dark mb-3">¡Bienvenido(a) a SIA!</h3>
                <p class="text-muted lead mb-4">
                    Para brindarte un mejor servicio y atención personalizada, necesitamos crear tu <strong>Expediente Digital</strong>.
                </p>
                
                <div class="row g-4 text-start mb-5 justify-content-center">
                    <div class="col-md-10">
                        <div class="d-flex align-items-start mb-3">
                            <i class="bi bi-person-vcard text-primary fs-3 me-3 mt-1"></i>
                            <div>
                                <h6 class="fw-bold mb-1">Identidad Institucional</h6>
                                <p class="text-muted small mb-0">Datos básicos para reconocerte y asignarte al departamento o carrera correspondiente.</p>
                            </div>
                        </div>
                        <div class="d-flex align-items-start mb-3">
                            <i class="bi bi-heart-pulse text-success fs-3 me-3 mt-1"></i>
                            <div>
                                <h6 class="fw-bold mb-1">Salud y Bienestar</h6>
                                <p class="text-muted small mb-0">Información médica vital para actuar rápida y correctamente en caso de cualquier emergencia en el campus.</p>
                            </div>
                        </div>
                        <div class="d-flex align-items-start">
                            <i class="bi bi-universal-access text-info fs-3 me-3 mt-1"></i>
                            <div>
                                <h6 class="fw-bold mb-1">Inclusión y Accesibilidad</h6>
                                <p class="text-muted small mb-0">Nos ayuda a garantizar instalaciones y tratos adecuados para todos, sin importar sus condiciones.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="alert alert-light border shadow-sm text-start small mb-4">
                    <i class="bi bi-lock-fill text-secondary me-2"></i>
                    Tus datos están protegidos y solo serán utilizados por personal autorizado (Servicio Médico, Psicología, Escolares) para fines institucionales y de atención.
                </div>

                <div class="text-start mb-4">
                    <div class="small fw-bold text-uppercase text-primary mb-2">Elige tu perfil para personalizar el recorrido</div>
                    <div class="row g-3">
                        <div class="col-md-6 col-xl-3">
                            <button type="button" class="btn btn-outline-secondary w-100 rounded-4 p-3 text-start h-100" data-reg-role-card="estudiante" onclick="SIA_Register.previewRole('estudiante')">
                                <div class="fw-bold mb-1">Alumno</div>
                                <div class="small text-muted">Servicios académicos y del campus.</div>
                            </button>
                        </div>
                        <div class="col-md-6 col-xl-3">
                            <button type="button" class="btn btn-outline-secondary w-100 rounded-4 p-3 text-start h-100" data-reg-role-card="docente" onclick="SIA_Register.previewRole('docente')">
                                <div class="fw-bold mb-1">Docente</div>
                                <div class="small text-muted">Academia, asesorías y contexto de aula.</div>
                            </button>
                        </div>
                        <div class="col-md-6 col-xl-3">
                            <button type="button" class="btn btn-outline-secondary w-100 rounded-4 p-3 text-start h-100" data-reg-role-card="administrativo" onclick="SIA_Register.previewRole('administrativo')">
                                <div class="fw-bold mb-1">Administrativo</div>
                                <div class="small text-muted">Área, puesto y atención interna.</div>
                            </button>
                        </div>
                        <div class="col-md-6 col-xl-3">
                            <button type="button" class="btn btn-outline-secondary w-100 rounded-4 p-3 text-start h-100" data-reg-role-card="operativo" onclick="SIA_Register.previewRole('operativo')">
                                <div class="fw-bold mb-1">Operativo</div>
                                <div class="small text-muted">Turno, zona de trabajo y seguridad.</div>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="rounded-4 bg-light border p-4 text-start mb-4">
                    <div class="small text-uppercase text-muted mb-1">Recorrido sugerido</div>
                    <div class="fw-bold text-dark mb-2" id="reg-selected-role-label">Recorrido adaptable</div>
                    <div class="small text-muted" id="reg-selected-role-copy">Selecciona un perfil y te mostraremos solo la información más útil para tu tipo de usuario.</div>
                    <div class="d-flex flex-wrap gap-2 mt-3" id="reg-welcome-benefits">
                        <span class="badge rounded-pill text-bg-light border">Proceso guiado</span>
                        <span class="badge rounded-pill text-bg-light border">Guardado automático</span>
                        <span class="badge rounded-pill text-bg-light border">Revisión final</span>
                    </div>
                </div>

                <div class="d-flex flex-column flex-sm-row justify-content-center gap-3">
                    <button type="button" onclick="SIA_Register.nextStep()" class="btn btn-primary btn-lg rounded-pill px-5 shadow-sm fw-bold">
                        Comenzar Registro <i class="bi bi-arrow-right ms-2"></i>
                    </button>
                    <button type="button" class="btn btn-outline-secondary btn-lg rounded-pill px-4" onclick="document.getElementById('reg-welcome-details').classList.toggle('d-none')">
                        Ver qué te pediremos
                    </button>
                </div>

                <div id="reg-welcome-details" class="d-none rounded-4 border bg-light p-4 text-start mt-4">
                    <div class="fw-bold text-dark mb-2">Qué te pediremos</div>
                    <div class="small text-muted mb-3">Dividimos el registro en bloques cortos para que sea claro y rápido.</div>
                    <div class="row g-3">
                        <div class="col-md-6"><div class="small text-muted text-uppercase">Identidad</div><div class="fw-semibold">Nombre, teléfono, perfil y contexto institucional.</div></div>
                        <div class="col-md-6"><div class="small text-muted text-uppercase">Salud</div><div class="fw-semibold">Tipo de sangre, antecedentes relevantes y contacto de emergencia.</div></div>
                        <div class="col-md-6"><div class="small text-muted text-uppercase">Apoyos</div><div class="fw-semibold">Accesibilidad, comunicación preferida e intereses institucionales.</div></div>
                        <div class="col-md-6"><div class="small text-muted text-uppercase">Revisión</div><div class="fw-semibold">Confirmas tus respuestas antes de crear tu expediente.</div></div>
                    </div>
                </div>
              </div>

              <div id="reg-step-1" class="reg-step-container d-none fade-in">
                <h5 class="fw-bold text-primary mb-4 border-bottom pb-2"><i class="bi bi-person-vcard me-2"></i>1. Identidad Institucional</h5>
                <form onsubmit="event.preventDefault(); SIA_Register.nextStep();">
                  <div class="row g-3">
                    
                    <div class="col-12">
                      <label class="form-label small fw-bold text-primary">¿Cuál es tu rol en el Instituto?</label>
                      <select id="reg-tipo-usuario" class="form-select form-select-lg border-primary border-opacity-25 shadow-sm py-3" required 
                              onchange="SIA_Register.handleUserTypeChange(this.value)">
                         <option value="" selected disabled>Selecciona tu perfil...</option>
                         <option value="estudiante">🎓 Estudiante (Inscrito en carrera)</option>
                         <option value="docente">👨‍🏫 Personal Docente (Docentes, Extraescolares)</option>
                         <option value="administrativo">💼 Personal Administrativo</option>
                         <option value="operativo">🛠️ Personal Operativo</option>
                      </select>
                    </div>

                    <div class="col-12">
                      <div id="reg-role-guidance" class="rounded-4 border bg-light p-3 p-md-4 d-none">
                        <div class="small text-uppercase text-primary fw-bold mb-1">Ruta personalizada</div>
                        <div class="fw-bold text-dark" id="reg-role-guidance-title"></div>
                        <div class="small text-muted mb-3" id="reg-role-guidance-copy"></div>
                        <div class="d-flex flex-wrap gap-2" id="reg-role-guidance-tags"></div>
                      </div>
                    </div>

                    <div class="col-md-12 mt-3">
                      <label class="form-label small fw-bold text-muted">Nombre Completo</label>
                      <input type="text" id="reg-nombre-completo" class="form-control " readonly disabled>
                    </div>

                    <div class="col-md-6">
                      <label class="form-label small fw-bold text-muted">Número de Control / ID</label>
                      <input type="text" id="reg-matricula-readonly" class="form-control" readonly>
                    </div>

                    <div class="col-md-6 d-none" id="group-reg-carrera">
                      <label class="form-label small fw-bold text-primary">Carrera / Programa</label>
                      <select id="reg-carrera" class="form-select">
                         <option value="">Seleccionar...</option>
                         <option value="Arquitectura">Arquitectura</option>
                         <option value="Ingeniería en Administración">Ingeniería en Administración</option>
                         <option value="Contador Público">Contador Público</option>
                         <option value="Ingeniería Civil">Ingeniería Civil</option>
                         <option value="Ingeniería Electromecánica">Ingeniería Electromecánica</option>
                         <option value="Ingeniería en Sistemas Computacionales">Ingeniería en Sistemas Computacionales</option>
                         <option value="Turismo">Turismo</option>
                         <option value="Gastronomía">Gastronomía</option>
                      </select>
                    </div>

                    <div class="col-md-6 d-none" id="group-reg-area">
                      <label class="form-label small fw-bold text-primary">Área o Departamento</label>
                      <input type="text" id="reg-area-adscripcion" class="form-control" placeholder="Ej. Depto. de Sistemas, Mantenimiento...">
                    </div>

                    <div class="col-md-6 d-none" id="group-reg-turno">
                       <label class="form-label small fw-bold text-primary">Turno</label>
                       <select id="reg-turno" class="form-select">
                         <option value="">Seleccionar...</option>
                         <option value="Matutino">Matutino</option>
                         <option value="Vespertino">Vespertino</option>
                       </select>
                    </div>

                    <div class="col-md-6">
                      <label class="form-label small fw-bold">Fecha de Nacimiento</label>
                      <input type="date" id="reg-fecha-nacimiento" class="form-control" required>
                    </div>

                    <div class="col-md-6">
                      <label class="form-label small fw-bold">Teléfono Celular</label>
                      <input type="tel" id="reg-telefono" class="form-control" placeholder="10 dígitos" maxlength="10" minlength="10" pattern="\\d{10}" inputmode="numeric" required>
                    </div>
                    
                    <div class="col-md-4">
                       <label class="form-label small fw-bold">Género</label>
                       <select id="reg-genero" class="form-select" required onchange="SIA_Register.checkGender(this.value)">
                         <option value="">Seleccionar...</option>
                         <option value="Femenino">Femenino</option>
                         <option value="Masculino">Masculino</option>
                         <option value="Otro">Otro</option>
                       </select>
                    </div>
                    
                    <!-- EXCLUSIVO FEMENINO -->
                    <div class="col-md-12 d-none animate-slide-down bg-warning-subtle p-3 rounded-3 border border-warning-subtle my-3" id="group-maternity">
                        <div class="row g-3">
                             <div class="col-12"><strong class="text-warning-emphasis small"><i class="bi bi-person-hearts me-2"></i>Información Materna (Exclusivo Salud y Lactario)</strong></div>
                             <div class="col-md-4">
                                <label class="form-label small fw-bold">¿Estás embarazada?</label>
                                <select id="reg-embarazo" class="form-select border-warning-subtle">
                                    <option value="No">No</option>
                                    <option value="Sí">Sí</option>
                                </select>
                             </div>
                             <div class="col-md-4">
                                <label class="form-label small fw-bold">¿Estás en periodo de lactancia?</label>
                                <select id="reg-lactancia" class="form-select border-warning-subtle" onchange="SIA_Register.checkLactancy(this.value)">
                                    <option value="No">No</option>
                                    <option value="Sí">Sí</option>
                                </select>
                             </div>
                             <div class="col-md-4 d-none animate-fade-in" id="group-lactancia-tiempo">
                                <label class="form-label small fw-bold">Tiempo lactando (Meses)</label>
                                <select id="reg-lactancia-tiempo" class="form-select border-warning-subtle">
                                    <option value="">Meses...</option>
                                    <option value="1">1 mes</option>
                                    <option value="2">2 meses</option>
                                    <option value="3">3 meses</option>
                                    <option value="4">4 meses</option>
                                    <option value="5">5 meses</option>
                                    <option value="6">6 meses</option>
                                    <option value="7">7 meses</option>
                                </select>
                                <div class="form-text extra-small text-muted">*Máximo 7 meses de antigüedad para registro.</div>
                             </div>
                        </div>
                    </div>

                    <div class="col-md-4">
                       <label class="form-label small fw-bold">Estado Civil</label>
                       <select id="reg-civil" class="form-select" required>
                         <option value="Soltero/a">Soltero/a</option>
                         <option value="Casado/a">Casado/a</option>
                         <option value="Unión Libre">Unión Libre</option>
                       </select>
                    </div>
                    <div class="col-md-4 d-none" id="group-reg-trabaja">
                       <label class="form-label small fw-bold">¿Trabajas?</label>
                       <select id="reg-trabaja" class="form-select" required>
                         <option value="No">No</option>
                         <option value="Sí">Sí</option>
                       </select>
                    </div>

                    <div class="col-12 mt-3">
                       <label class="form-label small fw-bold">Dependientes Económicos (Hijos/Padres)</label>
                       <div class="input-group shadow-sm">
                          <select class="form-select text-center fw-bold" style="max-width: 100px;" id="reg-dependientes-bool" 
                                  onchange="const el=document.getElementById('reg-dependientes-qty'); if(this.value==='Sí'){el.disabled=false;el.focus();el.classList.remove('d-none');}else{el.disabled=true;el.value='';el.classList.add('d-none');}">
                             <option value="No">No</option>
                             <option value="Sí">Sí</option>
                          </select>
                          <input type="number" id="reg-dependientes-qty" class="form-control d-none" placeholder="¿Cuántos?" disabled min="1">
                       </div>
                    </div>

                    <div class="col-12 mt-3">
                       <label class="form-label small fw-bold text-muted"><i class="bi bi-geo-alt me-1"></i>Domicilio (Colonia y Ciudad)</label>
                       <input type="text" id="reg-domicilio" class="form-control" required placeholder="Ej. Col. Centro, San José del Cabo">
                    </div>

                    <div class="col-12 mt-3 d-none" id="group-reg-beca">
                       <label class="form-label small fw-bold">¿Cuentas con beca?</label>
                       <div class="input-group shadow-sm">
                          <select class="form-select text-center fw-bold" style="max-width: 100px;" id="reg-beca-bool" onchange="const el=document.getElementById('reg-beca-desc'); el.disabled=(this.value==='No'); if(!el.disabled)el.focus(); else el.value='';">
                             <option value="No">No</option>
                             <option value="Sí">Sí</option>
                          </select>
                          <input type="text" id="reg-beca-desc" class="form-control" placeholder="Nombre de la beca" disabled>
                        </div>
                     </div>

                    <div class="col-12 mt-2">
                      <div class="rounded-4 border bg-light p-3 p-md-4">
                        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
                          <div>
                            <div class="fw-bold text-dark">Contexto institucional</div>
                            <div class="small text-muted">Mostramos solo las preguntas que aportan valor al instituto para tu tipo de usuario.</div>
                          </div>
                          <span class="badge rounded-pill text-bg-light border text-dark" id="reg-context-badge">Sin perfil</span>
                        </div>

                        <div id="reg-role-context-empty" class="small text-muted">Selecciona tu perfil para ver preguntas específicas.</div>

                        <div id="group-role-student" class="row g-3 d-none">
                          <div class="col-md-4">
                            <label class="form-label small fw-bold">Semestre actual</label>
                            <select id="reg-semestre" class="form-select" data-required-if-visible="true">
                              <option value="">Seleccionar...</option>
                              <option value="1">1°</option><option value="2">2°</option><option value="3">3°</option><option value="4">4°</option>
                              <option value="5">5°</option><option value="6">6°</option><option value="7">7°</option><option value="8">8°</option>
                              <option value="9">9°</option><option value="10">10° o más</option>
                            </select>
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-bold">¿Cómo te trasladas al campus?</label>
                            <select id="reg-traslado" class="form-select">
                              <option value="">Seleccionar...</option>
                              <option value="Camino">Camino</option>
                              <option value="Transporte público">Transporte público</option>
                              <option value="Automóvil">Automóvil</option>
                              <option value="Motocicleta">Motocicleta</option>
                              <option value="Bicicleta">Bicicleta</option>
                              <option value="Otro">Otro</option>
                            </select>
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-bold">Tiempo de traslado</label>
                            <select id="reg-traslado-tiempo" class="form-select">
                              <option value="">Seleccionar...</option>
                              <option value="Menos de 30 min">Menos de 30 min</option>
                              <option value="30 a 60 min">30 a 60 min</option>
                              <option value="1 a 2 horas">1 a 2 horas</option>
                              <option value="Más de 2 horas">Más de 2 horas</option>
                            </select>
                          </div>
                          <div class="col-md-6">
                            <label class="form-label small fw-bold">Acceso a internet en casa</label>
                            <select id="reg-internet-casa" class="form-select">
                              <option value="">Seleccionar...</option>
                              <option value="Estable">Sí, estable</option>
                              <option value="Limitado">Sí, limitado</option>
                              <option value="No">No</option>
                            </select>
                          </div>
                          <div class="col-md-6">
                            <label class="form-label small fw-bold">Apoyo que más te interesa</label>
                            <select id="reg-apoyo-academico" class="form-select">
                              <option value="">Seleccionar...</option>
                              <option value="Tutorías">Tutorías</option>
                              <option value="Becas">Becas</option>
                              <option value="Bolsa de trabajo">Bolsa de trabajo</option>
                              <option value="Salud y bienestar">Salud y bienestar</option>
                              <option value="Actividades deportivas y culturales">Actividades deportivas y culturales</option>
                            </select>
                          </div>
                        </div>

                        <div id="group-role-docente" class="row g-3 d-none">
                          <div class="col-md-6">
                            <label class="form-label small fw-bold">Academia o coordinación</label>
                            <input type="text" id="reg-docente-academia" class="form-control" placeholder="Ej. Academia de Sistemas" data-required-if-visible="true">
                          </div>
                          <div class="col-md-6">
                            <label class="form-label small fw-bold">Materias o enfoque</label>
                            <input type="text" id="reg-docente-enfoque" class="form-control" placeholder="Ej. Programación, tutorías, residencias">
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-bold">Disponibilidad para asesorías</label>
                            <select id="reg-docente-asesoria" class="form-select">
                              <option value="">Seleccionar...</option>
                              <option value="Matutina">Matutina</option>
                              <option value="Vespertina">Vespertina</option>
                              <option value="Flexible">Flexible</option>
                              <option value="Solo por cita">Solo por cita</option>
                            </select>
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-bold">Cubículo</label>
                            <input type="text" id="reg-docente-cubiculo" class="form-control" placeholder="Ej. Edificio B-12">
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-bold">Extensión</label>
                            <input type="text" id="reg-docente-extension" class="form-control" placeholder="Ej. 214">
                          </div>
                        </div>

                        <div id="group-role-admin" class="row g-3 d-none">
                          <div class="col-md-5">
                            <label class="form-label small fw-bold">Puesto</label>
                            <input type="text" id="reg-admin-puesto" class="form-control" placeholder="Ej. Coordinación de servicios" data-required-if-visible="true">
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-bold">Horario de atención</label>
                            <input type="text" id="reg-admin-horario" class="form-control" placeholder="Ej. 8:00 a 15:00">
                          </div>
                          <div class="col-md-3">
                            <label class="form-label small fw-bold">Extensión</label>
                            <input type="text" id="reg-admin-extension" class="form-control" placeholder="Ej. 105">
                          </div>
                          <div class="col-md-6">
                            <label class="form-label small fw-bold">¿Atiendes directamente a estudiantes?</label>
                            <select id="reg-admin-atencion" class="form-select">
                              <option value="">Seleccionar...</option>
                              <option value="Sí">Sí</option>
                              <option value="No">No</option>
                              <option value="A veces">A veces</option>
                            </select>
                          </div>
                        </div>

                        <div id="group-role-operativo" class="row g-3 d-none">
                          <div class="col-md-4">
                            <label class="form-label small fw-bold">Puesto</label>
                            <input type="text" id="reg-operativo-puesto" class="form-control" placeholder="Ej. Mantenimiento" data-required-if-visible="true">
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-bold">Zona principal de trabajo</label>
                            <input type="text" id="reg-operativo-zona" class="form-control" placeholder="Ej. Talleres, exteriores, edificio C">
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-bold">Supervisor inmediato</label>
                            <input type="text" id="reg-operativo-supervisor" class="form-control" placeholder="Nombre o puesto">
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-bold">Turno operativo</label>
                            <select id="reg-operativo-turno" class="form-select">
                              <option value="">Seleccionar...</option>
                              <option value="Matutino">Matutino</option>
                              <option value="Vespertino">Vespertino</option>
                              <option value="Mixto">Mixto</option>
                              <option value="Guardia">Guardia</option>
                            </select>
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-bold">Riesgo laboral principal</label>
                            <select id="reg-operativo-riesgo" class="form-select">
                              <option value="">Seleccionar...</option>
                              <option value="Bajo">Bajo</option>
                              <option value="Moderado">Moderado</option>
                              <option value="Alto">Alto</option>
                            </select>
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-bold">Extensión o contacto interno</label>
                            <input type="text" id="reg-operativo-extension" class="form-control" placeholder="Ej. 322">
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                  <div class="mt-4 pt-3 border-top d-flex justify-content-between">
                    <button type="button" onclick="SIA_Register.prevStep()" class="btn btn-light rounded-pill px-4 text-muted"><i class="bi bi-arrow-left me-2"></i>Atrás</button>
                    <button type="submit" class="btn btn-primary rounded-pill px-5 shadow-sm">Siguiente <i class="bi bi-arrow-right ms-2"></i></button>
                  </div>
                </form>
              </div>

              <div id="reg-step-2" class="reg-step-container d-none fade-in">
                <h5 class="fw-bold text-success mb-4 border-bottom pb-2"><i class="bi bi-heart-pulse me-2"></i>2. Salud y Bienestar</h5>
                <p class="small text-muted mb-4">Estos datos ayudan a una atención más segura dentro del campus y fortalecen tu panel SOS.</p>
                <form onsubmit="event.preventDefault(); SIA_Register.nextStep();">
                  <div class="row g-3">
                    
                    <div class="col-md-6">
                       <label class="form-label small fw-bold">¿Tipo de Sangre?</label>
                       <select id="reg-sangre" class="form-select" required>
                         <option value="">Seleccionar...</option>
                         <option value="O+">O+</option> <option value="O-">O-</option>
                         <option value="A+">A+</option> <option value="A-">A-</option>
                         <option value="B+">B+</option> <option value="B-">B-</option>
                         <option value="AB+">AB+</option> <option value="AB-">AB-</option>
                         <option value="Desconocido">No sé</option>
                       </select>
                    </div>

                    <div class="col-md-6">
                       <label class="form-label small fw-bold">¿Consumes sustancias nocivas?</label>
                       <select id="reg-sustancias" class="form-select">
                         <option value="No">No</option>
                         <option value="Sí">Sí</option>
                       </select>
                    </div>

                    <div class="col-12">
                       <label class="form-label small fw-bold">Condición de salud o enfermedad crónica</label>
                        <div class="input-group">
                          <select class="form-select text-center fw-bold" style="max-width: 80px;" id="reg-condicion-salud-sel" onchange="const i=document.getElementById('reg-condicion-salud'); i.disabled=(this.value==='No'); if(!i.disabled) i.focus(); else i.value='';">
                             <option value="No">No</option>
                             <option value="Sí">Sí</option>
                          </select>
                          <input type="text" id="reg-condicion-salud" class="form-control" placeholder="¿Cuál?" disabled>
                       </div>
                    </div>

                    <div class="col-12">
                       <label class="form-label small fw-bold">Tratamiento médico actual</label>
                        <div class="input-group">
                          <select class="form-select text-center fw-bold" style="max-width: 80px;" onchange="const i=document.getElementById('reg-tratamiento'); i.disabled=(this.value==='No'); if(!i.disabled) i.focus(); else i.value='';">
                             <option value="No">No</option>
                             <option value="Sí">Sí</option>
                          </select>
                          <input type="text" id="reg-tratamiento" class="form-control" placeholder="¿Cuál?" disabled>
                       </div>
                    </div>

                    <div class="col-12">
                       <label class="form-label small fw-bold">Padecimiento Físico</label>
                        <div class="input-group">
                          <select class="form-select text-center fw-bold" style="max-width: 80px;" onchange="const i=document.getElementById('reg-padecimiento-fisico'); i.disabled=(this.value==='No'); if(!i.disabled) i.focus(); else i.value='';">
                             <option value="No">No</option>
                             <option value="Sí">Sí</option>
                          </select>
                          <input type="text" id="reg-padecimiento-fisico" class="form-control" placeholder="¿Cuál?" disabled>
                       </div>
                    </div>

                    <div class="col-12">
                       <label class="form-label small fw-bold">Padecimiento Mental / Diagnóstico</label>
                        <div class="input-group">
                          <select class="form-select text-center fw-bold" style="max-width: 80px;" onchange="const i=document.getElementById('reg-padecimiento-mental'); i.disabled=(this.value==='No'); if(!i.disabled) i.focus(); else i.value='';">
                             <option value="No">No</option>
                             <option value="Sí">Sí</option>
                          </select>
                          <input type="text" id="reg-padecimiento-mental" class="form-control" placeholder="¿Cuál?" disabled>
                       </div>
                    </div>
                     
                     <div class="col-12">
                       <label class="form-label small fw-bold">¿Apoyo psicológico (último año)?</label>
                       <select id="reg-apoyo-psico" class="form-select">
                         <option value="No">No</option>
                         <option value="Sí">Sí</option>
                       </select>
                    </div>

                    <div class="col-12">
                       <label class="form-label small fw-bold">Alergia medicamentosa o alimentaria grave</label>
                        <div class="input-group">
                          <select class="form-select text-center fw-bold" style="max-width: 80px;" onchange="const i=document.getElementById('reg-alergia'); i.disabled=(this.value==='No'); if(!i.disabled) i.focus(); else i.value='';">
                             <option value="No">No</option>
                             <option value="Sí">Sí</option>
                          </select>
                          <input type="text" id="reg-alergia" class="form-control" placeholder="¿A qué?" disabled>
                       </div>
                    </div>

                    <div class="col-12 mt-2">
                      <div class="rounded-4 border border-danger-subtle bg-danger-subtle p-3 p-md-4">
                        <div class="d-flex align-items-start gap-3 mb-3">
                          <i class="bi bi-telephone-forward fs-4 text-danger"></i>
                          <div>
                            <div class="fw-bold text-dark">Contacto de emergencia</div>
                            <div class="small text-muted">Estos datos alimentan el panel SOS del dashboard y la vista de Medi.</div>
                          </div>
                        </div>
                        <div class="row g-3">
                          <div class="col-md-5">
                            <label class="form-label small fw-bold">Nombre del contacto</label>
                            <input type="text" id="reg-contacto-nombre" class="form-control" placeholder="Ej. Maria Perez" required>
                          </div>
                          <div class="col-md-3">
                            <label class="form-label small fw-bold">Parentesco</label>
                            <input type="text" id="reg-contacto-rel" class="form-control" placeholder="Madre, hermano...">
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-bold">Telefono</label>
                            <input type="tel" id="reg-contacto-tel" class="form-control" placeholder="10 digitos" maxlength="10" minlength="10" pattern="\\d{10}" inputmode="numeric" required>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                  <div class="mt-4 pt-3 border-top d-flex justify-content-between">
                    <button type="button" onclick="SIA_Register.prevStep()" class="btn btn-light rounded-pill px-4 text-muted"><i class="bi bi-arrow-left me-2"></i>Atrás</button>
                    <button type="submit" class="btn btn-success rounded-pill px-5 shadow-sm">Siguiente <i class="bi bi-arrow-right ms-2"></i></button>
                  </div>
                </form>
              </div>

              <div id="reg-step-3" class="reg-step-container d-none fade-in">
                <h5 class="fw-bold text-info mb-4 border-bottom pb-2"><i class="bi bi-universal-access me-2"></i>3. Inclusión y Accesibilidad</h5>
                <p class="small text-muted mb-4">Estas respuestas nos permiten mejorar accesibilidad, comunicación e identificar servicios que pueden ayudarte.</p>
                <form onsubmit="event.preventDefault(); SIA_Register.nextStep();">
                  
                  <div class="mb-3">
                    <label class="form-label small fw-bold">¿Vives con alguna discapacidad?</label>
                    <div class="d-flex flex-wrap gap-2">
                       <div class="form-check form-check-inline">
                          <input class="form-check-input" type="checkbox" name="reg-discapacidad" value="Motriz" id="chk-motriz">
                          <label class="form-check-label" for="chk-motriz">Motriz</label>
                       </div>
                       <div class="form-check form-check-inline">
                          <input class="form-check-input" type="checkbox" name="reg-discapacidad" value="Visual" id="chk-visual">
                          <label class="form-check-label" for="chk-visual">Visual</label>
                       </div>
                       <div class="form-check form-check-inline">
                          <input class="form-check-input" type="checkbox" name="reg-discapacidad" value="Auditiva" id="chk-auditiva">
                          <label class="form-check-label" for="chk-auditiva">Auditiva</label>
                       </div>
                       <div class="form-check form-check-inline">
                          <input class="form-check-input" type="checkbox" name="reg-discapacidad" value="Intelectual" id="chk-intelectual">
                          <label class="form-check-label" for="chk-intelectual">Intelectual</label>
                       </div>
                        <div class="form-check form-check-inline">
                          <input class="form-check-input" type="checkbox" name="reg-discapacidad" value="Psicosocial" id="chk-psicosocial">
                          <label class="form-check-label" for="chk-psicosocial">Psicosocial</label>
                       </div>
                    </div>
                  </div>

                  <div class="mb-3">
                     <label class="form-label small fw-bold">¿Utilizas algún apoyo técnico?</label>
                     <input type="text" id="reg-apoyo-tecnico" class="form-control" placeholder="Ej. Anteojos, Aparato auditivo, Prótesis, Silla de ruedas">
                  </div>

                  <div class="mb-3">
                     <label class="form-label small fw-bold">¿Requieres ajustes razonables?</label>
                     <input type="text" id="reg-ajustes" class="form-control" placeholder="Ej. Rampas, Software especializado, Materiales en Braille">
                  </div>

                  <hr>

                  <div class="row g-3">
                     <div class="col-12">
                        <label class="form-label small fw-bold">¿Perteneces a algún pueblo originario?</label>
                         <div class="input-group">
                           <select class="form-select text-center fw-bold" style="max-width: 80px;" onchange="const i=document.getElementById('reg-etnia'); i.disabled=(this.value==='No'); if(!i.disabled) i.focus(); else i.value='';">
                              <option value="No">No</option>
                              <option value="Sí">Sí</option>
                           </select>
                           <input type="text" id="reg-etnia" class="form-control" placeholder="¿Cuál?" disabled>
                        </div>
                     </div>
                     <div class="col-md-6">
                        <label class="form-label small fw-bold">¿Hablas lengua indígena?</label>
                        <select id="reg-lengua" class="form-select"> <option value="No">No</option> <option value="Sí">Sí</option> </select>
                     </div>
                     <div class="col-md-6">
                        <label class="form-label small fw-bold">¿Sabes Lengua de Señas?</label>
                        <select id="reg-senas" class="form-select"> <option value="No">No</option> <option value="Sí">Sí</option> </select>
                     </div>
                     <div class="col-12">
                        <label class="form-label small fw-bold">¿Hablas otro idioma (además de español)?</label>
                         <div class="input-group">
                           <select class="form-select text-center fw-bold" style="max-width: 80px;" onchange="const i=document.getElementById('reg-idioma-extra'); i.disabled=(this.value==='No'); if(!i.disabled) i.focus(); else i.value='';">
                              <option value="No">No</option>
                              <option value="Sí">Sí</option>
                           </select>
                           <input type="text" id="reg-idioma-extra" class="form-control" placeholder="Ej. Inglés, Francés, Náhuatl..." disabled>
                        </div>
                     </div>

                     <div class="col-12"><hr class="my-2"></div>

                     <div class="col-md-6">
                        <label class="form-label small fw-bold">Canal preferido para avisos institucionales</label>
                        <select id="reg-canal-preferido" class="form-select">
                          <option value="">Seleccionar...</option>
                          <option value="Notificaciones en app">Notificaciones en app</option>
                          <option value="Correo institucional">Correo institucional</option>
                          <option value="WhatsApp institucional">WhatsApp institucional</option>
                          <option value="Llamada">Llamada</option>
                        </select>
                     </div>
                     <div class="col-md-6">
                        <label class="form-label small fw-bold">¿Deseas recibir avisos segmentados?</label>
                        <select id="reg-avisos-segmentados" class="form-select">
                          <option value="Sí">Sí</option>
                          <option value="No">No</option>
                        </select>
                     </div>
                     <div class="col-12">
                        <label class="form-label small fw-bold">Intereses institucionales</label>
                        <div class="d-flex flex-wrap gap-2">
                          <div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" name="reg-intereses" value="Tutorías" id="int-tutorias"><label class="form-check-label" for="int-tutorias">Tutorías</label></div>
                          <div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" name="reg-intereses" value="Salud y bienestar" id="int-salud"><label class="form-check-label" for="int-salud">Salud y bienestar</label></div>
                          <div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" name="reg-intereses" value="Becas" id="int-becas"><label class="form-check-label" for="int-becas">Becas</label></div>
                          <div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" name="reg-intereses" value="Deporte y cultura" id="int-cultura"><label class="form-check-label" for="int-cultura">Deporte y cultura</label></div>
                          <div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" name="reg-intereses" value="Bolsa de trabajo" id="int-bolsa"><label class="form-check-label" for="int-bolsa">Bolsa de trabajo</label></div>
                          <div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" name="reg-intereses" value="Capacitación" id="int-capacitacion"><label class="form-check-label" for="int-capacitacion">Capacitación</label></div>
                        </div>
                     </div>
                  </div>

                  <div class="mt-4 pt-3 border-top d-flex justify-content-between">
                    <button type="button" onclick="SIA_Register.prevStep()" class="btn btn-light rounded-pill px-4 text-muted"><i class="bi bi-arrow-left me-2"></i>Atrás</button>
                    <button type="submit" class="btn btn-dark rounded-pill px-5 fw-bold shadow-lg">Continuar a revisión <i class="bi bi-arrow-right ms-2"></i></button>
                  </div>
                </form>
              </div>

              <div id="reg-step-4" class="reg-step-container d-none fade-in">
                <h5 class="fw-bold text-dark mb-4 border-bottom pb-2"><i class="bi bi-clipboard2-check me-2"></i>4. Revisión Final</h5>
                <p class="small text-muted mb-4">Confirma tu información antes de crear tu expediente. Podrás editarla después desde tu perfil.</p>
                <form onsubmit="event.preventDefault(); SIA_Register.nextStep();">
                  <div id="reg-review-summary"></div>
                  <div class="mt-4 pt-3 border-top d-flex justify-content-between">
                    <button type="button" onclick="SIA_Register.prevStep()" class="btn btn-light rounded-pill px-4 text-muted"><i class="bi bi-arrow-left me-2"></i>Atrás</button>
                    <button type="submit" class="btn btn-primary rounded-pill px-5 fw-bold shadow">Crear expediente y entrar <i class="bi bi-check2-circle ms-2"></i></button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>`;
   }
}

if (!customElements.get('sia-register-wizard')) {
   customElements.define('sia-register-wizard', SiaRegisterWizard);
}
