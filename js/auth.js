import { supabaseClient } from "./config.js";
import { mostrarEstado, ocultarEstado, escapeHtml } from "./utils.js";

export async function iniciarSesion(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function cerrarSesion() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

export async function obtenerPerfilActual() {
  const { data: sesionData } = await supabaseClient.auth.getSession();
  const sesion = sesionData?.session;
  if (!sesion) return null;
  const { data: perfil, error } = await supabaseClient
    .from("perfiles")
    .select("id, nombre, apellido, email, rol, area_id, activo, areas ( nombre )")
    .eq("id", sesion.user.id)
    .single();
  if (error) return null;
  return perfil;
}

export async function requerirSesion() {
  const { data: sesionData } = await supabaseClient.auth.getSession();
  const sesion = sesionData?.session;
  if (!sesion) {
    window.location.href = "login.html";
    return null;
  }
  const perfil = await obtenerPerfilActual();
  if (!perfil || !perfil.activo) {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
    return null;
  }
  construirMenu(perfil);
  const botonLogout = document.getElementById("btnCerrarSesion");
  if (botonLogout) {
    botonLogout.addEventListener("click", cerrarSesion);
  }
  return perfil;
}

function construirMenu(perfil) {
  const lista = document.getElementById("navList");
  if (!lista) return;
  const pagina = window.location.pathname.split("/").pop();
  const items = [
    { href: "dashboard.html", label: "Inicio" },
    { href: "alumnos.html", label: "Alumnos" },
    { href: "perfil.html", label: "Mi perfil" }
  ];
  if (perfil.rol === "directivo" || perfil.rol === "administrador") {
    items.push({ seccion: "Gestión" });
    items.push({ href: "directivo.html", label: "Panel directivo" });
    items.push({ href: "historico.html", label: "Histórico" });
    items.push({ href: "novedades.html", label: "Gestión de novedades" });
  }
  if (perfil.rol === "administrador") {
    items.push({ seccion: "Sistema" });
    items.push({ href: "admin.html", label: "Administración" });
  }
  lista.innerHTML = items.map(item => {
    if (item.seccion) {
      return `<li class="nav-section-title">${escapeHtml(item.seccion)}</li>`;
    }
    const activa = item.href === pagina ? "active" : "";
    return `<li><a class="${activa}" href="${item.href}">${escapeHtml(item.label)}</a></li>`;
  }).join("");

  const nombreDisplay = document.getElementById("sidebarNombre");
  const rolDisplay = document.getElementById("sidebarRol");
  if (nombreDisplay) nombreDisplay.textContent = `${perfil.nombre} ${perfil.apellido}`;
  if (rolDisplay) rolDisplay.textContent = etiquetaRol(perfil.rol);
}

export function etiquetaRol(rol) {
  const mapa = {
    profesor: "Profesor",
    directivo: "Directivo",
    administrador: "Administrador"
  };
  return mapa[rol] || rol;
}

export function configurarFormularioLogin() {
  const form = document.getElementById("formLogin");
  const estado = document.getElementById("estadoLogin");
  if (!form) return;
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const boton = document.getElementById("btnIngresar");
    boton.disabled = true;
    mostrarEstado(estado, "cargando", "Verificando credenciales...");
    try {
      await iniciarSesion(email, password);
      const perfil = await obtenerPerfilActual();
      if (!perfil) {
        mostrarEstado(estado, "error", "No se encontró un perfil asociado a esta cuenta. Contacte al administrador.");
        await supabaseClient.auth.signOut();
        boton.disabled = false;
        return;
      }
      if (!perfil.activo) {
        mostrarEstado(estado, "error", "Esta cuenta se encuentra desactivada. Contacte al equipo directivo.");
        await supabaseClient.auth.signOut();
        boton.disabled = false;
        return;
      }
      window.location.href = "dashboard.html";
    } catch (error) {
      boton.disabled = false;
      const mensaje = interpretarErrorLogin(error);
      mostrarEstado(estado, "error", mensaje);
    }
  });
}

function interpretarErrorLogin(error) {
  const texto = (error?.message || "").toLowerCase();
  if (texto.includes("invalid login credentials")) {
    return "El email o la contraseña son incorrectos.";
  }
  if (texto.includes("failed to fetch") || texto.includes("network")) {
    return "No se pudo establecer conexión con el servidor. Verifique su conexión a internet.";
  }
  return "Ocurrió un problema al iniciar sesión. Intente nuevamente.";
}

export async function redirigirSiYaHaySesion() {
  const { data: sesionData } = await supabaseClient.auth.getSession();
  if (sesionData?.session) {
    const perfil = await obtenerPerfilActual();
    if (perfil && perfil.activo) {
      window.location.href = "dashboard.html";
    }
  }
}
