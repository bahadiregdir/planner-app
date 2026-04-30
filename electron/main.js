const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const log = require('electron-log');
const { createClient } = require('@supabase/supabase-js');
const { autoUpdater } = require('electron-updater');
const { SUPABASE_URL, SUPABASE_ANON_KEY } = require('./config');

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

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let win;
let tray;
let widgetWindow = null;
let breakOverlayWindows = [];
let timerState = { isWorking: false, isBreak: false, timeLeft: 0, isPaused: false };
let windowBoundsTimeout = null;

// Debounced window bounds saver (avoid hammering Supabase on every resize/move)
function saveWindowBoundsDebounced(bounds) {
  if (windowBoundsTimeout) clearTimeout(windowBoundsTimeout);
  windowBoundsTimeout = setTimeout(async () => {
    try {
      await supabase.from('settings').upsert({ key: 'windowBounds', value: JSON.stringify(bounds) });
    } catch (e) {
      log.error('Window bounds save error:', e);
    }
  }, 1000);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
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
      saveWindowBoundsDebounced(win.getBounds());
    }
  });

  win.on('move', () => {
    if (win && !win.isDestroyed()) {
      saveWindowBoundsDebounced(win.getBounds());
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
        canvas[idx] = 255; canvas[idx + 1] = 255; canvas[idx + 2] = 255; canvas[idx + 3] = 255;
        if (Math.abs(cx) < 1 && cy > -6 && cy < 1) {
          canvas[idx] = 233; canvas[idx + 1] = 69; canvas[idx + 2] = 96;
        }
        if (cx > -1 && cx < 5 && Math.abs(cy) < 1) {
          canvas[idx] = 233; canvas[idx + 1] = 69; canvas[idx + 2] = 96;
        }
      } else {
        canvas[idx] = 0; canvas[idx + 1] = 0; canvas[idx + 2] = 0; canvas[idx + 3] = 0;
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
  autoUpdater.on('checking-for-update', () => { log.info('Güncelleme kontrol ediliyor...'); });

  autoUpdater.on('update-available', (info) => {
    log.info('Güncelleme mevcut:', info.version);
    if (win) win.webContents.send('update-available', info);
  });

  autoUpdater.on('update-not-available', () => { log.info('Güncelleme yok'); });

  autoUpdater.on('download-progress', (progress) => {
    log.info('İndirme ilerlemesi:', progress.percent);
    if (win) win.webContents.send('update-progress', progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Güncelleme indirildi:', info.version);
    if (win) win.webContents.send('update-downloaded', info);
  });

  autoUpdater.on('error', (error) => { log.error('Güncelleme hatası:', error); });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  setupAutoUpdater();
  log.info('Uygulama hazır, Supabase kullanılıyor:', SUPABASE_URL);

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      log.error('Güncelleme kontrol hatası:', err);
    });
  }, 3000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (win) { win.show(); win.focus(); }
});

// ─── Projects ─────────────────────────────────────────────────────────────────

ipcMain.handle('db:getProjects', async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
});

ipcMain.handle('db:createProject', async (_, data) => {
  const { data: row, error } = await supabase
    .from('projects')
    .insert({ name: data.name, description: data.description || '', color: data.color || '#3B82F6' })
    .select()
    .single();
  if (error) throw error;
  return row;
});

ipcMain.handle('db:updateProject', async (_, data) => {
  const { data: row, error } = await supabase
    .from('projects')
    .update({ name: data.name, description: data.description || '', color: data.color || '#3B82F6', updated_at: new Date().toISOString() })
    .eq('id', data.id)
    .select()
    .single();
  if (error) throw error;
  return row;
});

ipcMain.handle('db:deleteProject', async (_, id) => {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
});

// ─── Todos ────────────────────────────────────────────────────────────────────

ipcMain.handle('db:getTodos', async (_, projectId) => {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data;
});

ipcMain.handle('db:createTodo', async (_, data) => {
  // Get max position
  const { data: posData } = await supabase
    .from('todos')
    .select('position')
    .eq('project_id', data.project_id)
    .order('position', { ascending: false })
    .limit(1)
    .single();
  const position = posData ? (posData.position || 0) + 1 : 1;

  const { data: row, error } = await supabase
    .from('todos')
    .insert({
      project_id: data.project_id,
      title: data.title,
      description: data.description || '',
      status: data.status || 'todo',
      priority: data.priority ?? 1,
      due_date: data.due_date || null,
      position,
    })
    .select()
    .single();
  if (error) throw error;
  return row;
});

ipcMain.handle('db:updateTodo', async (_, data) => {
  // Get current values for merge
  const { data: current } = await supabase.from('todos').select('*').eq('id', data.id).single();
  const updates = {
    title: data.title ?? current.title,
    description: data.description ?? current.description,
    status: data.status ?? current.status,
    priority: data.priority ?? current.priority,
    due_date: data.due_date !== undefined ? data.due_date : current.due_date,
    position: data.position ?? current.position,
    updated_at: new Date().toISOString(),
  };
  const { data: row, error } = await supabase
    .from('todos')
    .update(updates)
    .eq('id', data.id)
    .select()
    .single();
  if (error) throw error;
  return row;
});

ipcMain.handle('db:deleteTodo', async (_, id) => {
  const { error } = await supabase.from('todos').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
});

ipcMain.handle('db:updateTodoStatus', async (_, data) => {
  const { error } = await supabase
    .from('todos')
    .update({ status: data.status, updated_at: new Date().toISOString() })
    .eq('id', data.id);
  if (error) throw error;
  return { success: true };
});

// ─── Tags ─────────────────────────────────────────────────────────────────────

ipcMain.handle('tags:getAll', async (_, projectId) => {
  let query = supabase.from('tags').select('*').order('name', { ascending: true });
  if (projectId) {
    query = query.or(`project_id.is.null,project_id.eq.${projectId}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
});

ipcMain.handle('tags:create', async (_, data) => {
  const { data: row, error } = await supabase
    .from('tags')
    .insert({ name: data.name, color: data.color || '#3B82F6', project_id: data.project_id || null })
    .select()
    .single();
  if (error) throw error;
  return row;
});

ipcMain.handle('tags:delete', async (_, id) => {
  const { error } = await supabase.from('tags').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
});

ipcMain.handle('tags:attach', async (_, todoId, tagId) => {
  const { error } = await supabase
    .from('todo_tags')
    .upsert({ todo_id: todoId, tag_id: tagId }, { onConflict: 'todo_id,tag_id', ignoreDuplicates: true });
  if (error) throw error;
  return { success: true };
});

ipcMain.handle('tags:detach', async (_, todoId, tagId) => {
  const { error } = await supabase
    .from('todo_tags')
    .delete()
    .eq('todo_id', todoId)
    .eq('tag_id', tagId);
  if (error) throw error;
  return { success: true };
});

ipcMain.handle('tags:getByTodo', async (_, todoId) => {
  const { data: links, error: linkError } = await supabase
    .from('todo_tags')
    .select('tag_id')
    .eq('todo_id', todoId);
  if (linkError) throw linkError;
  if (!links || links.length === 0) return [];

  const tagIds = links.map(l => l.tag_id);
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .in('id', tagIds)
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
});

// ─── Subtasks ─────────────────────────────────────────────────────────────────

ipcMain.handle('subtasks:getByTodo', async (_, todoId) => {
  const { data, error } = await supabase
    .from('subtasks')
    .select('*')
    .eq('todo_id', todoId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data;
});

ipcMain.handle('subtasks:create', async (_, data) => {
  const { data: posData } = await supabase
    .from('subtasks')
    .select('position')
    .eq('todo_id', data.todo_id)
    .order('position', { ascending: false })
    .limit(1)
    .single();
  const position = posData ? (posData.position || 0) + 1 : 1;

  const { data: row, error } = await supabase
    .from('subtasks')
    .insert({ todo_id: data.todo_id, title: data.title, completed: 0, position })
    .select()
    .single();
  if (error) throw error;
  return row;
});

ipcMain.handle('subtasks:toggle', async (_, id, completed) => {
  const { error } = await supabase
    .from('subtasks')
    .update({ completed: completed ? 1 : 0 })
    .eq('id', id);
  if (error) throw error;
  return { success: true };
});

ipcMain.handle('subtasks:delete', async (_, id) => {
  const { error } = await supabase.from('subtasks').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
});

ipcMain.handle('subtasks:reorder', async (_, todoId, orderedIds) => {
  const updates = orderedIds.map((id, index) =>
    supabase.from('subtasks').update({ position: index }).eq('id', id)
  );
  await Promise.all(updates);
  return { success: true };
});

// ─── Work Sessions ────────────────────────────────────────────────────────────

ipcMain.handle('work:start', async (_, projectId) => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().split(' ')[0].slice(0, 5);
  const { data, error } = await supabase
    .from('project_sessions')
    .insert({ project_id: projectId, date: today, start_time: now })
    .select()
    .single();
  if (error) throw error;
  return data;
});

ipcMain.handle('work:stop', async () => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().split(' ')[0].slice(0, 5);
  const { data: session } = await supabase
    .from('project_sessions')
    .select('*')
    .eq('date', today)
    .is('end_time', null)
    .order('id', { ascending: false })
    .limit(1)
    .single();

  if (session) {
    const start = new Date(`${today}T${session.start_time}`);
    const end = new Date(`${today}T${now}`);
    const durationMinutes = Math.round((end - start) / 60000);
    const { data: updated, error } = await supabase
      .from('project_sessions')
      .update({ end_time: now, duration_minutes: durationMinutes })
      .eq('id', session.id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  }
  return null;
});

ipcMain.handle('work:getProjectToday', async (_, projectId) => {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('project_sessions')
    .select('*')
    .eq('project_id', projectId)
    .eq('date', today)
    .is('end_time', null)
    .order('id', { ascending: false })
    .limit(1)
    .single();
  return data || null;
});

ipcMain.handle('work:getProjectStats', async (_, projectId) => {
  const { data: sessions, error } = await supabase
    .from('project_sessions')
    .select('*')
    .eq('project_id', projectId)
    .not('end_time', 'is', null);
  if (error) throw error;
  const totalMinutes = (sessions || []).reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  return { sessions: sessions || [], totalMinutes };
});

ipcMain.handle('work:getToday', async () => {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('project_sessions')
    .select('*')
    .eq('date', today);
  if (error) throw error;
  return data || [];
});

ipcMain.handle('work:getReport', async () => {
  const { data: sessions, error } = await supabase
    .from('project_sessions')
    .select('*')
    .not('end_time', 'is', null)
    .order('date', { ascending: true });
  if (error) throw error;
  const allSessions = sessions || [];
  const totalWork = allSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  return { sessions: allSessions, totalWork, totalBreak: 0 };
});

// ─── Settings ─────────────────────────────────────────────────────────────────

ipcMain.handle('settings:get', async (_, key) => {
  const { data } = await supabase.from('settings').select('value').eq('key', key).single();
  return data ? JSON.parse(data.value) : null;
});

ipcMain.handle('settings:set', async (_, key, value) => {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });
  if (error) throw error;
  return { success: true };
});

// ─── Notifications & Tray ─────────────────────────────────────────────────────

ipcMain.handle('notification:show', (_, title, body) => {
  const { Notification } = require('electron');
  new Notification({ title, body }).show();
});

ipcMain.handle('tray:update', (_, state) => {
  timerState = state;
  updateTray();

  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('tray:state', state);
  }

  if (breakOverlayWindows && breakOverlayWindows.length > 0) {
    breakOverlayWindows.forEach(w => {
      if (w && !w.isDestroyed()) w.webContents.send('tray:state', state);
    });
  }
});

// ─── Break Overlay ────────────────────────────────────────────────────────────

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
      x, y, width, height,
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
    overlay.once('ready-to-show', () => { overlay.show(); overlay.focus(); });
    overlay.on('blur', () => { if (overlay && !overlay.isDestroyed()) overlay.focus(); });
    overlay.on('closed', () => { breakOverlayWindows = breakOverlayWindows.filter(w => w !== overlay); });
    breakOverlayWindows.push(overlay);
  });
}

function hideBreakOverlay() {
  if (breakOverlayWindows && breakOverlayWindows.length > 0) {
    breakOverlayWindows.forEach(w => { if (w && !w.isDestroyed()) { w.hide(); w.destroy(); } });
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
        if (w && !w.isDestroyed()) w.webContents.send('tray:state', timerState);
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

// ─── Auto Updater ─────────────────────────────────────────────────────────────

ipcMain.handle('update:check', () => {
  try {
    return autoUpdater.checkForUpdates().catch(err => {
      log.error('Update check error:', err);
      return { error: err.message };
    });
  } catch (err) {
    log.error('Update check exception:', err);
    return { error: err.message };
  }
});

ipcMain.handle('update:download', () => autoUpdater.downloadUpdate());
ipcMain.handle('update:install', () => autoUpdater.quitAndInstall());

// ─── Backup ───────────────────────────────────────────────────────────────────

ipcMain.handle('backup:export', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showSaveDialog(win, {
      title: 'Yedek Kaydet',
      defaultPath: `planner-backup-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePath) return { success: false, canceled: true };

    const [
      { data: projects },
      { data: todos },
      { data: tags },
      { data: todoTags },
      { data: subtasks },
      { data: projectSessions },
      { data: settings },
    ] = await Promise.all([
      supabase.from('projects').select('*'),
      supabase.from('todos').select('*'),
      supabase.from('tags').select('*'),
      supabase.from('todo_tags').select('*'),
      supabase.from('subtasks').select('*'),
      supabase.from('project_sessions').select('*'),
      supabase.from('settings').select('*'),
    ]);

    const backup = {
      version: '2.0.0',
      date: new Date().toISOString(),
      data: { projects, todos, tags, todoTags, subtasks, projectSessions, settings }
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

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) return { success: false, canceled: true };

    const fs = require('fs');
    const backup = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
    if (!backup.data) return { success: false, error: 'Geçersiz yedek dosyası' };

    // Clear all data
    await supabase.from('todo_tags').delete().neq('todo_id', 0);
    await supabase.from('subtasks').delete().neq('id', 0);
    await supabase.from('todos').delete().neq('id', 0);
    await supabase.from('tags').delete().neq('id', 0);
    await supabase.from('project_sessions').delete().neq('id', 0);
    await supabase.from('projects').delete().neq('id', 0);
    await supabase.from('settings').delete().neq('key', '');

    // Restore data
    if (backup.data.projects?.length) await supabase.from('projects').insert(backup.data.projects);
    if (backup.data.tags?.length) await supabase.from('tags').insert(backup.data.tags);
    if (backup.data.todos?.length) await supabase.from('todos').insert(backup.data.todos);
    if (backup.data.todoTags?.length) await supabase.from('todo_tags').insert(backup.data.todoTags);
    if (backup.data.subtasks?.length) await supabase.from('subtasks').insert(backup.data.subtasks);
    if (backup.data.projectSessions?.length) await supabase.from('project_sessions').insert(backup.data.projectSessions);
    if (backup.data.settings?.length) await supabase.from('settings').insert(backup.data.settings);

    return { success: true };
  } catch (err) {
    log.error('Restore error:', err);
    return { success: false, error: err.message };
  }
});
