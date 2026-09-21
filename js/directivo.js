import { supabaseClient } from "./config.js";
import { requerirSesion } from "./auth.js";
import { escapeHtml, mostrarEstado, ocultarEstado, activarMenuMovil } from "./utils.js";

async function iniciar() {
  activarMenuMovil();
  const perfil = await requerirSesion();
  if (!perfil) return;

  if (perfil.rol === "profesor") {
    document.getElementById("main").innerHTML = `<div class="estado-msg estado-error">No cuenta con permisos para acceder a esta sección.</div>`;
    return;
  }

  await cargarEstadisticas();
}

async function cargarEstadisticas() {
  const estado = document.getElementById("estadoPanel");
  mostrarEstado(estado, "cargando", "Calculando estadísticas institucionales...");

  const [alumnosResp, seguimientosResp, docentesResp, areasResp] = await Promise.all([
    supabaseClient.from("alumnos").select("id, estado_seguimiento").eq("activo", true),
    supabaseClient.from("seguimientos").select("id, area_id, docente_id, fecha, areas ( nombre ), perfiles ( nombre, apellido )"),
    supabaseClient.from("perfiles").select("id").eq("rol", "profesor").eq("activo", true),
    supabaseClient.from("areas").select("id, nombre").eq("activo", true)
  ]);

  if (alumnosResp.error || seguimientosResp.error || docentesResp.error || areasResp.error) {
    mostrarEstado(estado, "error", "No se pudieron calcular las estadísticas del panel.");
    return;
  }

  ocultarEstado(estado);

  const alumnos = alumnosResp.data || [];
  const seguimientos = seguimientosResp.data || [];
  const docentes = docentesResp.data || [];
  const areas = areasResp.data || [];

  const enSeguimiento = alumnos.filter(a => a.estado_seguimiento !== "Finalizado").length;

  document.getElementById("statAlumnosSeguimiento").textContent = enSeguimiento;
  document.getElementById("statIntervenciones").textContent = seguimientos.length;
  document.getElementById("statDocentes").textContent = docentes.length;
  document.getElementById("statAreas").textContent = areas.length;

  renderizarBarras("porArea", agrupar(seguimientos, r => r.areas?.nombre || "Sin área"));
  renderizarBarras("porDocente", agrupar(seguimientos, r => r.perfiles ? `${r.perfiles.apellido}, ${r.perfiles.nombre}` : "Sin asignar"));

  const porMes = agrupar(seguimientos, r => {
    const partes = (r.fecha || "").split("-");
    return partes.length === 3 ? `${partes[1]}/${partes[0]}` : "Sin fecha";
  });
  renderizarBarras("porPeriodo", porMes);
}

function agrupar(lista, obtenerClave) {
  const mapa = {};
  lista.forEach(item => {
    const clave = obtenerClave(item);
    mapa[clave] = (mapa[clave] || 0) + 1;
  });
  return mapa;
}

function renderizarBarras(idContenedor, mapa) {
  const contenedor = document.getElementById(idContenedor);
  const entradas = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  if (entradas.length === 0) {
    contenedor.innerHTML = `<p class="page-subtitle">Sin datos disponibles.</p>`;
    return;
  }
  const maximo = Math.max(...entradas.map(([, valor]) => valor));
  contenedor.innerHTML = entradas.map(([nombre, valor]) => {
    const porcentaje = Math.round((valor / maximo) * 100);
    return `
      <div class="mini-bar-row">
        <div class="mini-bar-label">${escapeHtml(nombre)}</div>
        <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${porcentaje}%"></div></div>
        <div class="mini-bar-value">${valor}</div>
      </div>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", iniciar);
