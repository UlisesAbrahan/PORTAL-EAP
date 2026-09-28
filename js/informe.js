const COLOR_PRIMARIO = "1F3A5F";
const COLOR_ACENTO = "2A9D8F";
const COLOR_SUAVE = "5C6B7A";
const COLOR_FONDO_ETIQUETA = "EEF3F8";
const ANCHO_UTIL = 9638;

function formatearFechaIso(fechaIso) {
  if (!fechaIso) return "";
  const partes = String(fechaIso).split("-");
  if (partes.length !== 3) return fechaIso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function contar(lista, obtenerClave) {
  const mapa = new Map();
  lista.forEach(item => {
    const clave = obtenerClave(item) || "Sin dato";
    mapa.set(clave, (mapa.get(clave) || 0) + 1);
  });
  return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
}

export function construirInformeWord(docx, datos) {
  const {
    Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
    BorderStyle, AlignmentType, Header, Footer, PageNumber, HeadingLevel
  } = docx;

  const bordeFino = { style: BorderStyle.SINGLE, size: 4, color: "C9D2DC" };
  const bordes = { top: bordeFino, bottom: bordeFino, left: bordeFino, right: bordeFino };

  function texto(valor, opciones = {}) {
    return new TextRun({ text: valor === null || valor === undefined ? "" : String(valor), size: 21, ...opciones });
  }

  function parrafo(valor, opciones = {}) {
    return new Paragraph({ spacing: { after: 100 }, ...opciones.parrafo, children: [texto(valor, opciones.texto)] });
  }

  function celda(contenido, ancho, opciones = {}) {
    const lineas = String(contenido === null || contenido === undefined ? "" : contenido).split("\n");
    return new TableCell({
      width: { size: ancho, type: WidthType.DXA },
      borders: bordes,
      shading: opciones.fondo ? { type: ShadingType.CLEAR, fill: opciones.fondo, color: "auto" } : undefined,
      margins: { top: 70, bottom: 70, left: 110, right: 110 },
      children: lineas.map(linea => new Paragraph({
        alignment: opciones.alineacion,
        children: [texto(linea, { bold: !!opciones.negrita, color: opciones.color })]
      }))
    });
  }

  function tablaClaveValor(filas, anchoClave) {
    return new Table({
      width: { size: ANCHO_UTIL, type: WidthType.DXA },
      columnWidths: [anchoClave, ANCHO_UTIL - anchoClave],
      rows: filas.map(([clave, valor]) => new TableRow({
        cantSplit: true,
        children: [
          celda(clave, anchoClave, { fondo: COLOR_FONDO_ETIQUETA, negrita: true, color: COLOR_PRIMARIO }),
          celda(valor, ANCHO_UTIL - anchoClave)
        ]
      }))
    });
  }

  function tablaConteo(titulo, entradas) {
    const anchoCantidad = 1600;
    const anchoNombre = ANCHO_UTIL - anchoCantidad;
    const encabezado = new TableRow({
      tableHeader: true,
      children: [
        celda(titulo, anchoNombre, { fondo: COLOR_PRIMARIO, negrita: true, color: "FFFFFF" }),
        celda("Intervenciones", anchoCantidad, { fondo: COLOR_PRIMARIO, negrita: true, color: "FFFFFF", alineacion: AlignmentType.CENTER })
      ]
    });
    const cuerpo = entradas.map(([nombre, total]) => new TableRow({
      cantSplit: true,
      children: [
        celda(nombre, anchoNombre),
        celda(String(total), anchoCantidad, { alineacion: AlignmentType.CENTER })
      ]
    }));
    return new Table({
      width: { size: ANCHO_UTIL, type: WidthType.DXA },
      columnWidths: [anchoNombre, anchoCantidad],
      rows: [encabezado, ...cuerpo]
    });
  }

  function titulo2(valor) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      keepNext: true,
      spacing: { before: 320, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR_ACENTO, space: 2 } },
      children: [new TextRun({ text: valor, bold: true, size: 26, color: COLOR_PRIMARIO })]
    });
  }

  function espacio() {
    return new Paragraph({ spacing: { after: 120 }, children: [] });
  }

  const registros = datos.registros || [];
  const alumnosMapa = new Map();
  registros.forEach(registro => {
    const id = registro.alumno.id || `${registro.alumno.apellido}-${registro.alumno.nombre}`;
    if (!alumnosMapa.has(id)) alumnosMapa.set(id, { alumno: registro.alumno, registros: [] });
    alumnosMapa.get(id).registros.push(registro);
  });
  const grupos = Array.from(alumnosMapa.values()).sort((a, b) =>
    `${a.alumno.apellido} ${a.alumno.nombre}`.localeCompare(`${b.alumno.apellido} ${b.alumno.nombre}`, "es")
  );
  grupos.forEach(grupo => grupo.registros.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))));

  const filasDatos = [
    ["Fecha de emisión", datos.fechaEmision],
    ["Generado por", datos.generadoPor]
  ];
  (datos.filtros || []).forEach(par => filasDatos.push(par));
  if (!datos.filtros || datos.filtros.length === 0) filasDatos.push(["Filtros aplicados", "Sin filtros (todos los registros)"]);

  const contenido = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80 },
      children: [new TextRun({ text: datos.titulo.toUpperCase(), bold: true, size: 32, color: COLOR_PRIMARIO })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [new TextRun({ text: "Equipo de Apoyo Pedagógico", size: 23, color: COLOR_SUAVE })]
    }),
    tablaClaveValor(filasDatos, 2600),

    titulo2("Resumen"),
    tablaClaveValor([
      ["Cantidad de alumnos", String(grupos.length)],
      ["Cantidad de intervenciones", String(registros.length)]
    ], 4200),
    espacio()
  ];

  if (grupos.length > 1 || contar(registros, r => r.area).length > 1) {
    contenido.push(tablaConteo("Intervenciones por área", contar(registros, r => r.area)));
    contenido.push(espacio());
    contenido.push(tablaConteo("Intervenciones por docente", contar(registros, r => r.docente)));
  }

  contenido.push(titulo2("Detalle de acompañamientos"));

  grupos.forEach(grupo => {
    const alumno = grupo.alumno;
    contenido.push(new Paragraph({
      heading: HeadingLevel.HEADING_3,
      keepNext: true,
      spacing: { before: 280, after: 100 },
      children: [new TextRun({
        text: `${alumno.apellido}, ${alumno.nombre}`,
        bold: true,
        size: 24,
        color: COLOR_ACENTO
      })]
    }));
    const notificacion = alumno.notificado
      ? `Notificado${alumno.fecha_notificacion ? " el " + formatearFechaIso(alumno.fecha_notificacion) : ""}`
      : "No registrada";
    contenido.push(tablaClaveValor([
      ["Curso y división", `${alumno.curso} ${alumno.division} · Turno ${alumno.turno}`],
      ["Estado general", alumno.estado_seguimiento],
      ["Notificación", notificacion]
    ], 2600));
    contenido.push(espacio());

    grupo.registros.forEach((registro, indice) => {
      contenido.push(new Paragraph({
        keepNext: true,
        spacing: { before: 120, after: 60 },
        children: [new TextRun({
          text: `Acompañamiento ${indice + 1} · ${formatearFechaIso(registro.fecha)} · ${registro.area}`,
          bold: true,
          size: 21,
          color: COLOR_PRIMARIO
        })]
      }));
      contenido.push(tablaClaveValor([
        ["Docente", registro.docente],
        ["Actividad realizada", registro.actividad],
        ["Objetivo", registro.objetivo],
        ["Metodología", registro.metodologia],
        ["Observaciones", registro.observaciones || "Sin observaciones."],
        ["Resultado / evolución", registro.resultado || "Sin registrar."]
      ], 2600));
      contenido.push(espacio());
    });
  });

  contenido.push(new Paragraph({ spacing: { before: 700, after: 0 }, children: [] }));
  contenido.push(new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    columnWidths: [4400, 838, 4400],
    rows: [new TableRow({
      cantSplit: true,
      children: ["Equipo de Apoyo Pedagógico", "", "Equipo Directivo"].map((etiqueta, i) => new TableCell({
        width: { size: i === 1 ? 838 : 4400, type: WidthType.DXA },
        borders: {
          top: i === 1 ? { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } : { style: BorderStyle.SINGLE, size: 6, color: "000000" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
        },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60 },
          children: [new TextRun({ text: etiqueta, size: 20, color: COLOR_SUAVE })]
        })]
      }))
    })]
  }));

  return new Document({
    creator: datos.institucion,
    title: datos.titulo,
    styles: { default: { document: { run: { font: "Calibri" } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1300, bottom: 1100, left: 1134, right: 1134, header: 500, footer: 500 }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: datos.institucion, bold: true, size: 26, color: COLOR_PRIMARIO })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: COLOR_PRIMARIO, space: 4 } },
              children: [new TextRun({ text: "Portal de Seguimiento y Acompañamiento Pedagógico", size: 18, color: COLOR_SUAVE })]
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Documento de carácter confidencial · Página ", size: 17, color: COLOR_SUAVE }),
              new TextRun({ children: [PageNumber.CURRENT], size: 17, color: COLOR_SUAVE }),
              new TextRun({ text: " de ", size: 17, color: COLOR_SUAVE }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 17, color: COLOR_SUAVE })
            ]
          })]
        })
      },
      children: contenido
    }]
  });
}
