import { supabaseClient } from "./config.js";
import { requerirSesion, etiquetaRol } from "./auth.js";
import { escapeHtml, mostrarEstado, ocultarEstado, activarMenuMovil } from "./utils.js";

let perfilActual = null;
let areasCache = [];
let perfilesCache = [];

async function iniciar() {
  activarMenuMovil();
  perfilActual = await requerirSesion();
  if (!perfilActual) return;

  if (perfilActual.rol !== "administrador") {
    document.getElementById("main").innerHTML = `<div class="estado-msg estado-error">Esta sección está reservada para usuarios administradores.</div>`;
    return;
  }

  await cargarAreas();
  await cargarPerfiles();

  document.getElementById("btnNuevoPerfil").addEventListener("click", () => abrirModalPerfil());
  document.getElementById("btnCerrarModalPerfil").addEventListener("click", cerrarModalPerfil);
  document.getElementById("formPerfil").addEventListener("submit", guardarPerfil);
  document.getElementById("selectRolPerfil").addEventListener("change", actualizarVisibilidadArea);

  document.getElementById("btnNuevaArea").addEventListener("click", () => abrirModalArea());
  document.getElementById("btnCerrarModalAreaAdmin").addEventListener("click", cerrarModalArea);
  document.getElementById("formAreaAdmin").addEventListener("submit", guardarArea);
}

async function cargarAreas() {
  const estado = document.getElementById("estadoAreasAdmin");
  mostrarEstado(estado, "cargando", "Cargando áreas...");
  const { data, error } = await supabaseClient.from("areas").select("id, nombre, activo").order("nombre");
  if (error) {
    mostrarEstado(estado, "error", "No se pudieron cargar las áreas.");
    return;
  }
  areasCache = data || [];
  ocultarEstado(estado);
  renderizarAreas();

  const selectArea = document.getElementById("selectAreaPerfil");
  selectArea.innerHTML = areasCache.filter(a => a.activo).map(a => `<option value="${a.id}">${escapeHtml(a.nombre)}</option>`).join("");
}

function renderizarAreas() {
  const contenedor = document.getElementById("listaAreasAdmin");
  contenedor.innerHTML = areasCache.map(area => `
    <div class="novedad-item">
      <strong>${escapeHtml(area.nombre)}</strong>
      <span class="badge ${area.activo ? "badge-mejora" : "badge-finalizado"}" style="margin-left:8px">${area.activo ? "Activa" : "Inactiva"}</span>
      <button class="btn btn-secundario btn-sm" style="float:right" data-toggle-area="${area.id}" data-actual="${area.activo}">
        ${area.activo ? "Desactivar" : "Activar"}
      </button>
    </div>
  `).join("");

  contenedor.querySelectorAll("[data-toggle-area]").forEach(boton => {
    boton.addEventListener("click", () => cambiarEstadoArea(boton.getAttribute("data-toggle-area"), boton.getAttribute("data-actual") === "true"));
  });
}

async function cambiarEstadoArea(id, actual) {
  await supabaseClient.from("areas").update({ activo: !actual }).eq("id", id);
  await cargarAreas();
}

function abrirModalArea() {
  document.getElementById("formAreaAdmin").reset();
  document.getElementById("modalAreaAdmin").classList.remove("hidden");
}

function cerrarModalArea() {
  document.getElementById("modalAreaAdmin").classList.add("hidden");
}

async function guardarArea(evento) {
  evento.preventDefault();
  const estado = document.getElementById("estadoModalAreaAdmin");
  const nombre = document.getElementById("nombreNuevaArea").value.trim();
  mostrarEstado(estado, "cargando", "Guardando área...");
  const { error } = await supabaseClient.from("areas").insert({ nombre });
  if (error) {
    mostrarEstado(estado, "error", "No se pudo crear el área. Verifique que no exista otra con el mismo nombre.");
    return;
  }
  mostrarEstado(estado, "exito", "Área creada correctamente.");
  await cargarAreas();
  setTimeout(cerrarModalArea, 700);
}

async function cargarPerfiles() {
  const estado = document.getElementById("estadoPerfilesAdmin");
  mostrarEstado(estado, "cargando", "Cargando usuarios...");
  const { data, error } = await supabaseClient
    .from("perfiles")
    .select("id, nombre, apellido, email, rol, area_id, activo, areas ( nombre )")
    .order("apellido");
  if (error) {
    mostrarEstado(estado, "error", "No se pudieron cargar los perfiles de usuario.");
    return;
  }
  perfilesCache = data || [];
  ocultarEstado(estado);
  renderizarPerfiles();
}

function renderizarPerfiles() {
  const cuerpo = document.getElementById("tablaPerfilesBody");
  cuerpo.innerHTML = perfilesCache.map(perfil => `
    <tr>
      <td>${escapeHtml(perfil.apellido)}, ${escapeHtml(perfil.nombre)}</td>
      <td>${escapeHtml(perfil.email)}</td>
      <td>${escapeHtml(etiquetaRol(perfil.rol))}</td>
      <td>${escapeHtml(perfil.areas?.nombre || "No corresponde")}</td>
      <td>${perfil.activo ? "Activa" : "Desactivada"}</td>
      <td>
        <button class="btn btn-secundario btn-sm" data-editar-perfil="${perfil.id}">Editar</button>
        <button class="btn btn-sm ${perfil.activo ? "btn-peligro" : "btn-acento"}" data-toggle-perfil="${perfil.id}" data-actual="${perfil.activo}">
          ${perfil.activo ? "Desactivar" : "Activar"}
        </button>
      </td>
    </tr>
  `).join("");

  cuerpo.querySelectorAll("[data-editar-perfil]").forEach(boton => {
    boton.addEventListener("click", () => abrirModalPerfil(boton.getAttribute("data-editar-perfil")));
  });
  cuerpo.querySelectorAll("[data-toggle-perfil]").forEach(boton => {
    boton.addEventListener("click", () => cambiarEstadoPerfil(boton.getAttribute("data-toggle-perfil"), boton.getAttribute("data-actual") === "true"));
  });
}

async function cambiarEstadoPerfil(id, actual) {
  await supabaseClient.from("perfiles").update({ activo: !actual }).eq("id", id);
  await cargarPerfiles();
}

function actualizarVisibilidadArea() {
  const rol = document.getElementById("selectRolPerfil").value;
  const campoArea = document.getElementById("campoAreaPerfil");
  if (rol === "profesor") {
    campoArea.classList.remove("hidden");
  } else {
    campoArea.classList.add("hidden");
  }
}

function abrirModalPerfil(idExistente) {
  const form = document.getElementById("formPerfil");
  form.reset();
  document.getElementById("perfilIdEditando").value = "";
  document.getElementById("campoIdAuth").classList.remove("hidden");
  document.getElementById("tituloModalPerfil").textContent = "Nuevo usuario del sistema";

  if (typeof idExistente === "string") {
    const perfil = perfilesCache.find(p => p.id === idExistente);
    if (perfil) {
      document.getElementById("tituloModalPerfil").textContent = "Editar usuario";
      document.getElementById("perfilIdEditando").value = perfil.id;
      document.getElementById("campoIdAuth").classList.add("hidden");
      document.getElementById("idAuthPerfil").value = perfil.id;
      document.getElementById("nombrePerfil").value = perfil.nombre;
      document.getElementById("apellidoPerfil").value = perfil.apellido;
      document.getElementById("emailPerfil").value = perfil.email;
      document.getElementById("selectRolPerfil").value = perfil.rol;
      if (perfil.area_id) document.getElementById("selectAreaPerfil").value = perfil.area_id;
    }
  }
  actualizarVisibilidadArea();
  document.getElementById("modalPerfil").classList.remove("hidden");
}

function cerrarModalPerfil() {
  document.getElementById("modalPerfil").classList.add("hidden");
}

async function guardarPerfil(evento) {
  evento.preventDefault();
  const estado = document.getElementById("estadoModalPerfil");
  const boton = document.getElementById("btnGuardarPerfil");
  boton.disabled = true;
  mostrarEstado(estado, "cargando", "Guardando usuario...");

  const idEditando = document.getElementById("perfilIdEditando").value;
  const rol = document.getElementById("selectRolPerfil").value;
  const registro = {
    nombre: document.getElementById("nombrePerfil").value.trim(),
    apellido: document.getElementById("apellidoPerfil").value.trim(),
    email: document.getElementById("emailPerfil").value.trim(),
    rol: rol,
    area_id: rol === "profesor" ? document.getElementById("selectAreaPerfil").value : null
  };

  let resultado;
  if (idEditando) {
    resultado = await supabaseClient.from("perfiles").update(registro).eq("id", idEditando);
  } else {
    registro.id = document.getElementById("idAuthPerfil").value.trim();
    resultado = await supabaseClient.from("perfiles").insert(registro);
  }

  boton.disabled = false;
  if (resultado.error) {
    mostrarEstado(estado, "error", "No se pudo guardar el usuario. Verifique el UUID y que no exista un perfil previo con ese identificador.");
    return;
  }
  mostrarEstado(estado, "exito", "Usuario guardado correctamente.");
  await cargarPerfiles();
  setTimeout(cerrarModalPerfil, 700);
}

document.addEventListener("DOMContentLoaded", iniciar);
