import { supabaseClient } from "./config.js";
import { requerirSesion } from "./auth.js";
import { escapeHtml, formatearFecha, mostrarEstado, ocultarEstado, hoyISO, activarMenuMovil } from "./utils.js";

let perfilActual = null;
let novedadesCache = [];

async function iniciar() {
  activarMenuMovil();
  perfilActual = await requerirSesion();
  if (!perfilActual) return;

  if (perfilActual.rol === "profesor") {
    document.getElementById("main").innerHTML = `<div class="estado-msg estado-error">No cuenta con permisos para acceder a esta sección.</div>`;
    return;
  }

  await cargarNovedades();

  document.getElementById("btnNuevaNovedad").addEventListener("click", () => abrirModal());
  document.getElementById("btnCerrarModalNovedad").addEventListener("click", cerrarModal);
  document.getElementById("formNovedad").addEventListener("submit", guardarNovedad);
}

async function cargarNovedades() {
  const estado = document.getElementById("estadoNovedadesGestion");
  mostrarEstado(estado, "cargando", "Cargando novedades...");
  const { data, error } = await supabaseClient
    .from("novedades")
    .select("id, titulo, contenido, tipo, fecha_publicacion, activo")
    .order("fecha_publicacion", { ascending: false });

  if (error) {
    mostrarEstado(estado, "error", "No se pudieron cargar las novedades.");
    return;
  }
  novedadesCache = data || [];
  ocultarEstado(estado);
  renderizarLista();
}

function renderizarLista() {
  const contenedor = document.getElementById("listaNovedadesGestion");
  if (novedadesCache.length === 0) {
    contenedor.innerHTML = `<div class="estado-msg estado-vacio">Todavía no se publicaron novedades.</div>`;
    return;
  }
  contenedor.innerHTML = novedadesCache.map(novedad => `
    <div class="card">
      <div class="section-heading">
        <h2>${escapeHtml(novedad.titulo)}</h2>
        <div>
          <button class="btn btn-secundario btn-sm" data-editar="${novedad.id}">Editar</button>
          <button class="btn btn-peligro btn-sm" data-eliminar="${novedad.id}">Eliminar</button>
        </div>
      </div>
      <p class="novedad-tipo">${escapeHtml(novedad.tipo)} · ${formatearFecha(novedad.fecha_publicacion)} ${novedad.activo ? "" : "· Inactiva"}</p>
      <p>${escapeHtml(novedad.contenido)}</p>
    </div>
  `).join("");

  contenedor.querySelectorAll("[data-editar]").forEach(boton => {
    boton.addEventListener("click", () => abrirModal(boton.getAttribute("data-editar")));
  });
  contenedor.querySelectorAll("[data-eliminar]").forEach(boton => {
    boton.addEventListener("click", () => eliminarNovedad(boton.getAttribute("data-eliminar")));
  });
}

function abrirModal(idExistente) {
  const form = document.getElementById("formNovedad");
  form.reset();
  document.getElementById("novedadIdEditando").value = "";
  document.getElementById("novedadFecha").value = hoyISO();
  document.getElementById("tituloModalNovedad").textContent = "Nueva novedad";

  if (typeof idExistente === "string") {
    const novedad = novedadesCache.find(n => n.id === idExistente);
    if (novedad) {
      document.getElementById("tituloModalNovedad").textContent = "Editar novedad";
      document.getElementById("novedadIdEditando").value = novedad.id;
      document.getElementById("novedadTitulo").value = novedad.titulo;
      document.getElementById("novedadContenido").value = novedad.contenido;
      document.getElementById("novedadTipo").value = novedad.tipo;
      document.getElementById("novedadFecha").value = novedad.fecha_publicacion;
      document.getElementById("novedadActiva").checked = novedad.activo;
    }
  } else {
    document.getElementById("novedadActiva").checked = true;
  }

  document.getElementById("modalNovedad").classList.remove("hidden");
}

function cerrarModal() {
  document.getElementById("modalNovedad").classList.add("hidden");
}

async function guardarNovedad(evento) {
  evento.preventDefault();
  const estado = document.getElementById("estadoModalNovedad");
  const boton = document.getElementById("btnGuardarNovedad");
  boton.disabled = true;
  mostrarEstado(estado, "cargando", "Guardando novedad...");

  const idEditando = document.getElementById("novedadIdEditando").value;
  const registro = {
    titulo: document.getElementById("novedadTitulo").value.trim(),
    contenido: document.getElementById("novedadContenido").value.trim(),
    tipo: document.getElementById("novedadTipo").value,
    fecha_publicacion: document.getElementById("novedadFecha").value,
    activo: document.getElementById("novedadActiva").checked
  };

  let resultado;
  if (idEditando) {
    resultado = await supabaseClient.from("novedades").update(registro).eq("id", idEditando);
  } else {
    registro.autor_id = perfilActual.id;
    resultado = await supabaseClient.from("novedades").insert(registro);
  }

  boton.disabled = false;
  if (resultado.error) {
    mostrarEstado(estado, "error", "No se pudo guardar la novedad.");
    return;
  }
  mostrarEstado(estado, "exito", "Novedad guardada correctamente.");
  await cargarNovedades();
  setTimeout(cerrarModal, 700);
}

async function eliminarNovedad(id) {
  const confirmado = window.confirm("¿Confirma que desea eliminar esta novedad?");
  if (!confirmado) return;
  const { error } = await supabaseClient.from("novedades").delete().eq("id", id);
  if (error) {
    window.alert("No se pudo eliminar la novedad.");
    return;
  }
  await cargarNovedades();
}

document.addEventListener("DOMContentLoaded", iniciar);
