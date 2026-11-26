// Puente IPC mínimo. En el navegador no hay red ni descargas: solo la app Tauri.

function bridge() {
  return globalThis.__TAURI__ ?? globalThis.__TAURI_INTERNALS__ ?? null;
}

export function isDesktop() {
  const api = bridge();
  return Boolean(api?.invoke || api?.core?.invoke);
}

/** Invoca un comando local con argumentos explícitos; nunca evalúa cadenas. */
export function invoke(command, args = {}) {
  const api = bridge();
  const fn = api?.core?.invoke ?? api?.invoke;
  if (typeof fn !== 'function') {
    return Promise.reject(Object.assign(new Error('IPC no disponible'), {
      code: 'IPC_NO_DISPONIBLE',
      message: 'IPC no disponible',
      detail: null,
    }));
  }
  try {
    return Promise.resolve(fn.call(api, command, args));
  } catch (error) {
    return Promise.reject(error);
  }
}

/** Normaliza cualquier error IPC a {code, message, detail} sin stack traces. */
export function normalizeError(error) {
  if (error && typeof error === 'object') {
    const code = typeof error.code === 'string' ? error.code.slice(0, 64) : 'E_INTERNO';
    const message = typeof error.message === 'string' ? error.message.slice(0, 300) : 'Error local';
    const detail = typeof error.detail === 'string' ? error.detail.slice(0, 600) : null;
    return { code, message, detail };
  }
  return {
    code: 'E_INTERNO',
    message: typeof error === 'string' ? error.slice(0, 300) : 'Error local',
    detail: null,
  };
}
