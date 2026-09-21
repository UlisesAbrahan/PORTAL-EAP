import { supabaseClient } from "./config.js";
import { requerirSesion, etiquetaRol } from "./auth.js";
import { escapeHtml, formatearFecha, mostrarEstado, ocultarEstado, activarMenuMovil } from "./utils.js";

async function iniciar() {
  activarMenuMovil();
  const perfil = await requerirSesion();
  if (!perfil) return;

  document.getElementById("saludoNombre").textContent = `${perfil.nombre} ${perfil.apellido}`;
  document.getElementById("saludoRol").textContent = etiquetaRol(perfil.rol);
  const areaTexto = perfil.areas?.nombre ? perfil.areas.nombre : "No corresponde";
  document.getElementById("saludoArea").textContent = areaTexto;

  await cargarNovedades();
}

async function cargarNovedades() {
  const contenedor = document.getElementById("listaNovedades");
  const estado = document.getElementById("estadoNovedades");
  mostrarEstado(estado, "cargando", "Cargando novedades...");
  const { data, error } = await supabaseClient
    .from("novedades")
    .select("id, titulo, contenido, tipo, fecha_publicacion, activo, perfiles ( nombre, apellido )")
    .eq("activo", true)
    .order("fecha_publicacion", { ascending: false })
    .limit(10);

  if (error) {
    mostrarEstado(estado, "error", "No se pudieron cargar las novedades.");
    return;
  }
  if (!data || data.length === 0) {
    mostrarEstado(estado, "vacio", "No hay novedades publicadas por el momento.");
    contenedor.innerHTML = "";
    return;
  }
  ocultarEstado(estado);
  contenedor.innerHTML = data.map(novedad => {
    const autor = novedad.perfiles ? `${novedad.perfiles.nombre} ${novedad.perfiles.apellido}` : "Equipo directivo";
    return `
      <div class="novedad-item">
        <div class="novedad-tipo">${escapeHtml(novedad.tipo)}</div>
        <strong>${escapeHtml(novedad.titulo)}</strong>
        <p>${escapeHtml(novedad.contenido)}</p>
        <div class="novedad-meta">${formatearFecha(novedad.fecha_publicacion)} · ${escapeHtml(autor)}</div>
      </div>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", iniciar);
