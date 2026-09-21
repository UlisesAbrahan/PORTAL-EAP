import { supabaseClient } from "./config.js";
import { requerirSesion } from "./auth.js";
import {
  escapeHtml,
  formatearFecha,
  formatearFechaHora,
  claseBadgeEstado,
  mostrarEstado,
  ocultarEstado,
  hoyISO,
  activarMenuMovil
} from "./utils.js";

let perfilActual = null;
let alumnoId = null;
let areasDisponibles = [];
let docentesCache = [];
let seguimientosCache = [];
let alumnoActual = null;

async function iniciar() {
  activarMenuMovil();
  perfilActual = await requerirSesion();
  if (!perfilActual) return;

  const parametros = new URLSearchParams(window.location.search);
  alumnoId = parametros.get("id");
  if (!alumnoId) {
    window.location.href = "alumnos.html";
    return;
  }

  await cargarAreas();
  await cargarFicha();
  await cargarHistorial();

  if (perfilActual.rol === "directivo" || perfilActual.rol === "administrador") {
    document.getElementById("btnAsignarArea").classList.remove("hidden");
    document.getElementById("btnAsignarArea").addEventListener("click", () => abrirModalArea());
    document.getElementById("btnEditarAlumno").classList.remove("hidden");
    document.getElementById("btnEditarAlumno").addEventListener("click", abrirModalEditarAlumno);
  }

  document.getElementById("btnCerrarModalEditarAlumno").addEventListener("click", cerrarModalEditarAlumno);
  document.getElementById("formEditarAlumno").addEventListener("submit", guardarEdicionAlumno);
  document.getElementById("editNotificado").addEventListener("change", actualizarVisibilidadFechaNotificacion);

  configurarFormularioSeguimiento();

  document.getElementById("btnRegistrarSeguimiento").addEventListener("click", abrirModalSeguimiento);
  document.getElementById("btnCerrarModalSeguimiento").addEventListener("click", cerrarModalSeguimiento);
  document.getElementById("btnCerrarModalArea").addEventListener("click", cerrarModalArea);
  document.getElementById("formArea").addEventListener("submit", guardarAsignacionArea);

  document.getElementById("filtroHistArea").addEventListener("change", renderizarHistorial);
  document.getElementById("filtroHistDocente").addEventListener("change", renderizarHistorial);
  document.getElementById("filtroHistDesde").addEventListener("change", renderizarHistorial);
  document.getElementById("filtroHistHasta").addEventListener("change", renderizarHistorial);

  if (perfilActual.rol === "profesor") {
    document.getElementById("campoAreaSeguimiento").classList.add("hidden");
    document.getElementById("campoDocenteSeguimiento").classList.add("hidden");
  } else {
    document.getElementById("selectAreaSeguimiento").addEventListener("change", cargarDocentesPorArea);
  }
}

async function cargarAreas() {
  const { data } = await supabaseClient.from("areas").select("id, nombre").eq("activo", true).order("nombre");
  areasDisponibles = data || [];
  const selectFiltro = document.getElementById("filtroHistArea");
  const selectSeguimiento = document.getElementById("selectAreaSeguimiento");
  const selectAsignacion = document.getElementById("selectAreaAsignacion");
  const opciones = areasDisponibles.map(a => `<option value="${a.id}">${escapeHtml(a.nombre)}</option>`).join("");
  selectFiltro.innerHTML = `<option value="">Todas las áreas</option>${opciones}`;
  if (selectSeguimiento) selectSeguimiento.innerHTML = opciones;
  if (selectAsignacion) selectAsignacion.innerHTML = opciones;
}

async function cargarFicha() {
  const estado = document.getElementById("estadoFicha");
  mostrarEstado(estado, "cargando", "Cargando información del alumno...");
  const { data, error } = await supabaseClient
    .from("alumnos")
    .select("id, nombre, apellido, curso, division, turno, estado_seguimiento, observaciones_generales, notificado, fecha_notificacion, activo, alumno_areas ( id, estado, observaciones, areas ( id, nombre ) )")
    .eq("id", alumnoId)
    .single();

  if (error || !data) {
    mostrarEstado(estado, "error", "No se pudo encontrar el alumno solicitado.");
    return;
  }
  alumnoActual = data;
  ocultarEstado(estado);

  document.getElementById("fichaNombre").textContent = `${data.nombre} ${data.apellido}`;
  document.getElementById("fichaCurso").textContent = data.curso;
  document.getElementById("fichaDivision").textContent = data.division;
  document.getElementById("fichaTurno").textContent = data.turno;
  document.getElementById("fichaObservaciones").textContent = data.observaciones_generales || "Sin observaciones registradas.";
  const badgeEstado = document.getElementById("fichaEstado");
  badgeEstado.textContent = data.estado_seguimiento;
  badgeEstado.className = `badge ${claseBadgeEstado(data.estado_seguimiento)}`;

  const badgeNotificado = document.getElementById("fichaNotificado");
  if (data.notificado) {
    badgeNotificado.textContent = `Notificado${data.fecha_notificacion ? " · " + formatearFecha(data.fecha_notificacion) : ""}`;
    badgeNotificado.classList.remove("hidden");
  } else {
    badgeNotificado.classList.add("hidden");
  }

  const areasActivas = (data.alumno_areas || []).filter(rel => rel.estado !== "Finalizado").length;
  document.getElementById("fichaContadorAreas").textContent = `Áreas actualmente activas: ${areasActivas}`;

  const listaAreas = document.getElementById("listaAreasAlumno");
  if (!data.alumno_areas || data.alumno_areas.length === 0) {
    listaAreas.innerHTML = `<p class="page-subtitle">Este alumno no tiene áreas de acompañamiento asignadas.</p>`;
  } else {
    listaAreas.innerHTML = data.alumno_areas.map(rel => `
      <div class="novedad-item">
        <strong>${escapeHtml(rel.areas?.nombre || "Área")}</strong>
        <span class="badge ${claseBadgeEstado(rel.estado)}" style="margin-left:8px">${escapeHtml(rel.estado)}</span>
        <p>${escapeHtml(rel.observaciones || "Sin observaciones.")}</p>
      </div>
    `).join("");
  }
}

async function cargarHistorial() {
  const estado = document.getElementById("estadoHistorial");
  mostrarEstado(estado, "cargando", "Cargando historial de acompañamiento...");
  const { data, error } = await supabaseClient
    .from("seguimientos")
    .select("id, fecha, actividad, objetivo, metodologia, observaciones, resultado, updated_at, created_at, area_id, docente_id, areas ( nombre ), perfiles ( id, nombre, apellido )")
    .eq("alumno_id", alumnoId)
    .order("fecha", { ascending: false });

  if (error) {
    mostrarEstado(estado, "error", "No se pudo cargar el historial de acompañamiento.");
    return;
  }
  seguimientosCache = data || [];
  ocultarEstado(estado);

  const docentesUnicos = new Map();
  seguimientosCache.forEach(registro => {
    if (registro.perfiles) {
      docentesUnicos.set(registro.perfiles.id, `${registro.perfiles.nombre} ${registro.perfiles.apellido}`);
    }
  });
  const selectDocente = document.getElementById("filtroHistDocente");
  const opciones = Array.from(docentesUnicos.entries())
    .map(([id, nombre]) => `<option value="${id}">${escapeHtml(nombre)}</option>`)
    .join("");
  selectDocente.innerHTML = `<option value="">Todos los docentes</option>${opciones}`;

  renderizarHistorial();
}

function renderizarHistorial() {
  const area = document.getElementById("filtroHistArea").value;
  const docente = document.getElementById("filtroHistDocente").value;
  const desde = document.getElementById("filtroHistDesde").value;
  const hasta = document.getElementById("filtroHistHasta").value;

  const filtrados = seguimientosCache.filter(registro => {
    if (area && registro.area_id !== area) return false;
    if (docente && registro.docente_id !== docente) return false;
    if (desde && registro.fecha < desde) return false;
    if (hasta && registro.fecha > hasta) return false;
    return true;
  });

  const contenedor = document.getElementById("listaHistorial");
  const estadoVacio = document.getElementById("estadoHistorialVacio");
  if (filtrados.length === 0) {
    contenedor.innerHTML = "";
    mostrarEstado(estadoVacio, "vacio", "No hay registros de acompañamiento con los filtros seleccionados.");
    return;
  }
  ocultarEstado(estadoVacio);

  contenedor.innerHTML = filtrados.map(registro => {
    const docenteNombre = registro.perfiles ? `${registro.perfiles.nombre} ${registro.perfiles.apellido}` : "Sin asignar";
    const puedeEditar = perfilActual.rol !== "profesor" || registro.docente_id === perfilActual.id;
    const puedeEliminar = perfilActual.rol === "directivo" || perfilActual.rol === "administrador";
    return `
      <div class="card">
        <div class="section-heading">
          <h2>${escapeHtml(registro.areas?.nombre || "Área")} · ${formatearFecha(registro.fecha)}</h2>
          <div>
            ${puedeEditar ? `<button class="btn btn-secundario btn-sm" data-editar="${registro.id}">Editar</button>` : ""}
            ${puedeEliminar ? `<button class="btn btn-peligro btn-sm" data-eliminar="${registro.id}">Eliminar</button>` : ""}
          </div>
        </div>
        <p><strong>Docente:</strong> ${escapeHtml(docenteNombre)}</p>
        <p><strong>Actividad:</strong> ${escapeHtml(registro.actividad)}</p>
        <p><strong>Objetivo:</strong> ${escapeHtml(registro.objetivo)}</p>
        <p><strong>Metodología:</strong> ${escapeHtml(registro.metodologia)}</p>
        <p><strong>Observaciones:</strong> ${escapeHtml(registro.observaciones || "Sin observaciones.")}</p>
        <p><strong>Resultado / evolución:</strong> ${escapeHtml(registro.resultado || "Sin registrar.")}</p>
        ${registro.updated_at !== registro.created_at ? `<p class="novedad-meta">Última modificación: ${formatearFechaHora(registro.updated_at)}</p>` : ""}
      </div>
    `;
  }).join("");

  contenedor.querySelectorAll("[data-editar]").forEach(boton => {
    boton.addEventListener("click", () => abrirModalSeguimiento(boton.getAttribute("data-editar")));
  });
  contenedor.querySelectorAll("[data-eliminar]").forEach(boton => {
    boton.addEventListener("click", () => eliminarSeguimiento(boton.getAttribute("data-eliminar")));
  });
}

async function cargarDocentesPorArea() {
  const areaId = document.getElementById("selectAreaSeguimiento").value;
  const select = document.getElementById("selectDocenteSeguimiento");
  if (!areaId) {
    select.innerHTML = "";
    return;
  }
  const { data } = await supabaseClient
    .from("perfiles")
    .select("id, nombre, apellido")
    .eq("area_id", areaId)
    .eq("rol", "profesor")
    .eq("activo", true)
    .order("apellido");
  docentesCache = data || [];
  select.innerHTML = docentesCache.map(d => `<option value="${d.id}">${escapeHtml(d.apellido)}, ${escapeHtml(d.nombre)}</option>`).join("");
}

function configurarFormularioSeguimiento() {
  document.getElementById("formSeguimiento").addEventListener("submit", guardarSeguimiento);
}

function abrirModalSeguimiento(idExistente) {
  const modal = document.getElementById("modalSeguimiento");
  const form = document.getElementById("formSeguimiento");
  form.reset();
  document.getElementById("seguimientoIdEditando").value = "";
  document.getElementById("fecha").value = hoyISO();
  document.getElementById("tituloModalSeguimiento").textContent = "Registrar acompañamiento";

  if (perfilActual.rol === "profesor") {
    document.getElementById("selectDocenteSeguimiento").innerHTML = `<option value="${perfilActual.id}">${escapeHtml(perfilActual.nombre)} ${escapeHtml(perfilActual.apellido)}</option>`;
  }

  if (typeof idExistente === "string") {
    const registro = seguimientosCache.find(r => r.id === idExistente);
    if (registro) {
      document.getElementById("tituloModalSeguimiento").textContent = "Editar acompañamiento";
      document.getElementById("seguimientoIdEditando").value = registro.id;
      document.getElementById("fecha").value = registro.fecha;
      document.getElementById("actividad").value = registro.actividad;
      document.getElementById("objetivo").value = registro.objetivo;
      document.getElementById("metodologia").value = registro.metodologia;
      document.getElementById("observaciones").value = registro.observaciones || "";
      document.getElementById("resultado").value = registro.resultado || "";
      if (perfilActual.rol !== "profesor") {
        document.getElementById("selectAreaSeguimiento").value = registro.area_id;
        cargarDocentesPorArea().then(() => {
          document.getElementById("selectDocenteSeguimiento").value = registro.docente_id;
        });
      }
    }
  }

  modal.classList.remove("hidden");
}

function cerrarModalSeguimiento() {
  document.getElementById("modalSeguimiento").classList.add("hidden");
}

async function guardarSeguimiento(evento) {
  evento.preventDefault();
  const estado = document.getElementById("estadoModalSeguimiento");
  const boton = document.getElementById("btnGuardarSeguimiento");
  boton.disabled = true;
  mostrarEstado(estado, "cargando", "Guardando registro...");

  const idEditando = document.getElementById("seguimientoIdEditando").value;
  const registro = {
    alumno_id: alumnoId,
    fecha: document.getElementById("fecha").value,
    actividad: document.getElementById("actividad").value.trim(),
    objetivo: document.getElementById("objetivo").value.trim(),
    metodologia: document.getElementById("metodologia").value.trim(),
    observaciones: document.getElementById("observaciones").value.trim(),
    resultado: document.getElementById("resultado").value.trim()
  };

  if (perfilActual.rol === "profesor") {
    registro.area_id = perfilActual.area_id;
    registro.docente_id = perfilActual.id;
  } else {
    registro.area_id = document.getElementById("selectAreaSeguimiento").value;
    registro.docente_id = document.getElementById("selectDocenteSeguimiento").value;
  }

  if (!registro.area_id || !registro.docente_id || !registro.fecha || !registro.actividad || !registro.objetivo || !registro.metodologia) {
    boton.disabled = false;
    mostrarEstado(estado, "error", "Complete todos los campos obligatorios.");
    return;
  }

  let resultadoOperacion;
  if (idEditando) {
    resultadoOperacion = await supabaseClient.from("seguimientos").update(registro).eq("id", idEditando);
  } else {
    resultadoOperacion = await supabaseClient.from("seguimientos").insert(registro);
  }

  boton.disabled = false;
  if (resultadoOperacion.error) {
    mostrarEstado(estado, "error", "No se pudo guardar el registro. Verifique los permisos y los datos ingresados.");
    return;
  }

  mostrarEstado(estado, "exito", "Registro guardado correctamente.");
  await cargarHistorial();
  setTimeout(cerrarModalSeguimiento, 700);
}

async function eliminarSeguimiento(id) {
  const confirmado = window.confirm("¿Confirma que desea eliminar este registro de acompañamiento?");
  if (!confirmado) return;
  const { error } = await supabaseClient.from("seguimientos").delete().eq("id", id);
  if (error) {
    window.alert("No se pudo eliminar el registro.");
    return;
  }
  await cargarHistorial();
}

function abrirModalArea() {
  document.getElementById("formArea").reset();
  document.getElementById("modalArea").classList.remove("hidden");
}

function cerrarModalArea() {
  document.getElementById("modalArea").classList.add("hidden");
}

async function guardarAsignacionArea(evento) {
  evento.preventDefault();
  const estado = document.getElementById("estadoModalArea");
  const boton = document.getElementById("btnGuardarArea");
  boton.disabled = true;
  mostrarEstado(estado, "cargando", "Guardando asignación...");

  const registro = {
    alumno_id: alumnoId,
    area_id: document.getElementById("selectAreaAsignacion").value,
    estado: document.getElementById("selectEstadoAsignacion").value,
    observaciones: document.getElementById("observacionesAsignacion").value.trim()
  };

  const { error } = await supabaseClient
    .from("alumno_areas")
    .upsert(registro, { onConflict: "alumno_id,area_id" });

  boton.disabled = false;
  if (error) {
    mostrarEstado(estado, "error", "No se pudo guardar la asignación de área.");
    return;
  }
  mostrarEstado(estado, "exito", "Área asignada correctamente.");
  await cargarFicha();
  setTimeout(cerrarModalArea, 700);
}

function abrirModalEditarAlumno() {
  const form = document.getElementById("formEditarAlumno");
  form.reset();
  document.getElementById("editCurso").value = alumnoActual.curso;
  document.getElementById("editDivision").value = alumnoActual.division;
  document.getElementById("editTurno").value = alumnoActual.turno;
  document.getElementById("editEstado").value = alumnoActual.estado_seguimiento;
  document.getElementById("editObservaciones").value = alumnoActual.observaciones_generales || "";
  document.getElementById("editNotificado").checked = !!alumnoActual.notificado;
  document.getElementById("editFechaNotificacion").value = alumnoActual.fecha_notificacion || "";
  document.getElementById("editActivo").checked = alumnoActual.activo !== false;
  actualizarVisibilidadFechaNotificacion();
  document.getElementById("modalEditarAlumno").classList.remove("hidden");
}

function cerrarModalEditarAlumno() {
  document.getElementById("modalEditarAlumno").classList.add("hidden");
}

function actualizarVisibilidadFechaNotificacion() {
  const marcado = document.getElementById("editNotificado").checked;
  document.getElementById("campoFechaNotificacion").classList.toggle("hidden", !marcado);
  if (!marcado) {
    document.getElementById("editFechaNotificacion").value = "";
  } else if (!document.getElementById("editFechaNotificacion").value) {
    document.getElementById("editFechaNotificacion").value = hoyISO();
  }
}

async function guardarEdicionAlumno(evento) {
  evento.preventDefault();
  const estado = document.getElementById("estadoModalEditarAlumno");
  const boton = document.getElementById("btnGuardarEdicionAlumno");
  boton.disabled = true;
  mostrarEstado(estado, "cargando", "Guardando cambios...");

  const notificado = document.getElementById("editNotificado").checked;
  const registro = {
    curso: document.getElementById("editCurso").value.trim(),
    division: document.getElementById("editDivision").value.trim(),
    turno: document.getElementById("editTurno").value,
    estado_seguimiento: document.getElementById("editEstado").value,
    observaciones_generales: document.getElementById("editObservaciones").value.trim(),
    notificado: notificado,
    fecha_notificacion: notificado ? (document.getElementById("editFechaNotificacion").value || hoyISO()) : null,
    activo: document.getElementById("editActivo").checked
  };

  const { error } = await supabaseClient.from("alumnos").update(registro).eq("id", alumnoId);
  boton.disabled = false;
  if (error) {
    mostrarEstado(estado, "error", "No se pudieron guardar los cambios del alumno.");
    return;
  }
  mostrarEstado(estado, "exito", "Cambios guardados correctamente.");
  await cargarFicha();
  setTimeout(cerrarModalEditarAlumno, 700);
}

document.addEventListener("DOMContentLoaded", iniciar);
