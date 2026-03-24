const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const log = require('electron-log');
const Database = require('better-sqlite3');
const { autoUpdater } = require('electron-updater');

log.initialize();
log.info('Uygulama başladı...');

autoUpdater.logger = log;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

if (app.isPackaged) {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'bahadiregdir',
    repo: 'planner-app'
  });
}

const dbPath = path.join(app.getPath('userData'), 'planner.db');
let db;
let win;
let tray;
let widgetWindow = null;
let breakOverlayWindows = [];
let timerState = { isWorking: false, isBreak: false, timeLeft: 0, isPaused: false };

function initDatabase() {
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#3B82F6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo',
      priority INTEGER DEFAULT 1,
      due_date TEXT,
      position INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS project_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3B82F6',
      project_id INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS todo_tags (
      todo_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (todo_id, tag_id),
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      position INTEGER DEFAULT 0,
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
    );
  `);
  
  try { db.exec(`ALTER TABLE todos ADD COLUMN priority INTEGER DEFAULT 1;`); } catch (e) {}
  try { db.exec(`ALTER TABLE todos ADD COLUMN due_date TEXT;`); } catch (e) {}
  
  log.info('Veritabanı başlatıldı:', dbPath);
}

function createWindow() {
  const defaultBounds = { x: undefined, y: undefined, width: 1200, height: 800 };
  
  win = new BrowserWindow({
    ...defaultBounds,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    const port = new URL(process.env.VITE_DEV_SERVER_URL).port;
    win.loadURL(`http://localhost:${port}`);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.on('resize', () => {
    if (win && !win.isDestroyed()) {
      const bounds = win.getBounds();
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('windowBounds', JSON.stringify(bounds));
    }
  });

  win.on('move', () => {
    if (win && !win.isDestroyed()) {
      const bounds = win.getBounds();
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('windowBounds', JSON.stringify(bounds));
    }
  });

  win.on('close', (event) => {
    if (process.platform === 'darwin') {
      event.preventDefault();
      win.hide();
    }
  });

  const menu = Menu.buildFromTemplate([
    {
      label: 'Planner',
      submenu: [
        { label: 'Hakkında', role: 'about' },
        { type: 'separator' },
        { label: 'Gizle', accelerator: 'Command+H', click: () => win.hide() },
        { label: 'Diğerlerini Gizle', accelerator: 'Command+Option+H', role: 'hideOthers' },
        { type: 'separator' },
        { label: 'Çıkış', accelerator: 'Command+Q', click: () => { app.exit(0); } }
      ]
    },
    {
      label: 'Düzen',
      submenu: [
        { label: 'Geri Al', accelerator: 'Command+Z', role: 'undo' },
        { label: 'Yinele', accelerator: 'Command+Shift+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Kes', accelerator: 'Command+X', role: 'cut' },
        { label: 'Kopyala', accelerator: 'Command+C', role: 'copy' },
        { label: 'Yapıştır', accelerator: 'Command+V', role: 'paste' },
        { label: 'Tümünü Seç', accelerator: 'Command+A', role: 'selectAll' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateTray() {
  const status = timerState.isWorking 
    ? (timerState.isBreak ? `Mola: ${formatTime(timerState.timeLeft)}` : `Çalışıyor: ${formatTime(timerState.timeLeft)}`)
    : 'Pomodoro';
  
  if (tray && !tray.isDestroyed()) {
    tray.setToolTip(`Planner - ${status}`);
  }
}

function showWidget() {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.isVisible() ? widgetWindow.hide() : widgetWindow.show();
    return;
  }

  widgetWindow = new BrowserWindow({
    width: 250,
    height: 150,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    movable: true,
    show: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    const port = new URL(process.env.VITE_DEV_SERVER_URL).port;
    widgetWindow.loadURL(`http://localhost:${port}/#/widget`);
  } else {
    widgetWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/widget' });
  }

  widgetWindow.once('ready-to-show', () => {
    const trayBounds = tray.getBounds();
    const widgetBounds = widgetWindow.getBounds();
    if (process.platform === 'darwin') {
      widgetWindow.setPosition(Math.round(trayBounds.x - widgetBounds.width / 2), Math.round(trayBounds.y + trayBounds.height + 5));
    }
    widgetWindow.show();
  });

  widgetWindow.on('blur', () => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.hide();
    }
  });

  widgetWindow.on('closed', () => {
    widgetWindow = null;
  });
}

function createTray() {
  const size = 18;
  const canvas = Buffer.alloc(size * size * 4);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cx = x - size / 2;
      const cy = y - size / 2;
      const dist = Math.sqrt(cx * cx + cy * cy);
      
      if (dist < 8) {
        canvas[idx] = 255;
        canvas[idx + 1] = 255;
        canvas[idx + 2] = 255;
        canvas[idx + 3] = 255;
        
        if (Math.abs(cx) < 1 && cy > -6 && cy < 1) {
          canvas[idx] = 233;
          canvas[idx + 1] = 69;
          canvas[idx + 2] = 96;
        }
        
        if (cx > -1 && cx < 5 && Math.abs(cy) < 1) {
          canvas[idx] = 233;
          canvas[idx + 1] = 69;
          canvas[idx + 2] = 96;
        }
      } else {
        canvas[idx] = 0;
        canvas[idx + 1] = 0;
        canvas[idx + 2] = 0;
        canvas[idx + 3] = 0;
      }
    }
  }
  
  const trayIcon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  tray = new Tray(trayIcon);
  tray.setToolTip('Planner - Pomodoro');
  tray.setContextMenu(null);
  
  tray.on('click', showWidget);
  tray.on('right-click', () => {});
}

function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    log.info('Güncelleme kontrol ediliyor...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Güncelleme mevcut:', info.version);
    if (win) {
      win.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('Güncelleme yok');
  });

  autoUpdater.on('download-progress', (progress) => {
    log.info('İndirme ilerlemesi:', progress.percent);
    if (win) {
      win.webContents.send('update-progress', progress);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Güncelleme indirildi:', info.version);
    if (win) {
      win.webContents.send('update-downloaded', info);
    }
  });

  autoUpdater.on('error', (error) => {
    log.error('Güncelleme hatası:', error);
  });
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
  createTray();
  setupAutoUpdater();
  
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      log.error('Güncelleme kontrol hatası:', err);
    });
  }, 3000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (win) {
    win.show();
    win.focus();
  }
});

ipcMain.handle('db:getProjects', () => {
  return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
});

ipcMain.handle('db:createProject', (_, data) => {
  const stmt = db.prepare('INSERT INTO projects (name, description, color) VALUES (?, ?, ?)');
  const result = stmt.run(data.name, data.description || '', data.color || '#3B82F6');
  return { id: result.lastInsertRowid, ...data };
});

ipcMain.handle('db:updateProject', (_, data) => {
  const stmt = db.prepare('UPDATE projects SET name = ?, description = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(data.name, data.description || '', data.color || '#3B82F6', data.id);
  return data;
});

ipcMain.handle('db:deleteProject', (_, id) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return { success: true };
});

ipcMain.handle('db:getTodos', (_, projectId) => {
  return db.prepare('SELECT * FROM todos WHERE project_id = ? ORDER BY position ASC').all(projectId);
});

ipcMain.handle('db:createTodo', (_, data) => {
  const maxPos = db.prepare('SELECT MAX(position) as max FROM todos WHERE project_id = ?').get(data.project_id);
  const position = (maxPos?.max || 0) + 1;
  const stmt = db.prepare('INSERT INTO todos (project_id, title, description, status, priority, due_date, position) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const result = stmt.run(data.project_id, data.title, data.description || '', data.status || 'todo', data.priority ?? 1, data.due_date || null, position);
  return { id: result.lastInsertRowid, ...data, position };
});

ipcMain.handle('db:updateTodo', (_, data) => {
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(data.id);
  const stmt = db.prepare('UPDATE todos SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(data.title ?? todo.title, data.description ?? todo.description, data.status ?? todo.status, data.priority ?? todo.priority, data.due_date ?? todo.due_date, data.position ?? todo.position, data.id);
  return { ...todo, ...data };
});

ipcMain.handle('db:deleteTodo', (_, id) => {
  db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  return { success: true };
});

ipcMain.handle('db:updateTodoStatus', (_, data) => {
  const stmt = db.prepare('UPDATE todos SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(data.status, data.id);
  return { success: true };
});

ipcMain.handle('tags:getAll', (_, projectId) => {
  if (projectId) {
    return db.prepare('SELECT * FROM tags WHERE project_id IS NULL OR project_id = ?').all(projectId);
  }
  return db.prepare('SELECT * FROM tags ORDER BY name ASC').all();
});

ipcMain.handle('tags:create', (_, data) => {
  const stmt = db.prepare('INSERT INTO tags (name, color, project_id) VALUES (?, ?, ?)');
  const result = stmt.run(data.name, data.color || '#3B82F6', data.project_id || null);
  return { id: result.lastInsertRowid, ...data };
});

ipcMain.handle('tags:delete', (_, id) => {
  db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  return { success: true };
});

ipcMain.handle('tags:attach', (_, todoId, tagId) => {
  db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
  return { success: true };
});

ipcMain.handle('tags:detach', (_, todoId, tagId) => {
  db.prepare('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?').run(todoId, tagId);
  return { success: true };
});

ipcMain.handle('tags:getByTodo', (_, todoId) => {
  return db.prepare(`
    SELECT t.* FROM tags t
    INNER JOIN todo_tags tt ON t.id = tt.tag_id
    WHERE tt.todo_id = ?
    ORDER BY t.name ASC
  `).all(todoId);
});

ipcMain.handle('subtasks:getByTodo', (_, todoId) => {
  return db.prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC').all(todoId);
});

ipcMain.handle('subtasks:create', (_, data) => {
  const maxPos = db.prepare('SELECT MAX(position) as max FROM subtasks WHERE todo_id = ?').get(data.todo_id);
  const position = (maxPos?.max || 0) + 1;
  const stmt = db.prepare('INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)');
  const result = stmt.run(data.todo_id, data.title, position);
  return { id: result.lastInsertRowid, ...data, position, completed: 0 };
});

ipcMain.handle('subtasks:toggle', (_, id, completed) => {
  const stmt = db.prepare('UPDATE subtasks SET completed = ? WHERE id = ?');
  stmt.run(completed ? 1 : 0, id);
  return { success: true };
});

ipcMain.handle('subtasks:delete', (_, id) => {
  db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
  return { success: true };
});

ipcMain.handle('subtasks:reorder', (_, todoId, orderedIds) => {
  const stmt = db.prepare('UPDATE subtasks SET position = ? WHERE id = ?');
  orderedIds.forEach((id, index) => {
    stmt.run(index, id);
  });
  return { success: true };
});

ipcMain.handle('work:start', (_, projectId) => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().split(' ')[0].slice(0, 5);
  const stmt = db.prepare('INSERT INTO project_sessions (project_id, date, start_time) VALUES (?, ?, ?)');
  const result = stmt.run(projectId, today, now);
  return { id: result.lastInsertRowid, project_id: projectId, date: today, start_time: now };
});

ipcMain.handle('work:stop', () => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().split(' ')[0].slice(0, 5);
  const session = db.prepare('SELECT * FROM project_sessions WHERE date = ? AND end_time IS NULL ORDER BY id DESC').get(today);
  if (session) {
    const start = new Date(today + ' ' + session.start_time);
    const end = new Date(today + ' ' + now);
    const durationMinutes = Math.round((end - start) / 60000);
    db.prepare('UPDATE project_sessions SET end_time = ?, duration_minutes = ? WHERE id = ?').run(now, durationMinutes, session.id);
    return { ...session, end_time: now, duration_minutes: durationMinutes };
  }
  return null;
});

ipcMain.handle('work:getProjectStats', (_, projectId) => {
  const sessions = db.prepare('SELECT * FROM project_sessions WHERE project_id = ? AND end_time IS NOT NULL').all(projectId);
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  return { sessions, totalMinutes };
});

ipcMain.handle('work:getProjectToday', (_, projectId) => {
  const today = new Date().toISOString().split('T')[0];
  return db.prepare('SELECT * FROM project_sessions WHERE project_id = ? AND date = ? AND end_time IS NULL').get(projectId, today);
});

ipcMain.handle('settings:get', (_, key) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : null;
});

ipcMain.handle('settings:set', (_, key, value) => {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
  return { success: true };
});

ipcMain.handle('notification:show', (_, title, body) => {
  const { Notification } = require('electron');
  new Notification({ title, body }).show();
});

ipcMain.handle('update:check', () => {
  return autoUpdater.checkForUpdates();
});

ipcMain.handle('update:download', () => {
  return autoUpdater.downloadUpdate();
});

ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('tray:update', (_, state) => {
  timerState = state;
  updateTray();
  
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('tray:state', state);
  }
  
  if (breakOverlayWindows && breakOverlayWindows.length > 0) {
    breakOverlayWindows.forEach(w => {
      if (w && !w.isDestroyed()) {
        w.webContents.send('tray:state', state);
      }
    });
  }
});

function showBreakOverlay() {
  if (breakOverlayWindows && breakOverlayWindows.length > 0) {
    breakOverlayWindows.forEach(w => { if (w && !w.isDestroyed()) w.focus(); });
    return;
  }
  
  const displays = require('electron').screen.getAllDisplays();
  breakOverlayWindows = [];
  
  displays.forEach(display => {
    const { x, y, width, height } = display.bounds;
    
    const overlay = new BrowserWindow({
      x: x,
      y: y,
      width: width,
      height: height,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      fullscreenable: false,
      show: false,
      opacity: 0.98,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    
    if (process.env.VITE_DEV_SERVER_URL) {
      const port = new URL(process.env.VITE_DEV_SERVER_URL).port;
      overlay.loadURL(`http://localhost:${port}/#/break-overlay`);
    } else {
      overlay.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/break-overlay' });
    }
    overlay.setVisibleOnAllWorkspaces(true);
    
    overlay.once('ready-to-show', () => {
      overlay.show();
      overlay.focus();
    });
    
    overlay.on('blur', () => {
      if (overlay && !overlay.isDestroyed()) {
        overlay.focus();
      }
    });
    
    overlay.on('closed', () => {
      breakOverlayWindows = breakOverlayWindows.filter(w => w !== overlay);
    });
    
    breakOverlayWindows.push(overlay);
  });
}

function hideBreakOverlay() {
  if (breakOverlayWindows && breakOverlayWindows.length > 0) {
    breakOverlayWindows.forEach(w => {
      if (w && !w.isDestroyed()) {
        w.hide();
        w.destroy();
      }
    });
    breakOverlayWindows = [];
  }
}

ipcMain.handle('break:show', showBreakOverlay);
ipcMain.handle('break:hide', hideBreakOverlay);
ipcMain.handle('break:snooze', (_, minutes) => {
  if (timerState.isBreak && timerState.timeLeft) {
    timerState.timeLeft += minutes * 60;
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send('tray:state', timerState);
    }
    if (breakOverlayWindows && breakOverlayWindows.length > 0) {
      breakOverlayWindows.forEach(w => {
        if (w && !w.isDestroyed()) {
          w.webContents.send('tray:state', timerState);
  }
});

ipcMain.handle('backup:export', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showSaveDialog(win, {
      title: 'Yedek Kaydet',
      defaultPath: `planner-backup-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }
    
    const projects = db.prepare('SELECT * FROM projects').all();
    const todos = db.prepare('SELECT * FROM todos').all();
    const tags = db.prepare('SELECT * FROM tags').all();
    const todoTags = db.prepare('SELECT * FROM todo_tags').all();
    const subtasks = db.prepare('SELECT * FROM subtasks').all();
    const projectSessions = db.prepare('SELECT * FROM project_sessions').all();
    const settings = db.prepare('SELECT * FROM settings').all();
    
    const backup = {
      version: '1.0.0',
      date: new Date().toISOString(),
      data: {
        projects,
        todos,
        tags,
        todoTags,
        subtasks,
        projectSessions,
        settings,
      }
    };
    
    const fs = require('fs');
    fs.writeFileSync(result.filePath, JSON.stringify(backup, null, 2));
    
    return { success: true, path: result.filePath };
  } catch (err) {
    log.error('Backup error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:import', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(win, {
      title: 'Yedek Yükle',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });
    
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    
    const fs = require('fs');
    const backup = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
    
    if (!backup.data) {
      return { success: false, error: 'Geçersiz yedek dosyası' };
    }
    
    db.exec('DELETE FROM todo_tags');
    db.exec('DELETE FROM subtasks');
    db.exec('DELETE FROM todos');
    db.exec('DELETE FROM tags');
    db.exec('DELETE FROM project_sessions');
    db.exec('DELETE FROM projects');
    
    if (backup.data.projects) {
      const stmt = db.prepare('INSERT INTO projects (id, name, description, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
      backup.data.projects.forEach(p => stmt.run(p.id, p.name, p.description, p.color, p.created_at, p.updated_at));
    }
    
    if (backup.data.tags) {
      const stmt = db.prepare('INSERT INTO tags (id, name, color, project_id) VALUES (?, ?, ?, ?)');
      backup.data.tags.forEach(t => stmt.run(t.id, t.name, t.color, t.project_id));
    }
    
    if (backup.data.todos) {
      const stmt = db.prepare('INSERT INTO todos (id, project_id, title, description, status, priority, due_date, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      backup.data.todos.forEach(t => stmt.run(t.id, t.project_id, t.title, t.description, t.status, t.priority, t.due_date, t.position, t.created_at, t.updated_at));
    }
    
    if (backup.data.todoTags) {
      const stmt = db.prepare('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');
      backup.data.todoTags.forEach(t => stmt.run(t.todo_id, t.tag_id));
    }
    
    if (backup.data.subtasks) {
      const stmt = db.prepare('INSERT INTO subtasks (id, todo_id, title, completed, position) VALUES (?, ?, ?, ?, ?)');
      backup.data.subtasks.forEach(s => stmt.run(s.id, s.todo_id, s.title, s.completed, s.position));
    }
    
    if (backup.data.projectSessions) {
      const stmt = db.prepare('INSERT INTO project_sessions (id, project_id, date, start_time, end_time, duration_minutes) VALUES (?, ?, ?, ?, ?, ?)');
      backup.data.projectSessions.forEach(s => stmt.run(s.id, s.project_id, s.date, s.start_time, s.end_time, s.duration_minutes));
    }
    
    if (backup.data.settings) {
      const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
      backup.data.settings.forEach(s => stmt.run(s.key, s.value));
    }
    
    return { success: true };
  } catch (err) {
    log.error('Restore error:', err);
    return { success: false, error: err.message };
  }
});
    }
  }
});
ipcMain.handle('break:skip', () => {
  hideBreakOverlay();
  timerState.isBreak = false;
  timerState.timeLeft = 0;
  updateTray();
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('tray:state', timerState);
  }
});
