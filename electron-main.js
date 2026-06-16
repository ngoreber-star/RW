const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8500;
const ROOT = __dirname;
const APP_NAME = 'RIVER-WALL ERP V.5.0';
const COMPANY = 'D-WALL S.L.';
const COMPANY_NIF = '04101DW-24';
const COMPANY_ADDRESS = 'Calle Rey Bonkoro, Malabo, Guinea Ecuatorial';
const COMPANY_EMAIL = 'soporte@dwall.erognson.com';
const COMPANY_URL = 'https://dwall.erognson.com';
const COMPANY_HUB = 'Erognson (https://erognson.com)';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.sql': 'text/plain; charset=utf-8',
};

const FORBIDDEN_PREFIXES = ['.', 'node_modules', 'dist'];

function serveFile(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/software.html';

  const filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const rel = path.relative(ROOT, filePath);
  const parts = rel.split(path.sep);
  if (parts.some(p => FORBIDDEN_PREFIXES.some(pre => p.startsWith(pre)))) {
    res.writeHead(404);
    return res.end('Not found');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        return res.end('Not found');
      }
      res.writeHead(500);
      return res.end('Server error');
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

let server = null;
let mainWindow = null;

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer(serveFile);
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[RW] Servidor iniciado en http://127.0.0.1:${PORT}`);
      resolve();
    });
    server.on('error', reject);
  });
}

function showAbout() {
  const logoPath = path.join(ROOT, 'logo-river.png');
  const hasLogo = fs.existsSync(logoPath);

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: `Acerca de ${APP_NAME}`,
    icon: hasLogo ? logoPath : undefined,
    message: APP_NAME,
    detail: [
      `Una solución de ${COMPANY}`,
      '',
      'Software empresarial ERP/POS con contabilidad SYSCOHADA',
      'Edición Supabase — Multi-tenant',
      '',
      COMPANY_ADDRESS,
      `N.I.F. ${COMPANY_NIF}`,
      `Email: ${COMPANY_EMAIL}`,
      `Web: ${COMPANY_URL}`,
      `Hub: ${COMPANY_HUB}`,
      '',
      `© ${new Date().getFullYear()} ${COMPANY}`,
      'Todos los derechos reservados.',
      '',
      `Versión: ${app.getVersion()}`,
      `Electron: ${process.versions.electron}`,
      `Node.js: ${process.versions.node}`,
      `Chromium: ${process.versions.chrome}`,
    ].join('\n'),
    buttons: ['Cerrar'],
  });
}

function buildMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Recargar',
          accelerator: 'CmdOrCtrl+R',
          click: () => { if (mainWindow) mainWindow.reload(); },
        },
        { type: 'separator' },
        {
          label: 'Salir',
          accelerator: 'CmdOrCtrl+Q',
          click: () => { app.quit(); },
        },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: `Acerca de ${COMPANY}`,
          click: () => { showAbout(); },
        },
        { type: 'separator' },
        {
          label: 'Sitio web D-WALL S.L',
          click: () => { shell.openExternal(COMPANY_URL); },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(ROOT, 'icon-512.png'),
    title: `${APP_NAME} — ${COMPANY}`,
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}/software.html`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await startServer();
  } catch (err) {
    console.error('[RW] Error al iniciar servidor:', err.message);
    app.quit();
    return;
  }

  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (server) {
    server.close();
    server = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (server) {
    server.close();
    server = null;
  }
});
