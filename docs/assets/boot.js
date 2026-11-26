// Se ejecuta en <head> antes del body: aplica preferencias sin parpadeo.
(function () {
  try {
    var raw = localStorage.getItem('seyro-mp4.settings');
    var settings = raw ? JSON.parse(raw) : {};
    var root = document.documentElement;
    var modes = ['paper', 'terminal', 'system'];
    var fonts = ['grotesk', 'mono', 'editorial'];
    var accents = ['seyroo', 'lime', 'coral', 'cyan', 'amber', 'custom'];
    var hexMap = {
      seyroo: '#ff6b00', lime: '#c6ff00', coral: '#ff4d3d', cyan: '#00d9ff', amber: '#ffb000'
    };
    root.dataset.mode = modes.indexOf(settings.mode) >= 0 ? settings.mode : 'system';
    root.dataset.font = fonts.indexOf(settings.font) >= 0 ? settings.font : 'grotesk';
    root.dataset.accent = accents.indexOf(settings.accent) >= 0 ? settings.accent : 'seyroo';
    root.lang = settings.locale === 'en' ? 'en' : 'es';
    var accent = settings.accent === 'custom' ? settings.customAccent : hexMap[settings.accent];
    if (typeof accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(accent)) {
      root.style.setProperty('--accent', accent.toLowerCase());
    }
  } catch (error) {
    // localStorage puede estar bloqueado; los defaults de CSS siguen vigentes.
  }
})();
