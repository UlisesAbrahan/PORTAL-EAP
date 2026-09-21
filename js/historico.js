import { supabaseClient } from "./config.js";
import { requerirSesion } from "./auth.js";
import { escapeHtml, formatearFecha, claseBadgeEstado, mostrarEstado, ocultarEstado, activarMenuMovil } from "./utils.js";

let perfilActual = null;
let registrosCache = [];

async function iniciar() {
  activarMenuMovil();
  perfilActual = await requerirSesion();
  if (!perfilActual) return;

  if (perfilActual.rol === "profesor") {
    document.getElementById("main").innerHTML = `<div class="estado-msg estado-error">No cuenta con permisos para acceder a esta sección.</div>`;
    return;
  }

  await cargarFiltrosIniciales();
  await buscarHistorico();

  document.getElementById("formFiltros").addEventListener("submit", (evento) => {
    evento.preventDefault();
    buscarHistorico();
  });
  document.getElementById("btnLimpiarFiltros").addEventListener("click", () => {
    document.getElementById("formFiltros").reset();
    buscarHistorico();
  });
  document.getElementById("btnExportarExcel").addEventListener("click", exportarExcel);
}

async function cargarFiltrosIniciales() {
  const { data: areas } = await supabaseClient.from("areas").select("id, nombre").eq("activo", true).order("nombre");
  const selectArea = document.getElementById("filtroArea");
  selectArea.innerHTML = `<option value="">Todas</option>${(areas || []).map(a => `<option value="${a.id}">${escapeHtml(a.nombre)}</option>`).join("")}`;

  const { data: docentes } = await supabaseClient.from("perfiles").select("id, nombre, apellido").eq("rol", "profesor").order("apellido");
  const selectDocente = document.getElementById("filtroDocente");
  selectDocente.innerHTML = `<option value="">Todos</option>${(docentes || []).map(d => `<option value="${d.id}">${escapeHtml(d.apellido)}, ${escapeHtml(d.nombre)}</option>`).join("")}`;
}

async function buscarHistorico() {
  const estado = document.getElementById("estadoHistorico");
  mostrarEstado(estado, "cargando", "Buscando registros...");

  let consulta = supabaseClient
    .from("seguimientos")
    .select("id, fecha, actividad, objetivo, metodologia, observaciones, resultado, alumnos ( id, nombre, apellido, curso, division, turno, estado_seguimiento ), areas ( nombre ), perfiles ( nombre, apellido )")
    .order("fecha", { ascending: false });

  const areaId = document.getElementById("filtroArea").value;
  const docenteId = document.getElementById("filtroDocente").value;
  const desde = document.getElementById("filtroDesde").value;
  const hasta = document.getElementById("filtroHasta").value;

  if (areaId) consulta = consulta.eq("area_id", areaId);
  if (docenteId) consulta = consulta.eq("docente_id", docenteId);
  if (desde) consulta = consulta.gte("fecha", desde);
  if (hasta) consulta = consulta.lte("fecha", hasta);

  const { data, error } = await consulta;
  if (error) {
    mostrarEstado(estado, "error", "No se pudieron obtener los registros solicitados.");
    return;
  }

  let filtrados = data || [];

  const alumnoTexto = document.getElementById("filtroAlumno").value.trim().toLowerCase();
  const curso = document.getElementById("filtroCurso").value.trim().toLowerCase();
  const division = document.getElementById("filtroDivision").value.trim().toLowerCase();
  const estadoAlumno = document.getElementById("filtroEstadoAlumno").value;

  filtrados = filtrados.filter(registro => {
    const alumno = registro.alumnos;
    if (!alumno) return false;
    const nombreCompleto = `${alumno.nombre} ${alumno.apellido}`.toLowerCase();
    if (alumnoTexto && !nombreCompleto.includes(alumnoTexto)) return false;
    if (curso && !alumno.curso.toLowerCase().includes(curso)) return false;
    if (division && !alumno.division.toLowerCase().includes(division)) return false;
    if (estadoAlumno && alumno.estado_seguimiento !== estadoAlumno) return false;
    return true;
  });

  registrosCache = filtrados;

  if (filtrados.length === 0) {
    document.getElementById("tablaHistoricoBody").innerHTML = "";
    mostrarEstado(estado, "vacio", "No se encontraron registros con los filtros aplicados.");
    document.getElementById("contadorResultados").textContent = "";
    return;
  }
  ocultarEstado(estado);
  document.getElementById("contadorResultados").textContent = `${filtrados.length} registro(s) encontrado(s)`;
  renderizarTabla(filtrados);
}

function renderizarTabla(lista) {
  const cuerpo = document.getElementById("tablaHistoricoBody");
  cuerpo.innerHTML = lista.map(registro => {
    const alumno = registro.alumnos;
    return `
      <tr>
        <td>${escapeHtml(alumno.apellido)}, ${escapeHtml(alumno.nombre)}</td>
        <td>${escapeHtml(alumno.curso)} ${escapeHtml(alumno.division)}</td>
        <td><span class="badge ${claseBadgeEstado(alumno.estado_seguimiento)}">${escapeHtml(alumno.estado_seguimiento)}</span></td>
        <td>${escapeHtml(registro.areas?.nombre || "")}</td>
        <td>${registro.perfiles ? escapeHtml(registro.perfiles.apellido + ", " + registro.perfiles.nombre) : ""}</td>
        <td>${formatearFecha(registro.fecha)}</td>
        <td>${escapeHtml(registro.resultado || "")}</td>
      </tr>
    `;
  }).join("");
}

function exportarExcel() {
  if (registrosCache.length === 0) {
    window.alert("No hay registros para exportar con los filtros actuales.");
    return;
  }

  const filas = registrosCache.map(registro => ({
    Alumno: `${registro.alumnos.apellido}, ${registro.alumnos.nombre}`,
    Curso: registro.alumnos.curso,
    "División": registro.alumnos.division,
    Turno: registro.alumnos.turno,
    Estado: registro.alumnos.estado_seguimiento,
    "Área": registro.areas?.nombre || "",
    Docente: registro.perfiles ? `${registro.perfiles.apellido}, ${registro.perfiles.nombre}` : "",
    Fecha: formatearFecha(registro.fecha),
    Actividad: registro.actividad,
    Objetivo: registro.objetivo,
    "Metodología": registro.metodologia,
    Observaciones: registro.observaciones || "",
    "Resultado/Evolución": registro.resultado || ""
  }));

  const hojaDatos = XLSX.utils.json_to_sheet(filas);

  const alumnosUnicos = new Set(registrosCache.map(r => r.alumnos.id));
  const intervencionesPorArea = {};
  const intervencionesPorDocente = {};
  registrosCache.forEach(registro => {
    const area = registro.areas?.nombre || "Sin área";
    const docente = registro.perfiles ? `${registro.perfiles.apellido}, ${registro.perfiles.nombre}` : "Sin docente";
    intervencionesPorArea[area] = (intervencionesPorArea[area] || 0) + 1;
    intervencionesPorDocente[docente] = (intervencionesPorDocente[docente] || 0) + 1;
  });

  const filasResumen = [
    { Indicador: "Cantidad de alumnos", Valor: alumnosUnicos.size },
    { Indicador: "Cantidad de intervenciones", Valor: registrosCache.length },
    {},
    { Indicador: "Intervenciones por área", Valor: "" },
    ...Object.entries(intervencionesPorArea).map(([nombre, total]) => ({ Indicador: nombre, Valor: total })),
    {},
    { Indicador: "Intervenciones por docente", Valor: "" },
    ...Object.entries(intervencionesPorDocente).map(([nombre, total]) => ({ Indicador: nombre, Valor: total }))
  ];
  const hojaResumen = XLSX.utils.json_to_sheet(filasResumen, { skipHeader: false });

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hojaDatos, "Histórico");
  XLSX.utils.book_append_sheet(libro, hojaResumen, "Resumen");

  const desde = document.getElementById("filtroDesde").value || "inicio";
  const hasta = document.getElementById("filtroHasta").value || "actual";
  const nombreArchivo = `historico_acompanamiento_${desde}_${hasta}.xlsx`;
  XLSX.writeFile(libro, nombreArchivo);
}

document.addEventListener("DOMContentLoaded", iniciar);
