
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
              <div id="reg-progress-bar" class="progress-bar bg-primary transition-all" role="progressbar" style="width: 33%"></div>
            </div>

            <button onclick="SIA_Register.logout()" class="btn btn-sm btn-light position-absolute top-0 end-0 m-3 rounded-pill shadow-sm z-3" title="Salir">
              <i class="bi bi-box-arrow-right text-danger"></i>
            </button>

            <div class="card-body p-4 p-md-5">

              <div class="text-center mb-4">
                <h3 class="fw-bold text-dark">Registro de Expediente</h3>
                <p class="text-muted small">Por favor completa la siguiente información para crear tu identidad digital en SIA.</p>
              </div>

              <div id="reg-step-1" class="reg-step-container fade-in">
                <h5 class="fw-bold text-primary mb-4 border-bottom pb-2">1. Identidad Institucional</h5>
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

                    <div class="col-md-12 mt-3">
                      <label class="form-label small fw-bold text-muted">Nombre Completo</label>
                      <input type="text" id="reg-nombre-completo" class="form-control bg-light" readonly disabled>
                    </div>

                    <div class="col-md-6">
                      <label class="form-label small fw-bold text-muted">Número de Control / ID</label>
                      <input type="text" id="reg-matricula-readonly" class="form-control bg-light" readonly>
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

                    <div class="col-md-6" id="group-reg-turno">
                       <label class="form-label small fw-bold text-primary">Turno</label>
                       <select id="reg-turno" class="form-select">
                         <option value="">Seleccionar...</option>
                         <option value="Matutino">Matutino</option>
                         <option value="Vespertino">Vespertino</option>
                       </select>
                    </div>

                    <div class="col-md-6">
                      <label class="form-label small fw-bold">Fecha de Nacimiento</label>
                      <!-- Visual Date Picker -->
                      <input type="date" id="reg-fecha-nacimiento" class="form-control" required>
                    </div>

                    <div class="col-md-6">
                      <label class="form-label small fw-bold">Teléfono Celular</label>
                      <input type="tel" id="reg-telefono" class="form-control" placeholder="10 dígitos" maxlength="10" required>
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
                    <div class="col-md-12 d-none animate-slide-down bg-warning-subtle p-3 rounded-3 border border-warning-subtle" id="group-maternity">
                        <div class="row">
                             <div class="col-12 mb-2"><strong class="text-warning-emphasis small"><i class="bi bi-person-hearts me-1"></i>Información Materna (Exclusivo Salud y Lactario)</strong></div>
                             <div class="col-md-4">
                                <label class="form-label small fw-bold">¿Estás embarazada?</label>
                                <select id="reg-embarazo" class="form-select">
                                    <option value="No">No</option>
                                    <option value="Sí">Sí</option>
                                </select>
                             </div>
                             <div class="col-md-4">
                                <label class="form-label small fw-bold">¿Estás en periodo de lactancia?</label>
                                <select id="reg-lactancia" class="form-select" onchange="SIA_Register.checkLactancy(this.value)">
                                    <option value="No">No</option>
                                    <option value="Sí">Sí</option>
                                </select>
                             </div>
                             <div class="col-md-4 d-none animate-fade-in" id="group-lactancia-tiempo">
                                <label class="form-label small fw-bold">Tiempo lactando (Meses)</label>
                                <select id="reg-lactancia-tiempo" class="form-select">
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
                    <div class="col-md-4" id="group-reg-trabaja">
                       <label class="form-label small fw-bold">¿Trabajas?</label>
                       <select id="reg-trabaja" class="form-select" required>
                         <option value="No">No</option>
                         <option value="Sí">Sí</option>
                       </select>
                    </div>

                    <div class="col-12">
                       <label class="form-label small fw-bold">Dependientes Económicos (Hijos/Padres)</label>
                       <div class="input-group">
                          <select class="form-select text-center fw-bold" style="max-width: 100px;" id="reg-dependientes-bool" 
                                  onchange="const el=document.getElementById('reg-dependientes-qty'); if(this.value==='Sí'){el.disabled=false;el.focus();el.classList.remove('d-none');}else{el.disabled=true;el.value='';el.classList.add('d-none');}">
                             <option value="No">No</option>
                             <option value="Sí">Sí</option>
                          </select>
                          <input type="number" id="reg-dependientes-qty" class="form-control d-none" placeholder="¿Cuántos?" disabled min="1">
                       </div>
                    </div>

                    <div class="col-12">
                       <label class="form-label small fw-bold text-muted">Domicilio (Colonia y Ciudad)</label>
                       <input type="text" id="reg-domicilio" class="form-control" required placeholder="Ej. Col. Centro, San José del Cabo">
                    </div>

                    <div class="col-12" id="group-reg-beca">
                       <label class="form-label small fw-bold">¿Cuentas con beca?</label>
                       <div class="input-group">
                          <select class="form-select text-center fw-bold" style="max-width: 100px;" id="reg-beca-bool" onchange="const el=document.getElementById('reg-beca-desc'); el.disabled=(this.value==='No'); if(!el.disabled)el.focus(); else el.value='';">
                             <option value="No">No</option>
                             <option value="Sí">Sí</option>
                          </select>
                          <input type="text" id="reg-beca-desc" class="form-control" placeholder="Nombre de la beca" disabled>
                       </div>
                    </div>

                  </div>
                  <div class="mt-4 d-flex justify-content-end">
                    <button type="submit" class="btn btn-primary rounded-pill px-5 shadow-sm">Siguiente <i class="bi bi-arrow-right ms-2"></i></button>
                  </div>
                </form>
              </div>

              <div id="reg-step-2" class="reg-step-container d-none fade-in">
                <h5 class="fw-bold text-success mb-4 border-bottom pb-2">2. Salud y Bienestar</h5>
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

                  </div>
                  <div class="mt-4 d-flex justify-content-between">
                    <button type="button" onclick="SIA_Register.prevStep()" class="btn btn-light rounded-pill px-4">Atrás</button>
                    <button type="submit" class="btn btn-success rounded-pill px-4 shadow-sm">Siguiente <i class="bi bi-arrow-right ms-2"></i></button>
                  </div>
                </form>
              </div>

              <div id="reg-step-3" class="reg-step-container d-none fade-in">
                <h5 class="fw-bold text-info mb-4 border-bottom pb-2">3. Inclusión y Accesibilidad</h5>
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
                  </div>

                  <div class="mt-4 pt-3 border-top d-flex justify-content-between">
                    <button type="button" onclick="SIA_Register.prevStep()" class="btn btn-light rounded-pill px-4">Atrás</button>
                    <button type="submit" class="btn btn-dark rounded-pill px-5 fw-bold shadow-lg">Registrar y Entrar</button>
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
