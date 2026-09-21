export function escapeHtml(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatearFecha(fechaIso) {
  if (!fechaIso) return "";
  const partes = fechaIso.split("-");
  if (partes.length !== 3) return fechaIso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export function formatearFechaHora(isoCompleto) {
  if (!isoCompleto) return "";
  const fecha = new Date(isoCompleto);
  return fecha.toLocaleString("es-AR");
}

export function claseBadgeEstado(estado) {
  const mapa = {
    "En seguimiento": "badge-seguimiento",
    "Necesita apoyo": "badge-apoyo",
    "Seguimiento intensivo": "badge-intensivo",
    "En proceso de mejora": "badge-mejora",
    "Finalizado": "badge-finalizado",
    "Pendiente": "badge-pendiente"
  };
  return mapa[estado] || "badge-seguimiento";
}

export function mostrarEstado(contenedor, tipo, mensaje) {
  if (!contenedor) return;
  const clases = {
    cargando: "estado-cargando",
    error: "estado-error",
    exito: "estado-exito",
    vacio: "estado-vacio"
  };
  contenedor.innerHTML = `<div class="estado-msg ${clases[tipo] || "estado-cargando"}">${escapeHtml(mensaje)}</div>`;
  contenedor.classList.remove("hidden");
}

export function ocultarEstado(contenedor) {
  if (!contenedor) return;
  contenedor.innerHTML = "";
  contenedor.classList.add("hidden");
}

export function hoyISO() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

export function activarMenuMovil() {
  const boton = document.getElementById("btnMenuMovil");
  const sidebar = document.getElementById("sidebar");
  if (!boton || !sidebar) return;
  boton.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });
}
