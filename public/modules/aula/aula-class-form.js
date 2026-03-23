(function (global) {
  const AulaClassForm = (function () {
    const DEFAULT_COLOR = "#6366f1";
    const COLOR_OPTIONS = [
      "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#f59e0b",
      "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
      "#0ea5e9", "#3b82f6", "#64748b", "#475569", "#334155", "#1e293b",
    ];
    const SHIFT_OPTIONS = [
      { id: "", label: "Sin turno" },
      { id: "matutino", label: "Matutino" },
      { id: "vespertino", label: "Vespertino" },
      { id: "sabatino", label: "Sabatino" },
      { id: "verano", label: "Verano" },
    ];

    function esc(value) {
      const div = document.createElement("div");
      div.textContent = value || "";
      return div.innerHTML;
    }

    function normalize(value) {
      return global.AulaSubjectCatalog?.normalizeText
        ? global.AulaSubjectCatalog.normalizeText(value)
        : String(value || "").trim().toLowerCase();
    }

    function getCatalog() {
      return global.AulaSubjectCatalog || { careers: [] };
    }

    function getCareer(careerId) {
      return getCatalog().getCareerById?.(careerId) || null;
    }

    function getSemester(careerId, semesterNumber) {
      return getCatalog().getSemesterByNumber?.(careerId, semesterNumber) || null;
    }

    function getShiftOption(turnoIdOrLabel) {
      const normalized = normalize(turnoIdOrLabel);
      if (normalized === "intersemestral") {
        return SHIFT_OPTIONS.find((option) => option.id === "verano") || SHIFT_OPTIONS[0];
      }
      return SHIFT_OPTIONS.find((option) =>
        normalize(option.id) === normalized || normalize(option.label) === normalized
      ) || SHIFT_OPTIONS[0];
    }

    function buildDefaultTitle(materia, turnoLabel) {
      const materiaLabel = String(materia || "").trim();
      const shiftLabel = String(turnoLabel || "").trim();
      if (!materiaLabel) return "Nueva Clase";
      return shiftLabel ? `${materiaLabel} · ${shiftLabel}` : materiaLabel;
    }

    function buildCareerButtons(prefix) {
      return getCatalog().careers.map((career) => `
        <button type="button"
                class="aula-class-option aula-class-option--career"
                data-aula-career-id="${esc(career.id)}"
                data-prefix="${esc(prefix)}">
          <span class="aula-class-option-eyebrow">${esc(career.shortName || "Plan")}</span>
          <span class="aula-class-option-title">${esc(career.name)}</span>
          <span class="aula-class-option-copy">${esc(career.semesters.length)} semestres con materias oficiales</span>
        </button>
      `).join("");
    }

    function buildShiftButtons() {
      return SHIFT_OPTIONS.map((shift) => `
        <button type="button"
                class="aula-class-chip"
                data-aula-shift-id="${esc(shift.id)}">
          ${esc(shift.label)}
        </button>
      `).join("");
    }

    function buildColorButtons() {
      return COLOR_OPTIONS.map((color) => `
        <button type="button"
                class="aula-class-color-btn"
                data-aula-color="${esc(color)}"
                title="${esc(color)}"
                style="background:${color};">
        </button>
      `).join("");
    }

    function buildMarkup(prefix) {
      return `
        <div class="aula-class-form" data-aula-class-form="${esc(prefix)}">
          <section class="aula-class-form-section">
            <div class="aula-class-form-head">
              <div>
                <span class="aula-class-form-step">Paso 1</span>
                <h6 class="fw-bold mb-1">Selecciona la carrera</h6>
                <p class="text-muted small mb-0">No se escribe. Elige el programa y después te mostraremos sus semestres.</p>
              </div>
            </div>
            <div class="aula-class-career-grid" id="aula-${prefix}-career-grid">
              ${buildCareerButtons(prefix)}
            </div>
          </section>

          <section class="aula-class-form-section">
            <div class="aula-class-form-head">
              <div>
                <span class="aula-class-form-step">Paso 2</span>
                <h6 class="fw-bold mb-1">Selecciona el semestre</h6>
                <p class="text-muted small mb-0">Se activa cuando eliges una carrera.</p>
              </div>
            </div>
            <div class="aula-class-chip-grid" id="aula-${prefix}-semester-grid"></div>
          </section>

          <section class="aula-class-form-section">
            <div class="aula-class-form-head aula-class-form-head--split">
              <div>
                <span class="aula-class-form-step">Paso 3</span>
                <h6 class="fw-bold mb-1">Selecciona la materia</h6>
                <p class="text-muted small mb-0">Mostramos solo las materias oficiales de ese semestre.</p>
              </div>
              <button type="button" class="btn btn-outline-secondary rounded-pill btn-sm" id="aula-${prefix}-manual-toggle">
                <i class="bi bi-plus-circle me-1"></i>Agregar clase manual
              </button>
            </div>

            <div class="aula-class-selected-official d-none" id="aula-${prefix}-selected-official"></div>
            <div class="aula-class-subject-grid" id="aula-${prefix}-subject-grid"></div>

            <div class="aula-class-manual-wrap d-none" id="aula-${prefix}-manual-wrap">
              <label class="form-label small fw-semibold">Nombre manual de la materia</label>
              <input type="text" id="aula-${prefix}-manual-subject" class="form-control rounded-4" maxlength="120" placeholder="Ej. Taller Integrador de Redes">
            </div>

            <div class="form-check form-switch mt-3" id="aula-${prefix}-custom-subject-switch-wrap">
              <input class="form-check-input" type="checkbox" role="switch" id="aula-${prefix}-custom-subject-enabled">
              <label class="form-check-label small fw-semibold" for="aula-${prefix}-custom-subject-enabled">Modificar nombre de la materia</label>
            </div>
            <div class="mt-2 d-none" id="aula-${prefix}-custom-subject-wrap">
              <input type="text" id="aula-${prefix}-custom-subject" class="form-control rounded-4" maxlength="120" placeholder="Personaliza el nombre visible de la materia">
            </div>

            <div class="form-check form-switch mt-3">
              <input class="form-check-input" type="checkbox" role="switch" id="aula-${prefix}-custom-title-enabled">
              <label class="form-check-label small fw-semibold" for="aula-${prefix}-custom-title-enabled">Usar un nombre visible diferente para la clase</label>
            </div>
            <div class="mt-2 d-none" id="aula-${prefix}-custom-title-wrap">
              <input type="text" id="aula-${prefix}-custom-title" class="form-control rounded-4" maxlength="120" placeholder="Ej. Cálculo Integral · Grupo A">
            </div>
          </section>

          <section class="aula-class-form-section">
            <div class="aula-class-form-head">
              <div>
                <span class="aula-class-form-step">Paso 4</span>
                <h6 class="fw-bold mb-1">Turno y detalles</h6>
                <p class="text-muted small mb-0">Ayuda a distinguir grupos de la misma materia.</p>
              </div>
            </div>

            <label class="form-label small fw-semibold">Turno</label>
            <div class="aula-class-chip-grid mb-3" id="aula-${prefix}-shift-grid">
              ${buildShiftButtons()}
            </div>

            <label class="form-label small fw-semibold">Descripción</label>
            <textarea id="aula-${prefix}-desc" class="form-control rounded-4" rows="3" maxlength="300" placeholder="Opcional. Agrega contexto, grupo, aula o lo que necesites."></textarea>

            <div class="mt-4">
              <label class="form-label small fw-semibold">Color de la clase</label>
              <div class="aula-class-color-grid" id="aula-${prefix}-color-grid">
                ${buildColorButtons()}
              </div>
            </div>
          </section>

          <section class="aula-class-form-section aula-class-form-section--preview">
            <div class="aula-class-form-head">
              <div>
                <span class="aula-class-form-step">Vista previa</span>
                <h6 class="fw-bold mb-1">Así se verá tu clase</h6>
                <p class="text-muted small mb-0">La tarjeta refleja el nombre final, carrera, semestre y turno.</p>
              </div>
            </div>

            <div class="aula-class-preview-card" id="aula-${prefix}-preview" style="--aula-preview-color:${DEFAULT_COLOR};">
              <div class="aula-class-preview-banner">
                <div class="aula-class-preview-icon">
                  <i class="bi bi-book"></i>
                </div>
                <div class="min-width-0">
                  <div class="aula-class-preview-title" id="aula-${prefix}-preview-title">Nueva Clase</div>
                  <div class="aula-class-preview-materia d-none" id="aula-${prefix}-preview-materia"></div>
                </div>
              </div>
              <div class="aula-class-preview-body">
                <div class="aula-class-preview-badges" id="aula-${prefix}-preview-badges"></div>
                <p class="aula-class-preview-desc mb-0" id="aula-${prefix}-preview-desc">Selecciona una carrera, semestre y materia para construir la clase.</p>
              </div>
            </div>
          </section>
        </div>
      `;
    }

    function createController(prefix) {
      const root = document.querySelector(`[data-aula-class-form="${prefix}"]`);
      if (!root) return null;

      const state = {
        careerId: "",
        semesterNumber: null,
        subjectId: "",
        manualMode: false,
        manualSubject: "",
        customSubjectEnabled: false,
        customSubject: "",
        customTitleEnabled: false,
        customTitle: "",
        turnoId: "",
        descripcion: "",
        color: DEFAULT_COLOR,
      };

      const elements = {
        semesterGrid: root.querySelector(`#aula-${prefix}-semester-grid`),
        subjectGrid: root.querySelector(`#aula-${prefix}-subject-grid`),
        selectedOfficial: root.querySelector(`#aula-${prefix}-selected-official`),
        manualWrap: root.querySelector(`#aula-${prefix}-manual-wrap`),
        manualSubject: root.querySelector(`#aula-${prefix}-manual-subject`),
        customSubjectEnabled: root.querySelector(`#aula-${prefix}-custom-subject-enabled`),
        customSubjectWrap: root.querySelector(`#aula-${prefix}-custom-subject-wrap`),
        customSubject: root.querySelector(`#aula-${prefix}-custom-subject`),
        customTitleEnabled: root.querySelector(`#aula-${prefix}-custom-title-enabled`),
        customTitleWrap: root.querySelector(`#aula-${prefix}-custom-title-wrap`),
        customTitle: root.querySelector(`#aula-${prefix}-custom-title`),
        manualToggle: root.querySelector(`#aula-${prefix}-manual-toggle`),
        desc: root.querySelector(`#aula-${prefix}-desc`),
        preview: root.querySelector(`#aula-${prefix}-preview`),
        previewTitle: root.querySelector(`#aula-${prefix}-preview-title`),
        previewMateria: root.querySelector(`#aula-${prefix}-preview-materia`),
        previewBadges: root.querySelector(`#aula-${prefix}-preview-badges`),
        previewDesc: root.querySelector(`#aula-${prefix}-preview-desc`),
      };

      function getSelectedCareer() {
        return getCareer(state.careerId);
      }

      function getSelectedSemester() {
        return getSemester(state.careerId, state.semesterNumber);
      }

      function getSelectedSubject() {
        const semester = getSelectedSemester();
        if (!semester || !state.subjectId) return null;
        return semester.subjects.find((subject) => subject.id === state.subjectId) || null;
      }

      function getMateriaLabel() {
        const subject = getSelectedSubject();
        if (state.manualMode) return String(state.manualSubject || "").trim();
        if (state.customSubjectEnabled) return String(state.customSubject || "").trim();
        return String(subject?.name || "").trim();
      }

      function getTitleLabel() {
        if (state.customTitleEnabled) {
          const customTitle = String(state.customTitle || "").trim();
          if (customTitle) return customTitle;
        }
        return buildDefaultTitle(getMateriaLabel(), getShiftOption(state.turnoId).label === "Sin turno" ? "" : getShiftOption(state.turnoId).label);
      }

      function updateCareerSelection() {
        root.querySelectorAll("[data-aula-career-id]").forEach((button) => {
          button.classList.toggle("is-active", button.dataset.aulaCareerId === state.careerId);
        });
      }

      function renderSemesters() {
        const career = getSelectedCareer();
        if (!career) {
          elements.semesterGrid.innerHTML = '<div class="aula-class-empty-state">Primero elige una carrera.</div>';
          return;
        }
        elements.semesterGrid.innerHTML = career.semesters.map((semester) => `
          <button type="button"
                  class="aula-class-chip ${Number(state.semesterNumber) === semester.number ? "is-active" : ""}"
                  data-aula-semester-number="${semester.number}">
            ${esc(semester.label)}
          </button>
        `).join("");
      }

      function renderSubjects() {
        const semester = getSelectedSemester();
        const canOverride = !state.manualMode && Boolean(semester && semester.subjects.length);
        elements.customSubjectEnabled.disabled = !canOverride;
        if (!canOverride) {
          elements.customSubjectEnabled.checked = false;
          state.customSubjectEnabled = false;
          state.customSubject = "";
          elements.customSubjectWrap.classList.add("d-none");
          if (elements.customSubject) elements.customSubject.value = "";
        }

        if (state.manualMode) {
          elements.subjectGrid.innerHTML = "";
          elements.manualWrap.classList.remove("d-none");
          elements.selectedOfficial.classList.add("d-none");
          elements.manualToggle.classList.remove("btn-outline-secondary");
          elements.manualToggle.classList.add("btn-dark");
          return;
        }

        elements.manualWrap.classList.add("d-none");
        elements.manualToggle.classList.add("btn-outline-secondary");
        elements.manualToggle.classList.remove("btn-dark");

        if (!semester) {
          elements.subjectGrid.innerHTML = '<div class="aula-class-empty-state">Selecciona un semestre para ver sus materias.</div>';
          elements.selectedOfficial.classList.add("d-none");
          return;
        }

        elements.subjectGrid.innerHTML = semester.subjects.map((subject) => `
          <button type="button"
                  class="aula-class-subject-card ${state.subjectId === subject.id ? "is-active" : ""}"
                  data-aula-subject-id="${esc(subject.id)}">
            <span class="aula-class-subject-index">${esc(semester.label)}</span>
            <span class="aula-class-subject-name">${esc(subject.name)}</span>
          </button>
        `).join("");

        const selectedSubject = getSelectedSubject();
        if (selectedSubject) {
          elements.selectedOfficial.classList.remove("d-none");
          elements.selectedOfficial.innerHTML = `
            <div class="small text-uppercase fw-semibold text-muted mb-1">Materia oficial seleccionada</div>
            <div class="fw-semibold">${esc(selectedSubject.name)}</div>
          `;
        } else {
          elements.selectedOfficial.classList.add("d-none");
        }
      }

      function updateShiftSelection() {
        root.querySelectorAll("[data-aula-shift-id]").forEach((button) => {
          button.classList.toggle("is-active", button.dataset.aulaShiftId === state.turnoId);
        });
      }

      function updateColorSelection() {
        root.querySelectorAll("[data-aula-color]").forEach((button) => {
          button.classList.toggle("is-active", button.dataset.aulaColor === state.color);
        });
        if (elements.preview) elements.preview.style.setProperty("--aula-preview-color", state.color);
      }

      function updatePreview() {
        const career = getSelectedCareer();
        const semester = getSelectedSemester();
        const shift = getShiftOption(state.turnoId);
        const materia = getMateriaLabel();
        const title = getTitleLabel();
        const hasCustomTitle = state.customTitleEnabled && String(state.customTitle || "").trim();
        const description = String(state.descripcion || "").trim();

        elements.previewTitle.textContent = title || "Nueva Clase";

        const shouldShowMateria = Boolean(materia) && normalize(title) !== normalize(materia);
        elements.previewMateria.textContent = materia;
        elements.previewMateria.classList.toggle("d-none", !shouldShowMateria);

        const badgeParts = [];
        if (career) badgeParts.push(`<span class="aula-class-preview-badge">${esc(career.name)}</span>`);
        if (semester) badgeParts.push(`<span class="aula-class-preview-badge">${esc(semester.label)}</span>`);
        if (shift.id) badgeParts.push(`<span class="aula-class-preview-badge aula-class-preview-badge--accent">${esc(shift.label)}</span>`);
        if (state.manualMode) badgeParts.push('<span class="aula-class-preview-badge aula-class-preview-badge--neutral">Manual</span>');
        if (!state.manualMode && state.customSubjectEnabled) badgeParts.push('<span class="aula-class-preview-badge aula-class-preview-badge--neutral">Nombre ajustado</span>');
        if (hasCustomTitle) badgeParts.push('<span class="aula-class-preview-badge aula-class-preview-badge--neutral">Título personalizado</span>');
        elements.previewBadges.innerHTML = badgeParts.join("");

        elements.previewDesc.textContent = description || "Agrega una descripción para que tus estudiantes distingan esta clase más rápido.";
      }

      function syncTextInputs() {
        if (elements.desc) elements.desc.value = state.descripcion;
        if (elements.manualSubject) elements.manualSubject.value = state.manualSubject;
        if (elements.customSubject) elements.customSubject.value = state.customSubject;
        if (elements.customTitle) elements.customTitle.value = state.customTitle;
        if (elements.customSubjectEnabled) elements.customSubjectEnabled.checked = state.customSubjectEnabled;
        if (elements.customTitleEnabled) elements.customTitleEnabled.checked = state.customTitleEnabled;
        elements.customSubjectWrap.classList.toggle("d-none", !state.customSubjectEnabled);
        elements.customTitleWrap.classList.toggle("d-none", !state.customTitleEnabled);
      }

      function renderAll() {
        updateCareerSelection();
        renderSemesters();
        renderSubjects();
        updateShiftSelection();
        updateColorSelection();
        syncTextInputs();
        updatePreview();
      }

      function reset(nextData) {
        state.careerId = "";
        state.semesterNumber = null;
        state.subjectId = "";
        state.manualMode = false;
        state.manualSubject = "";
        state.customSubjectEnabled = false;
        state.customSubject = "";
        state.customTitleEnabled = false;
        state.customTitle = "";
        state.turnoId = "";
        state.descripcion = "";
        state.color = DEFAULT_COLOR;
        renderAll();
        if (nextData) setData(nextData);
      }

      function setData(data) {
        const career = getCatalog().findCareerByValue?.(data?.carreraNombre || data?.carreraId || data?.carrera) || getCareer(data?.carreraId);
        const semester = career
          ? getCatalog().findSemester?.(career, data?.semestreNumero || data?.semestreLabel || data?.semestre)
          : null;
        const subject = semester
          ? getCatalog().findSubject?.(career, semester, data?.materiaOriginal || data?.materia)
          : null;
        const turno = getShiftOption(data?.turnoId || data?.turno);
        const materia = String(data?.materia || "").trim();
        const manualMode = Boolean(data?.materiaManual) || Boolean(materia && !subject);
        const customSubjectEnabled = Boolean(subject && materia && normalize(materia) !== normalize(subject.name));
        const resolvedMateria = manualMode ? materia : (customSubjectEnabled ? materia : subject?.name || "");
        const derivedTitle = buildDefaultTitle(resolvedMateria, turno.label === "Sin turno" ? "" : turno.label);
        const customTitleEnabled = Boolean(data?.titulo && normalize(data.titulo) !== normalize(derivedTitle));

        state.careerId = career?.id || "";
        state.semesterNumber = semester?.number || null;
        state.subjectId = subject?.id || "";
        state.manualMode = manualMode;
        state.manualSubject = manualMode ? materia : "";
        state.customSubjectEnabled = customSubjectEnabled;
        state.customSubject = customSubjectEnabled ? materia : "";
        state.customTitleEnabled = customTitleEnabled;
        state.customTitle = customTitleEnabled ? String(data?.titulo || "").trim() : "";
        state.turnoId = turno.id;
        state.descripcion = String(data?.descripcion || "").trim();
        state.color = data?.color || DEFAULT_COLOR;
        renderAll();
      }

      function getPayload() {
        const career = getSelectedCareer();
        const semester = getSelectedSemester();
        const subject = getSelectedSubject();
        const shift = getShiftOption(state.turnoId);
        const materia = getMateriaLabel();
        const titulo = getTitleLabel();

        if (!career) throw new Error("Selecciona una carrera.");
        if (!semester) throw new Error("Selecciona un semestre.");
        if (!materia) throw new Error(state.manualMode ? "Escribe el nombre de la clase manual." : "Selecciona una materia.");

        return {
          titulo: titulo,
          tituloPersonalizado: Boolean(state.customTitleEnabled && String(state.customTitle || "").trim()),
          descripcion: String(state.descripcion || "").trim(),
          materia: materia,
          materiaId: subject?.id || "",
          materiaOriginal: subject?.name || "",
          materiaManual: Boolean(state.manualMode),
          materiaPersonalizada: Boolean(!state.manualMode && state.customSubjectEnabled && String(state.customSubject || "").trim()),
          carrera: career.storedName || career.name,
          carreraNombre: career.name,
          carreraId: career.id,
          semestre: semester.label,
          semestreLabel: semester.label,
          semestreNumero: semester.number,
          turno: shift.id ? shift.label : "",
          turnoId: shift.id,
          color: state.color || DEFAULT_COLOR,
          catalogVersion: getCatalog().version || "",
        };
      }

      root.addEventListener("click", (event) => {
        const careerButton = event.target.closest("[data-aula-career-id]");
        if (careerButton) {
          const nextCareerId = careerButton.dataset.aulaCareerId || "";
          if (state.careerId !== nextCareerId) {
            state.careerId = nextCareerId;
            state.semesterNumber = null;
            state.subjectId = "";
            state.manualMode = false;
            state.manualSubject = "";
            state.customSubjectEnabled = false;
            state.customSubject = "";
          }
          renderAll();
          return;
        }

        const semesterButton = event.target.closest("[data-aula-semester-number]");
        if (semesterButton) {
          const nextSemesterNumber = Number(semesterButton.dataset.aulaSemesterNumber || 0);
          if (state.semesterNumber !== nextSemesterNumber) {
            state.semesterNumber = nextSemesterNumber;
            state.subjectId = "";
            state.manualMode = false;
            state.manualSubject = "";
            state.customSubjectEnabled = false;
            state.customSubject = "";
          }
          renderAll();
          return;
        }

        const subjectButton = event.target.closest("[data-aula-subject-id]");
        if (subjectButton) {
          state.subjectId = subjectButton.dataset.aulaSubjectId || "";
          state.manualMode = false;
          state.manualSubject = "";
          renderAll();
          return;
        }

        const shiftButton = event.target.closest("[data-aula-shift-id]");
        if (shiftButton) {
          state.turnoId = shiftButton.dataset.aulaShiftId || "";
          renderAll();
          return;
        }

        const colorButton = event.target.closest("[data-aula-color]");
        if (colorButton) {
          state.color = colorButton.dataset.aulaColor || DEFAULT_COLOR;
          renderAll();
          return;
        }

        if (event.target.closest(`#aula-${prefix}-manual-toggle`)) {
          state.manualMode = !state.manualMode;
          state.subjectId = "";
          if (!state.manualMode) state.manualSubject = "";
          renderAll();
        }
      });

      root.addEventListener("input", (event) => {
        if (event.target === elements.manualSubject) state.manualSubject = event.target.value || "";
        if (event.target === elements.customSubject) state.customSubject = event.target.value || "";
        if (event.target === elements.customTitle) state.customTitle = event.target.value || "";
        if (event.target === elements.desc) state.descripcion = event.target.value || "";
        updatePreview();
      });

      root.addEventListener("change", (event) => {
        if (event.target === elements.customSubjectEnabled) {
          state.customSubjectEnabled = Boolean(event.target.checked);
          if (!state.customSubjectEnabled) state.customSubject = "";
          renderAll();
        }
        if (event.target === elements.customTitleEnabled) {
          state.customTitleEnabled = Boolean(event.target.checked);
          if (!state.customTitleEnabled) state.customTitle = "";
          renderAll();
        }
      });

      renderAll();

      return {
        reset: reset,
        setData: setData,
        getPayload: getPayload,
        getState: function () { return { ...state }; },
      };
    }

    return {
      DEFAULT_COLOR: DEFAULT_COLOR,
      COLOR_OPTIONS: COLOR_OPTIONS.slice(),
      SHIFT_OPTIONS: SHIFT_OPTIONS.slice(),
      buildMarkup: buildMarkup,
      createController: createController,
      buildDefaultTitle: buildDefaultTitle,
      getShiftOption: getShiftOption,
    };
  })();

  global.AulaClassForm = AulaClassForm;
})(window);
