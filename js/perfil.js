import { supabaseClient } from "./config.js";
import { requerirSesion, etiquetaRol } from "./auth.js";
import { mostrarEstado, ocultarEstado, activarMenuMovil } from "./utils.js";

async function iniciar() {
  activarMenuMovil();
  const perfil = await requerirSesion();
  if (!perfil) return;

  document.getElementById("perfilNombre").textContent = `${perfil.nombre} ${perfil.apellido}`;
  document.getElementById("perfilEmail").textContent = perfil.email;
  document.getElementById("perfilRol").textContent = etiquetaRol(perfil.rol);
  document.getElementById("perfilArea").textContent = perfil.areas?.nombre || "No corresponde";
  document.getElementById("perfilEstado").textContent = perfil.activo ? "Activa" : "Desactivada";

  document.getElementById("formCambiarPassword").addEventListener("submit", cambiarPassword);
}

async function cambiarPassword(evento) {
  evento.preventDefault();
  const estado = document.getElementById("estadoPassword");
  const boton = document.getElementById("btnCambiarPassword");
  const nueva = document.getElementById("nuevaPassword").value;
  const repetida = document.getElementById("repetirPassword").value;

  if (nueva.length < 8) {
    mostrarEstado(estado, "error", "La contraseña debe tener al menos 8 caracteres.");
    return;
  }
  if (nueva !== repetida) {
    mostrarEstado(estado, "error", "Las contraseñas ingresadas no coinciden.");
    return;
  }

  boton.disabled = true;
  mostrarEstado(estado, "cargando", "Actualizando contraseña...");
  const { error } = await supabaseClient.auth.updateUser({ password: nueva });
  boton.disabled = false;
  if (error) {
    mostrarEstado(estado, "error", "No se pudo actualizar la contraseña.");
    return;
  }
  mostrarEstado(estado, "exito", "Contraseña actualizada correctamente.");
  document.getElementById("formCambiarPassword").reset();
}

document.addEventListener("DOMContentLoaded", iniciar);
