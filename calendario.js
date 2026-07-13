/**
 * Calendário de funcionamento: horários padrão + feriados/fechamentos.
 */

const DIAS_SEMANA = [
  { id: 0, nome: "Domingo", curto: "Dom" },
  { id: 1, nome: "Segunda-feira", curto: "Seg" },
  { id: 2, nome: "Terça-feira", curto: "Ter" },
  { id: 3, nome: "Quarta-feira", curto: "Qua" },
  { id: 4, nome: "Quinta-feira", curto: "Qui" },
  { id: 5, nome: "Sexta-feira", curto: "Sex" },
  { id: 6, nome: "Sábado", curto: "Sáb" }
];

function defaultHorario(diaSemana) {
  const util = diaSemana >= 1 && diaSemana <= 5;
  return {
    dia_semana: diaSemana,
    aberto: util,
    hora_inicio: util ? "08:00" : "",
    hora_fim: util ? "18:00" : "",
    hora_inicio_tarde: "",
    hora_fim_tarde: "",
    observacoes: ""
  };
}

function timeToInput(value) {
  if (!value) return "";
  const s = String(value);
  // "08:00:00" ou "08:00"
  return s.slice(0, 5);
}

function inputToTime(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  return s.length === 5 ? `${s}:00` : s;
}

export function installCalendarioModule(ctx) {
  const { getState, getEls, getSupabase, helpers } = ctx;
  const { escapeHtml, showToast, formatDateInput } = helpers;

  function state() {
    return getState();
  }
  function els() {
    return getEls();
  }
  function sb() {
    return getSupabase();
  }

  function ensureStateDefaults() {
    const s = state();
    if (!s.calendario) {
      s.calendario = {
        loaded: false,
        view: "horarios",
        horarios: DIAS_SEMANA.map((d) => defaultHorario(d.id)),
        feriados: [],
        previewMonth: new Date().getMonth(),
        previewYear: new Date().getFullYear(),
        feriadoEditId: null
      };
    }
  }

  async function loadHorarios() {
    const { data, error } = await sb()
      .from("calendario_horarios")
      .select("*")
      .eq("empresa_id", state().empresaId)
      .order("dia_semana");
    if (error) throw error;

    const map = Object.fromEntries((data || []).map((r) => [Number(r.dia_semana), r]));
    state().calendario.horarios = DIAS_SEMANA.map((d) => {
      const row = map[d.id];
      if (!row) return defaultHorario(d.id);
      return {
        id: row.id,
        dia_semana: d.id,
        aberto: row.aberto !== false,
        hora_inicio: timeToInput(row.hora_inicio),
        hora_fim: timeToInput(row.hora_fim),
        hora_inicio_tarde: timeToInput(row.hora_inicio_tarde),
        hora_fim_tarde: timeToInput(row.hora_fim_tarde),
        observacoes: row.observacoes || ""
      };
    });
  }

  async function loadFeriados() {
    const { data, error } = await sb()
      .from("calendario_feriados")
      .select("*")
      .eq("empresa_id", state().empresaId)
      .order("data", { ascending: true });
    if (error) throw error;
    state().calendario.feriados = data || [];
  }

  async function ensureCalendarioLoaded(options = {}) {
    ensureStateDefaults();
    if (state().calendario.loaded && !options.force) {
      renderCalendarioSection();
      return;
    }
    await Promise.all([loadHorarios(), loadFeriados()]);
    state().calendario.loaded = true;
    renderCalendarioSection();
  }

  function setCalendarioView(view) {
    ensureStateDefaults();
    state().calendario.view = view === "feriados" ? "feriados" : view === "agenda" ? "agenda" : "horarios";
    const e = els();
    for (const btn of e.calendarioViewButtons || []) {
      btn.classList.toggle("active", btn.getAttribute("data-calendario-view") === state().calendario.view);
    }
    if (e.calendarioHorariosView) e.calendarioHorariosView.classList.toggle("hidden", state().calendario.view !== "horarios");
    if (e.calendarioFeriadosView) e.calendarioFeriadosView.classList.toggle("hidden", state().calendario.view !== "feriados");
    if (e.calendarioAgendaView) e.calendarioAgendaView.classList.toggle("hidden", state().calendario.view !== "agenda");
    if (e.calendarioSectionSubtitle) {
      const labels = {
        horarios: "Defina os dias e horários padrão de funcionamento da empresa.",
        feriados: "Cadastre feriados e dias de fechamento (com opção de recorrência anual).",
        agenda: "Visão mensal: abertos, fechados e feriados."
      };
      e.calendarioSectionSubtitle.textContent = labels[state().calendario.view] || labels.horarios;
    }
  }

  function renderHorariosTable() {
    const e = els();
    if (!e.calendarioHorariosTable) return;
    const rows = state().calendario.horarios || [];
    e.calendarioHorariosTable.innerHTML = rows
      .map((h) => {
        const dia = DIAS_SEMANA.find((d) => d.id === h.dia_semana);
        return `
        <tr data-dia-semana="${h.dia_semana}">
          <td><strong>${escapeHtml(dia?.nome || h.dia_semana)}</strong></td>
          <td>
            <label class="checkbox-inline calendario-check">
              <input type="checkbox" data-cal-h-field="aberto" data-dia="${h.dia_semana}" ${h.aberto ? "checked" : ""} />
              Aberto
            </label>
          </td>
          <td>
            <input type="time" data-cal-h-field="hora_inicio" data-dia="${h.dia_semana}" value="${escapeHtml(h.hora_inicio || "")}" ${h.aberto ? "" : "disabled"} />
          </td>
          <td>
            <input type="time" data-cal-h-field="hora_fim" data-dia="${h.dia_semana}" value="${escapeHtml(h.hora_fim || "")}" ${h.aberto ? "" : "disabled"} />
          </td>
          <td>
            <input type="time" data-cal-h-field="hora_inicio_tarde" data-dia="${h.dia_semana}" value="${escapeHtml(h.hora_inicio_tarde || "")}" ${h.aberto ? "" : "disabled"} placeholder="opcional" />
          </td>
          <td>
            <input type="time" data-cal-h-field="hora_fim_tarde" data-dia="${h.dia_semana}" value="${escapeHtml(h.hora_fim_tarde || "")}" ${h.aberto ? "" : "disabled"} />
          </td>
          <td>
            <input type="text" data-cal-h-field="observacoes" data-dia="${h.dia_semana}" value="${escapeHtml(h.observacoes || "")}" placeholder="Ex.: só plantão" ${h.aberto ? "" : "disabled"} />
          </td>
        </tr>`;
      })
      .join("");
  }

  function readHorariosFromTable() {
    const rows = state().calendario.horarios || [];
    for (const h of rows) {
      const tr = document.querySelector(`tr[data-dia-semana="${h.dia_semana}"]`);
      if (!tr) continue;
      const aberto = tr.querySelector('[data-cal-h-field="aberto"]');
      h.aberto = Boolean(aberto?.checked);
      for (const field of ["hora_inicio", "hora_fim", "hora_inicio_tarde", "hora_fim_tarde", "observacoes"]) {
        const el = tr.querySelector(`[data-cal-h-field="${field}"]`);
        if (el) h[field] = el.value || "";
      }
    }
    return rows;
  }

  async function saveHorarios() {
    const rows = readHorariosFromTable();
    for (const h of rows) {
      if (h.aberto) {
        if (!h.hora_inicio || !h.hora_fim) {
          throw new Error(`${DIAS_SEMANA[h.dia_semana].nome}: informe início e fim do expediente.`);
        }
        if (h.hora_inicio_tarde && !h.hora_fim_tarde) {
          throw new Error(`${DIAS_SEMANA[h.dia_semana].nome}: informe o fim do 2º turno.`);
        }
      }
      const payload = {
        empresa_id: state().empresaId,
        dia_semana: h.dia_semana,
        aberto: Boolean(h.aberto),
        hora_inicio: h.aberto ? inputToTime(h.hora_inicio) : null,
        hora_fim: h.aberto ? inputToTime(h.hora_fim) : null,
        hora_inicio_tarde: h.aberto && h.hora_inicio_tarde ? inputToTime(h.hora_inicio_tarde) : null,
        hora_fim_tarde: h.aberto && h.hora_fim_tarde ? inputToTime(h.hora_fim_tarde) : null,
        observacoes: String(h.observacoes || "").trim() || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await sb()
        .from("calendario_horarios")
        .upsert(payload, { onConflict: "empresa_id,dia_semana" });
      if (error) throw error;
    }
    await loadHorarios();
    renderCalendarioSection();
    showToast("Horários de funcionamento salvos");
  }

  function tipoFeriadoLabel(tipo) {
    const map = { feriado: "Feriado", recesso: "Recesso", folga: "Folga", outro: "Outro" };
    return map[tipo] || tipo || "–";
  }

  function renderFeriadosTable() {
    const e = els();
    if (!e.calendarioFeriadosTable) return;
    const busca = String(e.calendarioFeriadoBusca?.value || "").trim().toLowerCase();
    let rows = state().calendario.feriados || [];
    if (busca) {
      rows = rows.filter((f) => `${f.nome} ${f.tipo} ${f.data} ${f.observacoes || ""}`.toLowerCase().includes(busca));
    }
    // próximos primeiro, depois passados
    const today = formatDateInput(new Date());
    rows = [...rows].sort((a, b) => {
      const aFuture = a.data >= today ? 0 : 1;
      const bFuture = b.data >= today ? 0 : 1;
      if (aFuture !== bFuture) return aFuture - bFuture;
      return String(a.data).localeCompare(String(b.data));
    });

    if (!rows.length) {
      e.calendarioFeriadosTable.innerHTML = `<tr><td colspan="7">Nenhum feriado ou fechamento cadastrado.</td></tr>`;
      return;
    }

    e.calendarioFeriadosTable.innerHTML = rows
      .map((f) => {
        const past = f.data < today;
        const horario = f.fecha_dia_todo
          ? "Dia todo"
          : `${timeToInput(f.hora_inicio) || "?"} – ${timeToInput(f.hora_fim) || "?"}`;
        return `
        <tr class="${past ? "calendario-row-past" : ""}">
          <td>${escapeHtml(f.data)}</td>
          <td>${escapeHtml(f.nome)}</td>
          <td><span class="estoque-status estoque-status--reposicao">${escapeHtml(tipoFeriadoLabel(f.tipo))}</span></td>
          <td>${escapeHtml(horario)}</td>
          <td>${f.recorrente ? "Sim" : "Não"}</td>
          <td>${escapeHtml(f.observacoes || "–")}</td>
          <td class="estoque-actions">
            <button type="button" class="btn btn-ghost" data-edit-feriado="${f.id}">Editar</button>
            <button type="button" class="action-delete" data-del-feriado="${f.id}">Excluir</button>
          </td>
        </tr>`;
      })
      .join("");
  }

  function openFeriadoModal(editId = null) {
    ensureStateDefaults();
    const e = els();
    if (!e.feriadoModal || !e.feriadoForm) return;
    state().calendario.feriadoEditId = editId;
    e.feriadoForm.reset();
    if (e.feriadoModalTitle) {
      e.feriadoModalTitle.textContent = editId ? "Editar fechamento" : "Novo feriado / fechamento";
    }

    const setPartialVisibility = (fechaDiaTodo) => {
      if (e.feriadoHorarioWrap) e.feriadoHorarioWrap.classList.toggle("hidden", fechaDiaTodo);
    };

    if (editId) {
      const f = state().calendario.feriados.find((x) => Number(x.id) === Number(editId));
      if (f) {
        const set = (name, val) => {
          const field = e.feriadoForm.elements.namedItem(name);
          if (field && "value" in field) field.value = val == null ? "" : String(val);
          if (field && field.type === "checkbox") field.checked = Boolean(val);
        };
        set("data", f.data);
        set("nome", f.nome);
        set("tipo", f.tipo || "feriado");
        const fecha = e.feriadoForm.elements.namedItem("fecha_dia_todo");
        if (fecha) fecha.checked = f.fecha_dia_todo !== false;
        set("hora_inicio", timeToInput(f.hora_inicio));
        set("hora_fim", timeToInput(f.hora_fim));
        const rec = e.feriadoForm.elements.namedItem("recorrente");
        if (rec) rec.checked = Boolean(f.recorrente);
        set("observacoes", f.observacoes || "");
        setPartialVisibility(f.fecha_dia_todo !== false);
      }
    } else {
      const dataField = e.feriadoForm.elements.namedItem("data");
      if (dataField) dataField.value = formatDateInput(new Date());
      const fecha = e.feriadoForm.elements.namedItem("fecha_dia_todo");
      if (fecha) fecha.checked = true;
      setPartialVisibility(true);
    }

    e.feriadoModal.classList.remove("hidden");
  }

  function closeFeriadoModal() {
    const e = els();
    if (e.feriadoModal) e.feriadoModal.classList.add("hidden");
    state().calendario.feriadoEditId = null;
  }

  async function saveFeriado(event) {
    event.preventDefault();
    const e = els();
    const formData = new FormData(e.feriadoForm);
    const data = String(formData.get("data") || "").trim();
    const nome = String(formData.get("nome") || "").trim();
    const tipo = String(formData.get("tipo") || "feriado");
    const fechaDiaTodo = Boolean(formData.get("fecha_dia_todo"));
    const horaInicio = String(formData.get("hora_inicio") || "").trim();
    const horaFim = String(formData.get("hora_fim") || "").trim();
    const recorrente = Boolean(formData.get("recorrente"));
    const observacoes = String(formData.get("observacoes") || "").trim();

    if (!data) throw new Error("Informe a data.");
    if (!nome) throw new Error("Informe o nome do feriado/fechamento.");
    if (!fechaDiaTodo && (!horaInicio || !horaFim)) {
      throw new Error("Para fechamento parcial, informe o horário de funcionamento.");
    }

    const payload = {
      empresa_id: state().empresaId,
      data,
      nome,
      tipo,
      fecha_dia_todo: fechaDiaTodo,
      hora_inicio: fechaDiaTodo ? null : inputToTime(horaInicio),
      hora_fim: fechaDiaTodo ? null : inputToTime(horaFim),
      recorrente,
      observacoes: observacoes || null,
      updated_at: new Date().toISOString()
    };

    const editId = state().calendario.feriadoEditId;
    if (editId) {
      const { error } = await sb()
        .from("calendario_feriados")
        .update(payload)
        .eq("id", editId)
        .eq("empresa_id", state().empresaId);
      if (error) throw error;
    } else {
      const { error } = await sb().from("calendario_feriados").insert(payload);
      if (error) throw error;
    }

    closeFeriadoModal();
    await loadFeriados();
    renderCalendarioSection();
    showToast(editId ? "Fechamento atualizado" : "Fechamento cadastrado");
  }

  async function deleteFeriado(id) {
    if (!window.confirm("Excluir este feriado/fechamento?")) return;
    const { error } = await sb()
      .from("calendario_feriados")
      .delete()
      .eq("id", id)
      .eq("empresa_id", state().empresaId);
    if (error) throw error;
    await loadFeriados();
    renderCalendarioSection();
    showToast("Fechamento excluído");
  }

  function isFeriadoOnDate(dateYmd) {
    const d = new Date(`${dateYmd}T12:00:00`);
    const mmdd = dateYmd.slice(5); // MM-DD
    return (state().calendario.feriados || []).find((f) => {
      if (f.data === dateYmd) return true;
      if (f.recorrente && String(f.data).slice(5) === mmdd) return true;
      return false;
    });
  }

  function getHorarioForWeekday(weekday) {
    return (state().calendario.horarios || []).find((h) => Number(h.dia_semana) === Number(weekday));
  }

  function renderAgendaMonth() {
    const e = els();
    if (!e.calendarioAgendaGrid) return;
    const year = state().calendario.previewYear;
    const month = state().calendario.previewMonth;
    const first = new Date(year, month, 1);
    const startPad = first.getDay(); // 0=dom
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    if (e.calendarioAgendaTitulo) {
      e.calendarioAgendaTitulo.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    }

    const cells = [];
    for (let i = 0; i < startPad; i += 1) {
      cells.push(`<div class="calendario-day calendario-day--empty"></div>`);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const ymd = formatDateInput(date);
      const weekday = date.getDay();
      const feriado = isFeriadoOnDate(ymd);
      const horario = getHorarioForWeekday(weekday);
      let status = "fechado";
      let detail = "Fechado";
      if (feriado) {
        status = feriado.fecha_dia_todo === false ? "parcial" : "feriado";
        detail = feriado.fecha_dia_todo === false
          ? `${feriado.nome} (${timeToInput(feriado.hora_inicio)}–${timeToInput(feriado.hora_fim)})`
          : feriado.nome;
      } else if (horario?.aberto) {
        status = "aberto";
        detail = `${horario.hora_inicio || "?"}–${horario.hora_fim || "?"}`;
        if (horario.hora_inicio_tarde) {
          detail += ` / ${horario.hora_inicio_tarde}–${horario.hora_fim_tarde || "?"}`;
        }
      }
      const today = formatDateInput(new Date()) === ymd;
      cells.push(`
        <div class="calendario-day calendario-day--${status} ${today ? "is-today" : ""}" title="${escapeHtml(detail)}">
          <div class="calendario-day-num">${day}</div>
          <div class="calendario-day-label">${escapeHtml(detail)}</div>
        </div>
      `);
    }
    e.calendarioAgendaGrid.innerHTML = `
      <div class="calendario-weekdays">
        ${DIAS_SEMANA.map((d) => `<div>${escapeHtml(d.curto)}</div>`).join("")}
      </div>
      <div class="calendario-days">${cells.join("")}</div>
    `;
  }

  function renderCalendarioKpis() {
    const e = els();
    const horarios = state().calendario.horarios || [];
    const abertos = horarios.filter((h) => h.aberto).length;
    const feriados = state().calendario.feriados || [];
    const today = formatDateInput(new Date());
    const year = new Date().getFullYear();
    const futuros = feriados.filter((f) => f.data >= today || f.recorrente).length;
    const noAno = feriados.filter((f) => String(f.data).startsWith(String(year)) || f.recorrente).length;
    if (e.calendarioKpiDiasAbertos) e.calendarioKpiDiasAbertos.textContent = `${abertos}/7`;
    if (e.calendarioKpiFeriadosAno) e.calendarioKpiFeriadosAno.textContent = String(noAno);
    if (e.calendarioKpiProximos) e.calendarioKpiProximos.textContent = String(futuros);
  }

  function renderCalendarioSection() {
    ensureStateDefaults();
    setCalendarioView(state().calendario.view);
    renderCalendarioKpis();
    renderHorariosTable();
    renderFeriadosTable();
    renderAgendaMonth();
  }

  function attachCalendarioEvents() {
    ensureStateDefaults();
    const e = els();

    for (const btn of e.calendarioViewButtons || []) {
      btn.addEventListener("click", () => {
        setCalendarioView(btn.getAttribute("data-calendario-view") || "horarios");
        renderCalendarioSection();
      });
    }

    if (e.calendarioHorariosTable) {
      e.calendarioHorariosTable.addEventListener("change", (ev) => {
        const t = ev.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.getAttribute("data-cal-h-field") !== "aberto") return;
        const dia = Number(t.getAttribute("data-dia"));
        const h = state().calendario.horarios.find((x) => x.dia_semana === dia);
        if (h) h.aberto = t.checked;
        renderHorariosTable();
      });
    }

    if (e.calendarioSaveHorariosBtn) {
      e.calendarioSaveHorariosBtn.addEventListener("click", async () => {
        try {
          await saveHorarios();
        } catch (err) {
          showToast(`Erro ao salvar horários: ${err.message}`, "error");
        }
      });
    }

    if (e.openFeriadoModalBtn) {
      e.openFeriadoModalBtn.addEventListener("click", () => openFeriadoModal());
    }
    if (e.closeFeriadoModalBtn) {
      e.closeFeriadoModalBtn.addEventListener("click", closeFeriadoModal);
    }
    if (e.feriadoModal) {
      e.feriadoModal.addEventListener("click", (ev) => {
        if (ev.target === e.feriadoModal) closeFeriadoModal();
      });
    }
    if (e.feriadoForm) {
      e.feriadoForm.addEventListener("submit", async (ev) => {
        try {
          await saveFeriado(ev);
        } catch (err) {
          showToast(`Erro ao salvar: ${err.message}`, "error");
        }
      });
      const fecha = e.feriadoForm.elements.namedItem("fecha_dia_todo");
      if (fecha) {
        fecha.addEventListener("change", () => {
          if (e.feriadoHorarioWrap) e.feriadoHorarioWrap.classList.toggle("hidden", fecha.checked);
        });
      }
    }
    if (e.calendarioFeriadoBusca) {
      e.calendarioFeriadoBusca.addEventListener("input", () => renderFeriadosTable());
    }

    if (e.calendarioAgendaPrevBtn) {
      e.calendarioAgendaPrevBtn.addEventListener("click", () => {
        let m = state().calendario.previewMonth - 1;
        let y = state().calendario.previewYear;
        if (m < 0) {
          m = 11;
          y -= 1;
        }
        state().calendario.previewMonth = m;
        state().calendario.previewYear = y;
        renderAgendaMonth();
      });
    }
    if (e.calendarioAgendaNextBtn) {
      e.calendarioAgendaNextBtn.addEventListener("click", () => {
        let m = state().calendario.previewMonth + 1;
        let y = state().calendario.previewYear;
        if (m > 11) {
          m = 0;
          y += 1;
        }
        state().calendario.previewMonth = m;
        state().calendario.previewYear = y;
        renderAgendaMonth();
      });
    }

    document.addEventListener("click", async (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      const editId = t.closest("[data-edit-feriado]")?.getAttribute("data-edit-feriado");
      const delId = t.closest("[data-del-feriado]")?.getAttribute("data-del-feriado");
      try {
        if (editId) {
          openFeriadoModal(Number(editId));
          return;
        }
        if (delId) {
          await deleteFeriado(Number(delId));
        }
      } catch (err) {
        showToast(err.message || String(err), "error");
      }
    });
  }

  return {
    ensureCalendarioLoaded,
    renderCalendarioSection,
    attachCalendarioEvents,
    ensureStateDefaults
  };
}
