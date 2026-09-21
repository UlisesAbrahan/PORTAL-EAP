import { supabaseClient } from "./config.js";
import { requerirSesion } from "./auth.js";
import { escapeHtml, claseBadgeEstado, mostrarEstado, ocultarEstado, activarMenuMovil } from "./utils.js";

let perfilActual = null;
let areasDisponibles = [];
let alumnosCache = [];

async function iniciar() {
  activarMenuMovil();
  perfilActual = await requerirSesion();
  if (!perfilActual) return;

  if (perfilActual.rol === "directivo" || perfilActual.rol === "administrador") {
    document.getElementById("btnNuevoAlumno").classList.remove("hidden");
    document.getElementById("btnNuevoAlumno").addEventListener("click", () => {
      window.location.href = "alumnos.html?nuevo=1";
    });
  }

  await cargarAreas();
  await cargarAlumnos();

  document.getElementById("filtroBusqueda").addEventListener("input", aplicarFiltros);
  document.getElementById("filtroCurso").addEventListener("input", aplicarFiltros);
  document.getElementById("filtroDivision").addEventListener("input", aplicarFiltros);
  document.getElementById("filtroEstado").addEventListener("change", aplicarFiltros);
  document.getElementById("filtroArea").addEventListener("change", aplicarFiltros);

  const parametros = new URLSearchParams(window.location.search);
  if (parametros.get("nuevo") === "1") {
    document.getElementById("modalNuevoAlumno").classList.remove("hidden");
  }

  document.getElementById("btnCerrarModalNuevo").addEventListener("click", cerrarModalNuevo);
  document.getElementById("formNuevoAlumno").addEventListener("submit", crearAlumno);
}

function cerrarModalNuevo() {
  document.getElementById("modalNuevoAlumno").classList.add("hidden");
  window.history.replaceState({}, "", "alumnos.html");
}

async function crearAlumno(evento) {
  evento.preventDefault();
  const estado = document.getElementById("estadoModalNuevo");
  const boton = document.getElementById("btnGuardarNuevoAlumno");
  boton.disabled = true;
  mostrarEstado(estado, "cargando", "Guardando alumno...");

  const nuevo = {
    nombre: document.getElementById("nuevoNombre").value.trim(),
    apellido: document.getElementById("nuevoApellido").value.trim(),
    curso: document.getElementById("nuevoCurso").value.trim(),
    division: document.getElementById("nuevoDivision").value.trim(),
    turno: document.getElementById("nuevoTurno").value,
    estado_seguimiento: document.getElementById("nuevoEstado").value,
    observaciones_generales: document.getElementById("nuevoObservaciones").value.trim()
  };

  const { data, error } = await supabaseClient.from("alumnos").insert(nuevo).select().single();
  if (error) {
    boton.disabled = false;
    mostrarEstado(estado, "error", "No se pudo crear el alumno. Verifique los datos ingresados.");
    return;
  }

  const areaInicial = document.getElementById("nuevoAreaInicial").value;
  if (areaInicial) {
    await supabaseClient.from("alumno_areas").insert({
      alumno_id: data.id,
      area_id: areaInicial,
      estado: "Pendiente"
    });
  }

  mostrarEstado(estado, "exito", "Alumno creado correctamente.");
  setTimeout(() => {
    window.location.href = `alumno.html?id=${data.id}`;
  }, 800);
}

async function cargarAreas() {
  const { data } = await supabaseClient.from("areas").select("id, nombre").eq("activo", true).order("nombre");
  areasDisponibles = data || [];
  const select = document.getElementById("filtroArea");
  const selectModal = document.getElementById("nuevoAreaInicial");
  const opciones = areasDisponibles.map(a => `<option value="${a.id}">${escapeHtml(a.nombre)}</option>`).join("");
  select.innerHTML = `<option value="">Todas las áreas</option>${opciones}`;
  if (selectModal) selectModal.innerHTML = opciones;
}

async function cargarAlumnos() {
  const estado = document.getElementById("estadoAlumnos");
  mostrarEstado(estado, "cargando", "Cargando alumnos...");
  const { data, error } = await supabaseClient
    .from("alumnos")
    .select("id, nombre, apellido, curso, division, turno, estado_seguimiento, activo, alumno_areas ( estado, areas ( id, nombre ) )")
    .eq("activo", true)
    .order("apellido");

  if (error) {
    mostrarEstado(estado, "error", "No se pudieron cargar los alumnos.");
    return;
  }
  alumnosCache = data || [];
  ocultarEstado(estado);
  aplicarFiltros();
}

function aplicarFiltros() {
  const busqueda = document.getElementById("filtroBusqueda").value.trim().toLowerCase();
  const curso = document.getElementById("filtroCurso").value.trim().toLowerCase();
  const division = document.getElementById("filtroDivision").value.trim().toLowerCase();
  const estadoFiltro = document.getElementById("filtroEstado").value;
  const areaFiltro = document.getElementById("filtroArea").value;

  let resultado = alumnosCache.filter(alumno => {
    const nombreCompleto = `${alumno.nombre} ${alumno.apellido}`.toLowerCase();
    if (busqueda && !nombreCompleto.includes(busqueda)) return false;
    if (curso && !alumno.curso.toLowerCase().includes(curso)) return false;
    if (division && !alumno.division.toLowerCase().includes(division)) return false;
    if (estadoFiltro && alumno.estado_seguimiento !== estadoFiltro) return false;
    if (areaFiltro && !alumno.alumno_areas.some(rel => rel.areas?.id === areaFiltro)) return false;
    return true;
  });

  if (perfilActual.rol === "profesor" && perfilActual.area_id) {
    resultado = resultado.slice().sort((a, b) => {
      const aTiene = a.alumno_areas.some(rel => rel.areas?.id === perfilActual.area_id) ? 0 : 1;
      const bTiene = b.alumno_areas.some(rel => rel.areas?.id === perfilActual.area_id) ? 0 : 1;
      return aTiene - bTiene;
    });
  }

  renderizarTabla(resultado);
}

function renderizarTabla(lista) {
  const contenedor = document.getElementById("tablaAlumnosBody");
  const estadoVacio = document.getElementById("estadoAlumnos");
  if (lista.length === 0) {
    contenedor.innerHTML = "";
    mostrarEstado(estadoVacio, "vacio", "No se encontraron alumnos con los filtros aplicados.");
    return;
  }
  ocultarEstado(estadoVacio);
  contenedor.innerHTML = lista.map(alumno => {
    const areas = alumno.alumno_areas.map(rel => rel.areas?.nombre).filter(Boolean).join(", ") || "Sin áreas asignadas";
    return `
      <tr onclick="window.location.href='alumno.html?id=${alumno.id}'" style="cursor:pointer">
        <td>${escapeHtml(alumno.apellido)}, ${escapeHtml(alumno.nombre)}</td>
        <td>${escapeHtml(alumno.curso)}</td>
        <td>${escapeHtml(alumno.division)}</td>
        <td><span class="badge ${claseBadgeEstado(alumno.estado_seguimiento)}">${escapeHtml(alumno.estado_seguimiento)}</span></td>
        <td>${escapeHtml(areas)}</td>
      </tr>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", iniciar);
