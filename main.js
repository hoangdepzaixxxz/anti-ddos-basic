/**
 * ==============================================================================
 * GAME PORT SHIELD & MANAGEMENT TOOL (DESKTOP APP)
 * ==============================================================================
 * Phiên bản Desktop Utility tối giản, hiệu năng cao:
 * - Cài đặt tùy chỉnh Cổng công khai, IP & Cổng Game Server thật.
 * - Tự động nhận diện OS (Windows netsh / Linux iptables).
 * - Chống Spam & Auto-Ban: Tùy biến ngưỡng kết nối và thời gian khóa.
 * - Quản lý Git: Kéo mã nguồn (Git Pull) & Đẩy mã nguồn (Git Push).
 * ==============================================================================
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const { exec } = require('child_process');

// -----------------------------------------------------------------------------
// 1. CẤU HÌNH & TẢI TỪ FILE
// -----------------------------------------------------------------------------
const CONFIG_FILE = path.join(__dirname, 'config.json');

const DEFAULT_CONFIG = {
  publicPort: 14445,
  realHost: '127.0.0.1',
  realPort: 34567,
  rateLimitWindowSec: 30,
  rateLimitMaxReq: 10,
  banDurationMin: 5,
  githubRemote: ''
};

let CONFIG = { ...DEFAULT_CONFIG };

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      CONFIG = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } else {
      saveConfig(DEFAULT_CONFIG);
    }
  } catch (err) {
    console.error('Lỗi khi đọc config.json:', err.message);
  }
}

function saveConfig(newConfig) {
  try {
    CONFIG = { ...CONFIG, ...newConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(CONFIG, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Lỗi khi ghi config.json:', err.message);
    return false;
  }
}

loadConfig();

const SYSTEM_OS = os.platform(); // 'win32' hoặc 'linux'
const startTime = Date.now();

// -----------------------------------------------------------------------------
// 2. BỘ NHỚ LƯU TRỮ TRẠNG THÁI
// -----------------------------------------------------------------------------
const ipRecords = new Map();
const activityLogs = [];
let totalProxyConnections = 0;
let activeConnectionsCount = 0;
let proxyServerInstance = null;
let isProxyRunning = false;
let mainWindow = null;

function addLog(type, message) {
  const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
  const entry = { id: Date.now() + Math.random(), time: timeStr, type, message };
  activityLogs.unshift(entry);
  if (activityLogs.length > 150) activityLogs.pop();
  console.log(`[${entry.time}] [${type}] ${message}`);
  broadcastStats();
}

function broadcastStats() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stats-update', getDashboardData());
  }
}

function getDashboardData() {
  const now = Date.now();
  const list = [];
  let bannedCount = 0;

  for (const [ip, rec] of ipRecords.entries()) {
    if (rec.status !== 'ACTIVE') bannedCount += 1;

    const windowMs = (CONFIG.rateLimitWindowSec || 30) * 1000;
    const recentCount = rec.timestamps.filter((ts) => now - ts < windowMs).length;

    let remainingBanSeconds = 0;
    if (rec.banExpiresAt && rec.banExpiresAt > now) {
      remainingBanSeconds = Math.ceil((rec.banExpiresAt - now) / 1000);
    }

    list.push({
      ip: rec.ip,
      totalConnections: rec.totalConnections,
      recentConnections: recentCount,
      status: rec.status,
      lastSeen: rec.lastSeen,
      remainingBanSeconds
    });
  }

  list.sort((a, b) => {
    if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return -1;
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return 1;
    return b.lastSeen - a.lastSeen;
  });

  return {
    os: SYSTEM_OS,
    isProxyRunning,
    uptimeSeconds: Math.floor((now - startTime) / 1000),
    config: CONFIG,
    activeConnections: activeConnectionsCount,
    totalConnections: totalProxyConnections,
    bannedCount,
    ips: list,
    logs: activityLogs.slice(0, 50)
  };
}

// -----------------------------------------------------------------------------
// 3. TƯỜNG LỬA HỆ THỐNG THEO HỆ ĐIỀU HÀNH
// -----------------------------------------------------------------------------
function isValidIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  const ipv6Regex = /^[0-9a-fA-F:]+$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

function normalizeIp(rawIp) {
  if (!rawIp) return '127.0.0.1';
  if (rawIp.startsWith('::ffff:')) {
    return rawIp.substring(7);
  }
  return rawIp;
}

function runShell(command) {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      resolve({
        success: !error,
        error: error ? error.message : null,
        stdout: stdout ? stdout.trim() : '',
        stderr: stderr ? stderr.trim() : ''
      });
    });
  });
}

async function applyOsFirewallBlock(ip) {
  if (!isValidIp(ip)) {
    addLog('ERROR', `IP không hợp lệ: ${ip}`);
    return false;
  }

  if (SYSTEM_OS === 'win32') {
    const ruleName = `Shield_Block_${ip}`;
    await runShell(`netsh advfirewall firewall delete rule name="${ruleName}"`);
    const cmd = `netsh advfirewall firewall add rule name="${ruleName}" dir=in action=block remoteip=${ip}`;
    const res = await runShell(cmd);
    if (res.success) {
      addLog('FIREWALL', `[Windows netsh] Đã chặn IP: ${ip}`);
      return true;
    } else {
      addLog('WARN', `[Windows netsh] Cần chạy Administrator! ${res.stderr || res.error}`);
      return false;
    }
  } else if (SYSTEM_OS === 'linux') {
    const cmd = `sudo iptables -I INPUT -s ${ip} -j DROP`;
    const res = await runShell(cmd);
    if (res.success) {
      addLog('FIREWALL', `[Linux iptables] Đã DROP IP: ${ip}`);
      return true;
    } else {
      addLog('WARN', `[Linux iptables] Cần quyền sudo! ${res.stderr || res.error}`);
      return false;
    }
  } else {
    addLog('WARN', `Hệ điều hành [${SYSTEM_OS}] không hỗ trợ tường lửa tự động.`);
    return false;
  }
}

async function removeOsFirewallBlock(ip) {
  if (!isValidIp(ip)) return false;

  if (SYSTEM_OS === 'win32') {
    const ruleName = `Shield_Block_${ip}`;
    await runShell(`netsh advfirewall firewall delete rule name="${ruleName}"`);
    addLog('FIREWALL', `[Windows netsh] Đã gỡ chặn IP: ${ip}`);
    return true;
  } else if (SYSTEM_OS === 'linux') {
    await runShell(`sudo iptables -D INPUT -s ${ip} -j DROP`);
    addLog('FIREWALL', `[Linux iptables] Đã gỡ DROP IP: ${ip}`);
    return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
// 4. QUẢN LÝ CHẶN / MỞ KHÓA VÀ RATE LIMITING
// -----------------------------------------------------------------------------
function getOrCreateRecord(ip) {
  let record = ipRecords.get(ip);
  if (!record) {
    record = {
      ip,
      totalConnections: 0,
      timestamps: [],
      status: 'ACTIVE',
      lastSeen: Date.now(),
      banExpiresAt: null,
      banTimer: null
    };
    ipRecords.set(ip, record);
  }
  return record;
}

async function blockIp(ip, reason = 'MANUAL') {
  const record = getOrCreateRecord(ip);
  if (record.banTimer) {
    clearTimeout(record.banTimer);
    record.banTimer = null;
  }

  const banMs = (CONFIG.banDurationMin || 5) * 60 * 1000;

  if (reason === 'SPAMMER') {
    record.status = 'SPAMMER';
    record.banExpiresAt = Date.now() + banMs;
    addLog('ALERT', `[AUTO-BAN] Phát hiện IP ${ip} spam vượt ngưỡng. Khóa ${CONFIG.banDurationMin} phút.`);

    record.banTimer = setTimeout(async () => {
      await unblockIp(ip, true);
    }, banMs);
  } else {
    record.status = 'MANUAL_BLOCKED';
    record.banExpiresAt = null;
    addLog('ADMIN', `Đã chặn thủ công IP: ${ip}`);
  }

  await applyOsFirewallBlock(ip);
  broadcastStats();
}

async function unblockIp(ip, isAuto = false) {
  const record = ipRecords.get(ip);
  if (!record) return;

  if (record.banTimer) {
    clearTimeout(record.banTimer);
    record.banTimer = null;
  }

  record.status = 'ACTIVE';
  record.banExpiresAt = null;
  record.timestamps = [];

  if (isAuto) {
    addLog('INFO', `[AUTO-UNBAN] Hết hạn khóa, tự động mở khóa IP: ${ip}`);
  } else {
    addLog('ADMIN', `Mở khóa thủ công cho IP: ${ip}`);
  }

  await removeOsFirewallBlock(ip);
  broadcastStats();
}

// -----------------------------------------------------------------------------
// 5. MÁY CHỦ TCP PROXY (HỖ TRỢ THAY ĐỔI CỔNG & IP NỘI BỘ TRỰC TIẾP)
// -----------------------------------------------------------------------------
function startTcpProxy() {
  if (proxyServerInstance) {
    try {
      proxyServerInstance.close();
    } catch (e) {}
    proxyServerInstance = null;
  }

  proxyServerInstance = net.createServer((clientSocket) => {
    const now = Date.now();
    const rawIp = clientSocket.remoteAddress;
    const ip = normalizeIp(rawIp);

    const record = getOrCreateRecord(ip);
    record.totalConnections += 1;
    record.lastSeen = now;
    totalProxyConnections += 1;

    // Kiểm tra danh sách chặn
    if (record.status === 'SPAMMER' || record.status === 'MANUAL_BLOCKED') {
      addLog('DROP', `Từ chối IP đang bị khóa [${record.status}]: ${ip}`);
      clientSocket.destroy();
      return;
    }

    // Rate Limiting theo cấu hình
    const windowMs = (CONFIG.rateLimitWindowSec || 30) * 1000;
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
    record.timestamps.push(now);

    const maxReq = CONFIG.rateLimitMaxReq || 10;
    if (record.timestamps.length > maxReq) {
      blockIp(ip, 'SPAMMER');
      clientSocket.destroy();
      return;
    }

    activeConnectionsCount += 1;
    broadcastStats();

    // Chuyển tiếp tới Game Server đích (theo cấu hình cài đặt)
    const gameSocket = net.connect(
      { port: CONFIG.realPort, host: CONFIG.realHost },
      () => {
        clientSocket.pipe(gameSocket);
        gameSocket.pipe(clientSocket);
      }
    );

    gameSocket.on('error', (err) => {
      addLog('PROXY_ERR', `Lỗi forward đến ${CONFIG.realHost}:${CONFIG.realPort} - ${err.message}`);
      clientSocket.destroy();
    });

    clientSocket.on('error', () => {
      gameSocket.destroy();
    });

    const cleanup = () => {
      activeConnectionsCount = Math.max(0, activeConnectionsCount - 1);
      broadcastStats();
    };

    clientSocket.on('close', cleanup);
    gameSocket.on('close', cleanup);
  });

  proxyServerInstance.listen(CONFIG.publicPort, '0.0.0.0', () => {
    isProxyRunning = true;
    console.log(`[PROXY] Đang chạy tại 0.0.0.0:${CONFIG.publicPort} -> ${CONFIG.realHost}:${CONFIG.realPort}`);
    addLog('SYSTEM', `Proxy khởi động: Cổng ${CONFIG.publicPort} -> ${CONFIG.realHost}:${CONFIG.realPort}`);
    broadcastStats();
  });

  proxyServerInstance.on('error', (err) => {
    isProxyRunning = false;
    addLog('ERROR', `Lỗi máy chủ Proxy trên cổng ${CONFIG.publicPort}: ${err.message}`);
    broadcastStats();
  });
}

// -----------------------------------------------------------------------------
// 6. CỬA SỔ DESKTOP ELECTRON
// -----------------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1060,
    height: 720,
    minWidth: 920,
    minHeight: 600,
    backgroundColor: '#13141b',
    autoHideMenuBar: true,
    title: 'Game Port Shield',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setInterval(broadcastStats, 1000);
}

// -----------------------------------------------------------------------------
// 7. IPC HANDLERS
// -----------------------------------------------------------------------------
ipcMain.handle('get-stats', async () => getDashboardData());

ipcMain.handle('get-config', async () => CONFIG);

ipcMain.handle('save-config', async (event, newConfig) => {
  const pPort = parseInt(newConfig.publicPort, 10);
  const rPort = parseInt(newConfig.realPort, 10);
  const rHost = (newConfig.realHost || '').trim();

  if (!pPort || pPort < 1 || pPort > 65535) {
    return { success: false, message: 'Cổng công khai không hợp lệ (1 - 65535)' };
  }
  if (!rPort || rPort < 1 || rPort > 65535) {
    return { success: false, message: 'Cổng Game Server không hợp lệ (1 - 65535)' };
  }
  if (!rHost) {
    return { success: false, message: 'IP Game Server không được để trống' };
  }

  saveConfig({
    publicPort: pPort,
    realHost: rHost,
    realPort: rPort,
    rateLimitWindowSec: parseInt(newConfig.rateLimitWindowSec, 10) || 30,
    rateLimitMaxReq: parseInt(newConfig.rateLimitMaxReq, 10) || 10,
    banDurationMin: parseInt(newConfig.banDurationMin, 10) || 5,
    githubRemote: (newConfig.githubRemote || '').trim()
  });

  addLog('CONFIG', `Đã lưu cấu hình mới: :${CONFIG.publicPort} -> ${CONFIG.realHost}:${CONFIG.realPort}`);

  // Khởi động lại Proxy với cổng mới
  startTcpProxy();

  return { success: true, message: 'Đã lưu cấu hình và áp dụng cổng mới thành công!' };
});

ipcMain.handle('restart-proxy', async () => {
  addLog('SYSTEM', 'Đang khởi động lại Proxy TCP...');
  startTcpProxy();
  return { success: true, message: 'Đã khởi động lại Proxy' };
});

ipcMain.handle('ban-ip', async (e, ip) => {
  if (!isValidIp(ip)) return { success: false, message: 'IP không hợp lệ' };
  await blockIp(ip, 'MANUAL');
  return { success: true, message: `Đã chặn IP ${ip}` };
});

ipcMain.handle('unban-ip', async (e, ip) => {
  if (!isValidIp(ip)) return { success: false, message: 'IP không hợp lệ' };
  await unblockIp(ip, false);
  return { success: true, message: `Đã mở khóa IP ${ip}` };
});

// Git Pull (Cập nhật)
ipcMain.handle('git-pull', async () => {
  addLog('UPDATE', 'Đang thực thi git pull từ GitHub...');
  const res = await runShell('git pull');
  if (res.success) {
    addLog('UPDATE', `Git Pull thành công:\n${res.stdout}`);
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 1500);
    return { success: true, message: 'Cập nhật thành công! Đang tự khởi động lại App...' };
  } else {
    addLog('ERROR', `Git Pull thất bại: ${res.stderr || res.error}`);
    return { success: false, message: 'Lỗi git pull: ' + (res.stderr || res.error) };
  }
});

// Git Push (Đẩy lên GitHub)
ipcMain.handle('git-push', async (e, commitMsg) => {
  addLog('GIT', 'Đang chuẩn bị đẩy mã nguồn lên GitHub...');

  // 1. Kiểm tra cấu hình remote URL
  if (CONFIG.githubRemote) {
    await runShell(`git remote remove origin`);
    await runShell(`git remote add origin ${CONFIG.githubRemote}`);
  }

  // 2. Git add
  await runShell('git add .');

  // 3. Git commit
  const msg = commitMsg || `Update Game Port Shield - ${new Date().toISOString()}`;
  const commitRes = await runShell(`git commit -m "${msg}"`);

  // 4. Git push
  const pushRes = await runShell('git push -u origin HEAD');
  if (pushRes.success) {
    addLog('GIT', `Đẩy lên GitHub thành công!\n${pushRes.stdout}`);
    return { success: true, message: 'Đã đẩy mã nguồn lên GitHub thành công!', output: pushRes.stdout };
  } else {
    addLog('WARN', `Git Push: ${pushRes.stderr || pushRes.error}`);
    return {
      success: false,
      message: 'Không thể đẩy lên GitHub. Vui lòng kiểm tra lại GitHub Remote URL trong tab Cài Đặt hoặc quyền truy cập.',
      details: pushRes.stderr || pushRes.error
    };
  }
});

// -----------------------------------------------------------------------------
// 8. KHỞI CHẠY APP
// -----------------------------------------------------------------------------
app.whenReady().then(() => {
  startTcpProxy();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
