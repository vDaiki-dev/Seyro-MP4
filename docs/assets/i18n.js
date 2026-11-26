// Diccionarios centralizados. Idioma por defecto: español; respaldo automático.

export const DEFAULT_LOCALE = 'es';
export const LOCALES = ['es', 'en'];

const DICTIONARIES = {
  es: {
    'app.title': 'Seyro-MP4',
    'app.badge': 'BRUTALISTA · LOCAL · SIN IA',
    'app.subtitle': 'Inspecciona primero. Descarga después. Nunca inventes una resolución.',

    'nav.inspector': 'Inspector',
    'nav.queue': 'Cola',
    'nav.appearance': 'Apariencia',
    'nav.help': 'Ayuda',

    'action.analyze': 'Analizar enlace',
    'action.clear': 'Limpiar',
    'action.cancel': 'Cancelar',
    'action.retry': 'Reintentar',
    'action.copyPath': 'Copiar ruta',
    'action.close': 'Cerrar',
    'action.save': 'Guardar',
    'action.settings': 'Apariencia e idioma',
    'action.demoSkeleton': 'Ver skeleton',
    'action.download': 'Descargar selección',
    'action.clearHistory': 'Limpiar historial',
    'action.copyDiagnostic': 'Copiar diagnóstico',

    'label.link': 'Enlace público',
    'label.linkPlaceholder': 'https://...',
    'label.mode': 'Modo',
    'label.accent': 'Acento',
    'label.font': 'Tipografía',
    'label.language': 'Idioma',
    'label.platform': 'Origen',
    'label.quality': 'Calidad real',
    'label.tracks': 'Pistas reales',
    'label.status': 'Estado',
    'label.size': 'Tamaño',
    'label.duration': 'Duración',
    'label.author': 'Autor',
    'label.title': 'Título',
    'label.trackCount': 'Pistas visibles',
    'label.sourceHeight': 'Altura del origen',
    'label.customColor': 'Color personalizado',
    'label.contrast': 'Contraste',
    'label.videoTrack': 'Vídeo',
    'label.audioTrack': 'Audio',
    'label.container': 'Contenedor',
    'label.estimatedSize': 'Tamaño estimado',
    'label.requiresMux': 'Requiere mux',
    'label.transcoded': 'Transcodificado',
    'label.tools': 'Herramientas locales',
    'label.outputDir': 'Carpeta de salida',
    'label.selection': 'Selección real',
    'value.unknown': 'Desconocido',
    'value.yes': 'Sí',
    'value.no': 'No',

    'status.idle': 'Sin analizar',
    'status.analyzing': 'Analizando enlace',
    'status.resolving': 'Resolviendo formatos',
    'status.downloading': 'Descargando',
    'status.processing': 'Procesando / muxing',
    'status.done': 'Completado',
    'status.error': 'Error',
    'status.cancelled': 'Cancelado',

    'empty.inspector': 'Pega un enlace público y pulsa Analizar. Aquí aparecerán solo los metadatos reales.',
    'empty.tracks': 'Todavía no hay pistas. Solo se mostrarán las que existan en el origen.',
    'empty.queue': 'La cola está vacía.',
    'empty.demo': 'Vista de componentes: el skeleton usa la matriz de puntos de DIVAE.',
    'skeleton.label': 'Cargando metadatos reales',

    'toast.emptyLink': 'Pega un enlace antes de analizar.',
    'toast.enginePending': 'El motor de descarga llega en el Paso 5. La interfaz ya está lista.',
    'toast.settingsSaved': 'Preferencias guardadas en este dispositivo.',
    'toast.copied': 'Copiado al portapapeles.',
    'toast.invalidContrast': 'Ese acento no alcanza contraste legible. Prueba otro color.',
    'toast.desktopOnly': 'La inspección real se ejecuta en la aplicación de escritorio Tauri.',
    'toast.toolsMissing': 'Instala yt-dlp en el PATH para poder inspeccionar enlaces.',
    'toast.inspecting': 'Inspeccionando el origen real…',
    'toast.downloadStarted': 'Descarga iniciada con pistas verificadas.',
    'toast.nothingSelected': 'Elige al menos una pista real antes de descargar.',
    'toast.pathUnavailable': 'La ruta definitiva todavía no está disponible.',
    'toast.copiedDiagnostic': 'Diagnóstico copiado sin datos sensibles.',

    'modal.appearance.title': 'Apariencia e idioma',
    'modal.shortcuts.title': 'Atajos de teclado',
    'modal.legal.title': 'Documentación legal',

    'mode.paper': 'Papel',
    'mode.terminal': 'Terminal',
    'mode.system': 'Sistema',

    'accent.seyroo': 'Naranja Seyroo',
    'accent.lime': 'Lima ácido',
    'accent.coral': 'Coral',
    'accent.cyan': 'Cian',
    'accent.amber': 'Ámbar',
    'accent.custom': 'Personalizado',

    'font.grotesk': 'Grotesca',
    'font.mono': 'Monotécnica',
    'font.editorial': 'Editorial',

    'contrast.ok': 'Contraste suficiente',
    'contrast.bad': 'Contraste insuficiente',

    'platform.youtube': 'YouTube',
    'platform.youtube_music': 'YouTube Music',
    'platform.instagram': 'Instagram',
    'platform.tiktok': 'TikTok',
    'platform.spotify': 'Spotify',
    'platform.directo': 'Archivo directo',

    'error.E_URL_INVALIDA': 'Revisa el enlace: solo se admiten URLs públicas HTTPS.',
    'error.E_PLATAFORMA_NO_SOPORTADA': 'Este dominio no tiene adaptador. Puedes probar con un archivo directo.',
    'error.E_CONTENIDO_RESTRINGIDO': 'El origen restringió el acceso. No se intenta eludir.',
    'error.E_DRM': 'Contenido protegido por DRM: no descargable, sin elusión.',
    'error.E_FORMATO_NO_DISPONIBLE': 'El formato solicitado no existe. Elige una pista de la tabla.',
    'error.E_HERRAMIENTA_FALTANTE': 'Instala la herramienta que falta o usa una pista sin procesado.',
    'error.E_CANCELADO': 'Descarga cancelada por el usuario.',
    'error.E_INTERNO': 'Se produjo un error local. Puedes copiar un diagnóstico sin datos sensibles.',
    'error.E_INSPECCION': 'No se pudo inspeccionar este enlace.',
    'error.E_JSON_INVALIDO': 'La herramienta devolvió metadatos que no se pudieron leer.',
    'error.E_DIRECTORIO': 'No se pudo crear la carpeta de descargas.',
    'error.E_RUTA_INVALIDA': 'La ruta de salida no es segura.',
    'error.E_NOMBRE_INVALIDO': 'El nombre de archivo no es válido.',
    'error.E_DESCARGA': 'La descarga falló; revisa el diagnóstico.',
    'error.E_TRABAJO_NO_ENCONTRADO': 'Ese trabajo ya no existe en la cola.',
    'error.IPC_NO_DISPONIBLE': 'Esta acción solo está disponible en la aplicación de escritorio.',
    'discarded.count': '{count} pistas descartadas por superar la altura real del origen',

    'legal.privacy': 'Privacidad',
    'legal.terms': 'Términos',
    'legal.cookies': 'Cookies y almacenamiento',
    'legal.disclaimer': 'Descargo legal',
    'footer.disclaimer': 'Herramienta técnica. No fomenta piratería ni elude DRM. Úsala bajo tu responsabilidad.',

    'web.hero.kicker': 'FAMILIA SEYROO · HERRAMIENTA TÉCNICA',
    'web.hero.title': 'Descarga honesta, bloque a bloque.',
    'web.hero.sub': 'Inspecciona las pistas que existen de verdad. Sin calidades inventadas, sin servidores propios, sin telemetría.',
    'web.card.visual.title': '01 · Brutalismo limpio',
    'web.card.visual.body': 'Bloques rectos, bordes de 2px, rejilla visible y contraste real. Cero gradientes de plantilla.',
    'web.card.theme.title': '02 · Temas y acento',
    'web.card.theme.body': 'Papel, terminal o sistema. Acentos curados y color personalizado validado por contraste WCAG.',
    'web.card.i18n.title': '03 · Español e inglés',
    'web.card.i18n.body': 'Todos los textos en diccionarios, con respaldo automático y estructura lista para más idiomas.',
    'web.card.fonts.title': '04 · Tipografía a elegir',
    'web.card.fonts.body': 'Grotesca, monotécnica o editorial, siempre con fallbacks del sistema y sin peticiones de red.',
    'web.status.title': 'Estado real del proyecto',
    'web.status.body': 'Interfaz, núcleo, motor y cola conectados. Esta web es documentación: la inspección real ocurre en la app de escritorio, con yt-dlp y ffmpeg locales.',
    'web.legal.title': 'Uso responsable',
    'web.legal.body': 'Solo contenido propio o con permiso. Spotify y otros contenidos con DRM no son descargables y no se intenta eludir su protección.',
    'web.action.repo': 'Ver repositorio',
    'web.action.docs': 'Documentación',
    'web.action.design': 'Sistema de diseño',
    'web.footer.note': 'GitHub Pages aloja documentación, no un descargador simulado.',

    'shortcut.analyze': 'Analizar enlace',
    'shortcut.settings': 'Abrir apariencia',
    'shortcut.escape': 'Cerrar diálogo',
  },

  en: {
    'app.title': 'Seyro-MP4',
    'app.badge': 'BRUTALIST · LOCAL · NO AI',
    'app.subtitle': 'Inspect first. Download after. Never invent a resolution.',

    'nav.inspector': 'Inspector',
    'nav.queue': 'Queue',
    'nav.appearance': 'Appearance',
    'nav.help': 'Help',

    'action.analyze': 'Analyze link',
    'action.clear': 'Clear',
    'action.cancel': 'Cancel',
    'action.retry': 'Retry',
    'action.copyPath': 'Copy path',
    'action.close': 'Close',
    'action.save': 'Save',
    'action.settings': 'Appearance and language',
    'action.demoSkeleton': 'Show skeleton',
    'action.download': 'Download selection',
    'action.clearHistory': 'Clear history',
    'action.copyDiagnostic': 'Copy diagnostic',

    'label.link': 'Public link',
    'label.linkPlaceholder': 'https://...',
    'label.mode': 'Mode',
    'label.accent': 'Accent',
    'label.font': 'Typeface',
    'label.language': 'Language',
    'label.platform': 'Source',
    'label.quality': 'Real quality',
    'label.tracks': 'Real tracks',
    'label.status': 'Status',
    'label.size': 'Size',
    'label.duration': 'Duration',
    'label.author': 'Author',
    'label.title': 'Title',
    'label.trackCount': 'Visible tracks',
    'label.sourceHeight': 'Source height',
    'label.customColor': 'Custom color',
    'label.contrast': 'Contrast',
    'label.videoTrack': 'Video',
    'label.audioTrack': 'Audio',
    'label.container': 'Container',
    'label.estimatedSize': 'Estimated size',
    'label.requiresMux': 'Requires mux',
    'label.transcoded': 'Transcoded',
    'label.tools': 'Local tools',
    'label.outputDir': 'Output folder',
    'label.selection': 'Real selection',
    'value.unknown': 'Unknown',
    'value.yes': 'Yes',
    'value.no': 'No',

    'status.idle': 'Not analyzed',
    'status.analyzing': 'Analyzing link',
    'status.resolving': 'Resolving formats',
    'status.downloading': 'Downloading',
    'status.processing': 'Processing / muxing',
    'status.done': 'Done',
    'status.error': 'Error',
    'status.cancelled': 'Cancelled',

    'empty.inspector': 'Paste a public link and press Analyze. Only real metadata appears here.',
    'empty.tracks': 'No tracks yet. Only tracks that exist at the source will be listed.',
    'empty.queue': 'The queue is empty.',
    'empty.demo': 'Component preview: the skeleton uses the DIVAE dot matrix.',
    'skeleton.label': 'Loading real metadata',

    'toast.emptyLink': 'Paste a link before analyzing.',
    'toast.enginePending': 'The download engine arrives in Step 5. The interface is ready.',
    'toast.settingsSaved': 'Preferences saved on this device.',
    'toast.copied': 'Copied to clipboard.',
    'toast.invalidContrast': 'That accent is not legible enough. Try another color.',
    'toast.desktopOnly': 'Real inspection runs in the Tauri desktop app.',
    'toast.toolsMissing': 'Install yt-dlp on your PATH before inspecting links.',
    'toast.inspecting': 'Inspecting the real source…',
    'toast.downloadStarted': 'Download started with verified tracks.',
    'toast.nothingSelected': 'Pick at least one real track before downloading.',
    'toast.pathUnavailable': 'The final path is not available yet.',
    'toast.copiedDiagnostic': 'Diagnostic copied without sensitive data.',

    'modal.appearance.title': 'Appearance and language',
    'modal.shortcuts.title': 'Keyboard shortcuts',
    'modal.legal.title': 'Legal documentation',

    'mode.paper': 'Paper',
    'mode.terminal': 'Terminal',
    'mode.system': 'System',

    'accent.seyroo': 'Seyroo orange',
    'accent.lime': 'Acid lime',
    'accent.coral': 'Coral',
    'accent.cyan': 'Cyan',
    'accent.amber': 'Amber',
    'accent.custom': 'Custom',

    'font.grotesk': 'Grotesk',
    'font.mono': 'Technical mono',
    'font.editorial': 'Editorial',

    'contrast.ok': 'Enough contrast',
    'contrast.bad': 'Not enough contrast',

    'platform.youtube': 'YouTube',
    'platform.youtube_music': 'YouTube Music',
    'platform.instagram': 'Instagram',
    'platform.tiktok': 'TikTok',
    'platform.spotify': 'Spotify',
    'platform.directo': 'Direct file',

    'error.E_URL_INVALIDA': 'Check the link: only public HTTPS URLs are accepted.',
    'error.E_PLATAFORMA_NO_SOPORTADA': 'No adapter for this domain. Try a direct media file.',
    'error.E_CONTENIDO_RESTRINGIDO': 'The source restricted access. No bypass is attempted.',
    'error.E_DRM': 'DRM-protected content: not downloadable, no bypass.',
    'error.E_FORMATO_NO_DISPONIBLE': 'Requested format does not exist. Pick a track from the table.',
    'error.E_HERRAMIENTA_FALTANTE': 'Install the missing tool or pick a track that needs no processing.',
    'error.E_CANCELADO': 'Download cancelled by the user.',
    'error.E_INTERNO': 'A local error occurred. You can copy a diagnostic without sensitive data.',
    'error.E_INSPECCION': 'This link could not be inspected.',
    'error.E_JSON_INVALIDO': 'The tool returned metadata that could not be read.',
    'error.E_DIRECTORIO': 'The download folder could not be created.',
    'error.E_RUTA_INVALIDA': 'The output path is not safe.',
    'error.E_NOMBRE_INVALIDO': 'The file name is not valid.',
    'error.E_DESCARGA': 'The download failed; check the diagnostic.',
    'error.E_TRABAJO_NO_ENCONTRADO': 'That job no longer exists in the queue.',
    'error.IPC_NO_DISPONIBLE': 'This action is only available in the desktop app.',
    'discarded.count': '{count} tracks discarded for exceeding the real source height',

    'legal.privacy': 'Privacy',
    'legal.terms': 'Terms',
    'legal.cookies': 'Cookies and storage',
    'legal.disclaimer': 'Disclaimer',
    'footer.disclaimer': 'Technical tool. No piracy, no DRM bypass. Use it under your own responsibility.',

    'web.hero.kicker': 'SEYROO FAMILY · TECHNICAL TOOL',
    'web.hero.title': 'Honest downloads, block by block.',
    'web.hero.sub': 'Inspect the tracks that really exist. No invented resolutions, no backend of our own, no telemetry.',
    'web.card.visual.title': '01 · Clean brutalism',
    'web.card.visual.body': 'Straight blocks, 2px borders, a visible grid and real contrast. No template gradients.',
    'web.card.theme.title': '02 · Themes and accent',
    'web.card.theme.body': 'Paper, terminal or system. Curated accents and a custom color checked against WCAG contrast.',
    'web.card.i18n.title': '03 · Spanish and English',
    'web.card.i18n.body': 'Every string lives in dictionaries, with automatic fallback and room for more languages.',
    'web.card.fonts.title': '04 · Typeface choice',
    'web.card.fonts.body': 'Grotesk, technical mono or editorial, always with system fallbacks and no network requests.',
    'web.status.title': 'Actual project status',
    'web.status.body': 'Interface, core, engine and queue are connected. This site is documentation: real inspection happens in the desktop app with local yt-dlp and ffmpeg.',
    'web.legal.title': 'Responsible use',
    'web.legal.body': 'Only your own content or content you are allowed to save. Spotify and other DRM-protected content are not downloadable and no bypass is attempted.',
    'web.action.repo': 'View repository',
    'web.action.docs': 'Documentation',
    'web.action.design': 'Design system',
    'web.footer.note': 'GitHub Pages hosts documentation, not a fake downloader.',

    'shortcut.analyze': 'Analyze link',
    'shortcut.settings': 'Open appearance',
    'shortcut.escape': 'Close dialog',
  },
};

/** Traduce una clave con interpolación simple {nombre} y respaldo a español. */
export function translate(locale, key, vars = {}) {
  const dictionary = DICTIONARIES[locale] || DICTIONARIES[DEFAULT_LOCALE];
  let text = dictionary[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

/** Aplica textos a un árbol DOM usando data-i18n, data-i18n-title y data-i18n-aria. */
export function translateDom(root, locale) {
  if (!root?.querySelectorAll) return root;
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = translate(locale, el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const text = translate(locale, el.dataset.i18nTitle);
    el.setAttribute('title', text);
    if (el.dataset.i18nAria !== undefined) {
      el.setAttribute('aria-label', translate(locale, el.dataset.i18nAria));
    }
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', translate(locale, el.dataset.i18nPlaceholder));
  });
  return root;
}

export function isLocale(locale) {
  return LOCALES.includes(locale);
}

export function dictionarySize(locale) {
  return Object.keys(DICTIONARIES[locale] || {}).length;
}

/** Claves disponibles: permite comprobar paridad entre idiomas en CI. */
export function dictionaryKeys(locale) {
  return Object.keys(DICTIONARIES[locale] || {});
}
