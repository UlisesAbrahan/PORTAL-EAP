import { supabaseClient } from "./config.js";
import { requerirSesion, etiquetaRol } from "./auth.js";
import { NOMBRE_INSTITUCION } from "./config.js";
import { construirInformeWord } from "./informe.js";
import { escapeHtml, formatearFecha, claseBadgeEstado, mostrarEstado, ocultarEstado, activarMenuMovil, descargarBlob, hoyISO } from "./utils.js";

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
  document.getElementById("btnExportarWord").addEventListener("click", exportarWord);
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

function textoSeleccionado(idSelect) {
  const select = document.getElementById(idSelect);
  if (!select.value) return "";
  return select.options[select.selectedIndex].text;
}

async function exportarWord() {
  if (registrosCache.length === 0) {
    window.alert("No hay registros para exportar con los filtros actuales.");
    return;
  }
  const boton = document.getElementById("btnExportarWord");
  boton.disabled = true;
  try {
    const desde = document.getElementById("filtroDesde").value;
    const hasta = document.getElementById("filtroHasta").value;
    const filtros = [];
    const campos = [
      ["Alumno", document.getElementById("filtroAlumno").value.trim()],
      ["Curso", document.getElementById("filtroCurso").value.trim()],
      ["División", document.getElementById("filtroDivision").value.trim()],
      ["Área", textoSeleccionado("filtroArea")],
      ["Docente", textoSeleccionado("filtroDocente")],
      ["Estado del alumno", textoSeleccionado("filtroEstadoAlumno")],
      ["Fecha desde", desde ? formatearFecha(desde) : ""],
      ["Fecha hasta", hasta ? formatearFecha(hasta) : ""]
    ];
    campos.forEach(([etiqueta, valor]) => {
      if (valor) filtros.push([etiqueta, valor]);
    });

    const documento = construirInformeWord(window.docx, {
      institucion: NOMBRE_INSTITUCION,
      titulo: "Histórico de acompañamiento pedagógico",
      filtros: filtros,
      generadoPor: `${perfilActual.nombre} ${perfilActual.apellido} (${etiquetaRol(perfilActual.rol)})`,
      fechaEmision: formatearFecha(hoyISO()),
      registros: registrosCache.map(registro => ({
        alumno: registro.alumnos,
        area: registro.areas?.nombre || "",
        docente: registro.perfiles ? `${registro.perfiles.apellido}, ${registro.perfiles.nombre}` : "",
        fecha: registro.fecha,
        actividad: registro.actividad,
        objetivo: registro.objetivo,
        metodologia: registro.metodologia,
        observaciones: registro.observaciones,
        resultado: registro.resultado
      }))
    });
    const blob = await window.docx.Packer.toBlob(documento);
    descargarBlob(blob, `historico_acompanamiento_${desde || "inicio"}_${hasta || "actual"}.docx`);
  } catch (error) {
    window.alert("No se pudo generar el documento Word.");
  } finally {
    boton.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", iniciar);
