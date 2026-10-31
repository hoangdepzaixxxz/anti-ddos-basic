/**
 * ==============================================================================
 * GAME PORT SHIELD & MANAGEMENT TOOL
 * ==============================================================================
 * Proxy TCP bảo vệ game server đa nền tảng (Windows / Linux), tích hợp:
 * - Chuyển tiếp cổng TCP: 14445 (Public) -> 34567 (Game Server ngầm)
 * - Tự động nhận diện OS và điều khiển tường lửa (netsh advfirewall / iptables)
 * - Chống Spam & Auto-Ban: Quá 10 kết nối / 30s -> Tự động khóa IP trong 5 phút
 * - Web Dashboard Quản trị cổng 3000 (Giao diện Dark Theme hiện đại, Real-time)
 * - Tự động cập nhật từ GitHub (git pull & restart)
 * ==============================================================================
 */

const net = require('net');
const os = require('os');
const { exec } = require('child_process');
const express = require('express');
const path = require('path');

// -----------------------------------------------------------------------------
// 1. CẤU HÌNH HỆ THỐNG
// -----------------------------------------------------------------------------
const CONFIG = {
  PUBLIC_PORT: 14445,              // Cổng giả đón người chơi
  REAL_PORT: 34567,                // Cổng thật game server nội bộ
  REAL_HOST: '127.0.0.1',          // Host nội bộ
  WEB_PORT: 3000,                  // Cổng Web Quản trị
  RATE_LIMIT_WINDOW_MS: 30 * 1000, // Cửa sổ trượt 30 giây
  RATE_LIMIT_MAX_REQ: 10,          // Tối đa 10 kết nối / 30s
  AUTO_BAN_DURATION_MS: 5 * 60 * 1000 // Tự động mở khóa sau 5 phút (300.000 ms)
};

const SYSTEM_OS = os.platform(); // 'win32' hoặc 'linux'
const startTime = Date.now();

// -----------------------------------------------------------------------------
// 2. BỘ NHỚ LƯU TRỮ TRẠNG THÁI (IN-MEMORY STATE)
// -----------------------------------------------------------------------------
// Map lưu thông tin từng IP:
// ip -> {
//   ip: string,
//   totalConnections: number,
//   timestamps: number[],
//   status: 'ACTIVE' | 'SPAMMER' | 'MANUAL_BLOCKED',
//   lastSeen: number,
//   banExpiresAt: number | null,
//   banTimer: NodeJS.Timeout | null
// }
const ipRecords = new Map();

// Nhật ký sự kiện bảo mật (giữ 100 sự kiện gần nhất)
const activityLogs = [];

function addLog(type, message) {
  const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
  const entry = { id: Date.now() + Math.random(), time: timeStr, type, message };
  activityLogs.unshift(entry);
  if (activityLogs.length > 100) activityLogs.pop();
  console.log(`[${entry.time}] [${type}] ${message}`);
  notifySSE();
}

// -----------------------------------------------------------------------------
// 3. TƯỜNG LỬA HỆ THỐNG (FIREWALL CONTROLLER THEO HỆ ĐIỀU HÀNH)
// -----------------------------------------------------------------------------
// Kiểm tra định dạng IP để ngăn chặn command injection
function isValidIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  // Chuẩn hóa IPv4 thông thường hoặc IPv6 hợp lệ
  const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  const ipv6Regex = /^[0-9a-fA-F:]+$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

// Chuẩn hóa địa chỉ IP từ socket
function normalizeIp(rawIp) {
  if (!rawIp) return '127.0.0.1';
  if (rawIp.startsWith('::ffff:')) {
    return rawIp.substring(7);
  }
  return rawIp;
}

// Thực thi lệnh shell với Promise
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

// Gọi lệnh hệ thống chặn IP qua Tường lửa
async function applyOsFirewallBlock(ip) {
  if (!isValidIp(ip)) {
    addLog('ERROR', `Địa chỉ IP không hợp lệ để chặn: ${ip}`);
    return false;
  }

  // Tùy theo hệ điều hành mà chọn câu lệnh phù hợp
  if (SYSTEM_OS === 'win32') {
    const ruleName = `Shield_Block_${ip}`;
    // Xóa rule cũ nếu có để tránh trùng lặp
    await runShell(`netsh advfirewall firewall delete rule name="${ruleName}"`);
    const cmd = `netsh advfirewall firewall add rule name="${ruleName}" dir=in action=block remoteip=${ip}`;
    const res = await runShell(cmd);
    if (res.success) {
      addLog('FIREWALL', `[Windows netsh] Đã kích hoạt chặn IP ${ip} trên Windows Firewall`);
      return true;
    } else {
      addLog('WARN', `[Windows netsh] Không thể tạo rule chặn IP ${ip}. Lưu ý: Cần quyền Administrator! Lỗi: ${res.stderr || res.error}`);
      return false;
    }
  } else if (SYSTEM_OS === 'linux') {
    const cmd = `sudo iptables -I INPUT -s ${ip} -j DROP`;
    const res = await runShell(cmd);
    if (res.success) {
      addLog('FIREWALL', `[Linux iptables] Đã kích hoạt DROP cho IP ${ip}`);
      return true;
    } else {
      addLog('WARN', `[Linux iptables] Không thể áp dụng iptables cho IP ${ip}. Lưu ý: Cần quyền sudo! Lỗi: ${res.stderr || res.error}`);
      return false;
    }
  } else {
    addLog('WARN', `Hệ điều hành [${SYSTEM_OS}] không hỗ trợ can thiệp tường lửa tự động.`);
    return false;
  }
}

// Gọi lệnh hệ thống gỡ chặn IP qua Tường lửa
async function removeOsFirewallBlock(ip) {
  if (!isValidIp(ip)) return false;

  if (SYSTEM_OS === 'win32') {
    const ruleName = `Shield_Block_${ip}`;
    const cmd = `netsh advfirewall firewall delete rule name="${ruleName}"`;
    const res = await runShell(cmd);
    if (res.success) {
      addLog('FIREWALL', `[Windows netsh] Đã gỡ bỏ rule chặn cho IP ${ip}`);
      return true;
    } else {
      addLog('WARN', `[Windows netsh] Lỗi khi gỡ rule cho IP ${ip}: ${res.stderr || res.error}`);
      return false;
    }
  } else if (SYSTEM_OS === 'linux') {
    const cmd = `sudo iptables -D INPUT -s ${ip} -j DROP`;
    const res = await runShell(cmd);
    if (res.success) {
      addLog('FIREWALL', `[Linux iptables] Đã gỡ DROP iptables cho IP ${ip}`);
      return true;
    } else {
      addLog('WARN', `[Linux iptables] Lỗi khi gỡ iptables cho IP ${ip}: ${res.stderr || res.error}`);
      return false;
    }
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
      status: 'ACTIVE', // 'ACTIVE' | 'SPAMMER' | 'MANUAL_BLOCKED'
      lastSeen: Date.now(),
      banExpiresAt: null,
      banTimer: null
    };
    ipRecords.set(ip, record);
  }
  return record;
}

// Khóa IP thủ công hoặc do Spam
async function blockIp(ip, reason = 'MANUAL') {
  const record = getOrCreateRecord(ip);
  if (record.banTimer) {
    clearTimeout(record.banTimer);
    record.banTimer = null;
  }

  if (reason === 'SPAMMER') {
    record.status = 'SPAMMER';
    record.banExpiresAt = Date.now() + CONFIG.AUTO_BAN_DURATION_MS;
    addLog('ALERT', `[AUTO-BAN] Phát hiện IP ${ip} spam > ${CONFIG.RATE_LIMIT_MAX_REQ} kết nối/30s. Khóa tự động 5 phút.`);

    // Hẹn giờ mở khóa sau 5 phút
    record.banTimer = setTimeout(async () => {
      await unblockIp(ip, true);
    }, CONFIG.AUTO_BAN_DURATION_MS);
  } else {
    record.status = 'MANUAL_BLOCKED';
    record.banExpiresAt = null;
    addLog('ADMIN', `Quản trị viên đã chặn thủ công IP ${ip}.`);
  }

  // Luôn gọi lệnh tường lửa cấp hệ thống
  await applyOsFirewallBlock(ip);
  notifySSE();
}

// Mở khóa IP
async function unblockIp(ip, isAuto = false) {
  const record = ipRecords.get(ip);
  if (!record) return;

  if (record.banTimer) {
    clearTimeout(record.banTimer);
    record.banTimer = null;
  }

  record.status = 'ACTIVE';
  record.banExpiresAt = null;
  record.timestamps = []; // Làm sạch cửa sổ rate limit

  if (isAuto) {
    addLog('INFO', `[AUTO-UNBAN] Hết hạn 5 phút khóa, đã tự động gỡ chặn cho IP ${ip}.`);
  } else {
    addLog('ADMIN', `Quản trị viên đã mở khóa thủ công cho IP ${ip}.`);
  }

  await removeOsFirewallBlock(ip);
  notifySSE();
}

// -----------------------------------------------------------------------------
// 5. MÁY CHỦ TCP PROXY (PORT 14445 -> 34567)
// -----------------------------------------------------------------------------
let totalProxyConnections = 0;
let activeConnectionsCount = 0;

const proxyServer = net.createServer((clientSocket) => {
  const now = Date.now();
  const rawIp = clientSocket.remoteAddress;
  const ip = normalizeIp(rawIp);

  // 1. Kiểm tra trạng thái IP trong danh sách chặn
  const record = getOrCreateRecord(ip);
  record.totalConnections += 1;
  record.lastSeen = now;
  totalProxyConnections += 1;

  if (record.status === 'SPAMMER' || record.status === 'MANUAL_BLOCKED') {
    // Đã bị chặn -> Hủy ngay lập tức tại tầng ứng dụng
    addLog('DROP', `Từ chối kết nối từ IP đã bị khóa [${record.status}]: ${ip}`);
    clientSocket.destroy();
    return;
  }

  // 2. Cơ chế Rate Limiting cửa sổ trượt 30 giây
  // Lọc bỏ các mốc thời gian ngoài 30s
  record.timestamps = record.timestamps.filter((ts) => now - ts < CONFIG.RATE_LIMIT_WINDOW_MS);
  record.timestamps.push(now);

  // Nếu vượt quá 10 kết nối trong 30s -> Kích hoạt Auto-Ban "SPAMMER"
  if (record.timestamps.length > CONFIG.RATE_LIMIT_MAX_REQ) {
    blockIp(ip, 'SPAMMER');
    clientSocket.destroy();
    return;
  }

  // 3. Chuyển tiếp mượt mà đến Cổng Thật Game Server (127.0.0.1:34567)
  activeConnectionsCount += 1;
  notifySSE();

  const gameSocket = net.connect(
    {
      port: CONFIG.REAL_PORT,
      host: CONFIG.REAL_HOST
    },
    () => {
      // Chuyển tiếp 2 chiều (Bidirectional TCP Pipe)
      clientSocket.pipe(gameSocket);
      gameSocket.pipe(clientSocket);
    }
  );

  // Xử lý lỗi nếu Game Server ngầm chưa bật hoặc từ chối kết nối
  gameSocket.on('error', (err) => {
    addLog('PROXY_ERR', `Không thể kết nối Game Server nội bộ (127.0.0.1:${CONFIG.REAL_PORT}): ${err.message}`);
    clientSocket.destroy();
  });

  clientSocket.on('error', (err) => {
    // Client ngắt đột ngột
    gameSocket.destroy();
  });

  const cleanupConnection = () => {
    activeConnectionsCount = Math.max(0, activeConnectionsCount - 1);
    notifySSE();
  };

  clientSocket.on('close', cleanupConnection);
  gameSocket.on('close', cleanupConnection);
});

proxyServer.on('error', (err) => {
  addLog('ERROR', `Lỗi máy chủ Proxy TCP trên cổng ${CONFIG.PUBLIC_PORT}: ${err.message}`);
});

proxyServer.listen(CONFIG.PUBLIC_PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` [PROXY SHIELD] Đang lắng nghe tại cổng công khai: ${CONFIG.PUBLIC_PORT}`);
  console.log(` [FORWARD TARGET] Chuyển tiếp tới Game Server: ${CONFIG.REAL_HOST}:${CONFIG.REAL_PORT}`);
  console.log(` [HỆ ĐIỀU HÀNH] Phát hiện: ${SYSTEM_OS === 'win32' ? 'Windows (netsh advfirewall)' : (SYSTEM_OS === 'linux' ? 'Linux (iptables)' : SYSTEM_OS)}`);
  console.log(`=======================================================`);
  addLog('SYSTEM', `Khởi động Proxy 0.0.0.0:${CONFIG.PUBLIC_PORT} -> ${CONFIG.REAL_HOST}:${CONFIG.REAL_PORT}`);
});

// -----------------------------------------------------------------------------
// 6. GIAO DIỆN WEB QUẢN TRỊ & REAL-TIME DASHBOARD (PORT 3000)
// -----------------------------------------------------------------------------
const app = express();
app.use(express.json());

// Quản lý SSE Clients (Server-Sent Events) để cập nhật Real-time siêu mượt
const sseClients = new Set();

function notifySSE() {
  if (sseClients.size === 0) return;
  const payload = JSON.stringify(getDashboardData());
  for (const client of sseClients) {
    client.write(`data: ${payload}\n\n`);
  }
}

function getDashboardData() {
  const now = Date.now();
  const list = [];
  let bannedCount = 0;

  for (const [ip, rec] of ipRecords.entries()) {
    if (rec.status !== 'ACTIVE') bannedCount += 1;

    // Tính số kết nối trong 30s gần nhất
    const recentCount = rec.timestamps.filter((ts) => now - ts < CONFIG.RATE_LIMIT_WINDOW_MS).length;

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

  // Sắp xếp: IP bị chặn lên đầu, sau đó đến IP hoạt động gần nhất
  list.sort((a, b) => {
    if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return -1;
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return 1;
    return b.lastSeen - a.lastSeen;
  });

  return {
    os: SYSTEM_OS,
    uptimeSeconds: Math.floor((now - startTime) / 1000),
    publicPort: CONFIG.PUBLIC_PORT,
    realPort: CONFIG.REAL_PORT,
    activeConnections: activeConnectionsCount,
    totalConnections: totalProxyConnections,
    bannedCount,
    trackedIpsCount: ipRecords.size,
    ips: list,
    logs: activityLogs.slice(0, 30)
  };
}

// SSE Endpoint
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(`data: ${JSON.stringify(getDashboardData())}\n\n`);
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// REST API
app.get('/api/stats', (req, res) => {
  res.json(getDashboardData());
});

app.post('/api/ban', async (req, res) => {
  const { ip } = req.body;
  if (!isValidIp(ip)) {
    return res.status(400).json({ success: false, message: 'Địa chỉ IP không đúng định dạng.' });
  }
  await blockIp(ip, 'MANUAL');
  res.json({ success: true, message: `Đã khóa IP ${ip} thành công!` });
});

app.post('/api/unban', async (req, res) => {
  const { ip } = req.body;
  if (!isValidIp(ip)) {
    return res.status(400).json({ success: false, message: 'Địa chỉ IP không đúng định dạng.' });
  }
  await unblockIp(ip, false);
  res.json({ success: true, message: `Đã gỡ chặn cho IP ${ip} thành công!` });
});

// -----------------------------------------------------------------------------
// 7. TÍNH NĂNG CẬP NHẬT TỰ ĐỘNG TỪ GITHUB (AUTO-UPDATE)
// -----------------------------------------------------------------------------
app.post('/api/update', async (req, res) => {
  addLog('UPDATE', 'Đang nhận lệnh cập nhật từ GitHub via git pull...');

  const result = await runShell('git pull');

  if (result.success) {
    addLog('UPDATE', `Git Pull thành công:\n${result.stdout}`);
    res.json({
      success: true,
      message: 'Cập nhật mã nguồn từ GitHub thành công! Đang khởi động lại ứng dụng...',
      output: result.stdout
    });

    // Thoát tiến trình sau 1.5 giây để các công cụ quản lý tiến trình (PM2 / Docker / Shell script) tự động restart
    setTimeout(() => {
      addLog('SYSTEM', 'Đang thoát tiến trình (process.exit(0)) để nạp phiên bản mới...');
      process.exit(0);
    }, 1500);
  } else {
    addLog('ERROR', `Git Pull thất bại: ${result.stderr || result.error}`);
    res.status(500).json({
      success: false,
      message: 'Cập nhật từ GitHub thất bại. Hãy kiểm tra git hoặc quyền truy cập repository.',
      error: result.stderr || result.error
    });
  }
});

// -----------------------------------------------------------------------------
// 8. GIAO DIỆN WEB DASHBOARD HIỆN ĐẠI (HTML/CSS/JS TÍCH HỢP SẴN)
// -----------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="vi" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Game Port Shield & Management Tool</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#ecfdf5',
              500: '#10b981',
              600: '#059669',
              900: '#064e3b'
            },
            darkBg: '#0b0f19',
            cardBg: '#111827',
            cardBorder: '#1f2937'
          }
        }
      }
    }
  </script>
  <style>
    @keyframes pulse-slow {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .animate-pulse-slow {
      animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #0f172a;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 3px;
    }
  </style>
</head>
<body class="bg-darkBg text-slate-100 min-h-screen font-sans flex flex-col selection:bg-emerald-500 selection:text-white">

  <!-- TOP NAVBAR -->
  <header class="border-b border-cardBorder bg-cardBg/80 backdrop-blur sticky top-0 z-50 px-6 py-4">
    <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold text-xl">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <div>
          <h1 class="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            Game Port Shield
            <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">v1.0 Live</span>
          </h1>
          <p class="text-xs text-slate-400">TCP Proxy Protection & Firewall Automation</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- OS Badge -->
        <div id="osBadge" class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs font-medium text-slate-300">
          <i class="fa-solid fa-server text-cyan-400"></i>
          <span id="osName">Đang kiểm tra OS...</span>
        </div>

        <!-- Uptime -->
        <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
          <i class="fa-regular fa-clock text-amber-400"></i>
          <span>Uptime: <strong id="uptimeText" class="text-white font-mono">0s</strong></span>
        </div>

        <!-- GitHub Update Button -->
        <button id="btnUpdateGit" onclick="triggerGitUpdate()" class="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-95">
          <i class="fa-brands fa-github text-sm"></i>
          <span>⚡ Cập nhật từ GitHub</span>
        </button>
      </div>
    </div>
  </header>

  <!-- MAIN CONTAINER -->
  <main class="max-w-7xl mx-auto w-full p-6 flex-1 flex flex-col gap-6">

    <!-- STATUS BANNER / METRICS CARDS -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      
      <!-- Card 1: Proxy Ports -->
      <div class="bg-cardBg border border-cardBorder rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider">Cấu Hình Cổng</span>
          <i class="fa-solid fa-network-wired text-emerald-400"></i>
        </div>
        <div>
          <div class="text-xl font-bold font-mono text-emerald-400 flex items-center gap-2">
            <span>:14445</span>
            <i class="fa-solid fa-arrow-right text-xs text-slate-500"></i>
            <span>:34567</span>
          </div>
          <p class="text-xs text-slate-400 mt-1">Proxy chuyển tiếp về Game Server</p>
        </div>
        <div class="absolute -right-3 -bottom-3 text-6xl text-emerald-500/5 pointer-events-none">
          <i class="fa-solid fa-network-wired"></i>
        </div>
      </div>

      <!-- Card 2: Active Sockets -->
      <div class="bg-cardBg border border-cardBorder rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider">Đang Kết Nối</span>
          <span class="flex h-2.5 w-2.5 relative">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        </div>
        <div>
          <div id="statActiveSockets" class="text-3xl font-extrabold text-white font-mono">0</div>
          <p class="text-xs text-slate-400 mt-1">Phiên TCP đang hoạt động</p>
        </div>
        <div class="absolute -right-3 -bottom-3 text-6xl text-emerald-500/5 pointer-events-none">
          <i class="fa-solid fa-bolt"></i>
        </div>
      </div>

      <!-- Card 3: Total Connections -->
      <div class="bg-cardBg border border-cardBorder rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider">Tổng Lượt Kết Nối</span>
          <i class="fa-solid fa-chart-line text-blue-400"></i>
        </div>
        <div>
          <div id="statTotalConn" class="text-3xl font-extrabold text-blue-400 font-mono">0</div>
          <p class="text-xs text-slate-400 mt-1">Từ lúc khởi động tiến trình</p>
        </div>
        <div class="absolute -right-3 -bottom-3 text-6xl text-blue-500/5 pointer-events-none">
          <i class="fa-solid fa-chart-line"></i>
        </div>
      </div>

      <!-- Card 4: Banned IPs -->
      <div class="bg-cardBg border border-cardBorder rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider">IP Đang Khóa</span>
          <i class="fa-solid fa-ban text-rose-500"></i>
        </div>
        <div>
          <div id="statBanned" class="text-3xl font-extrabold text-rose-500 font-mono">0</div>
          <p class="text-xs text-slate-400 mt-1">Tự động Spam (5p) + Thủ công</p>
        </div>
        <div class="absolute -right-3 -bottom-3 text-6xl text-rose-500/5 pointer-events-none">
          <i class="fa-solid fa-shield-virus"></i>
        </div>
      </div>

    </div>

    <!-- ACTION BAR & QUICK BLOCK -->
    <div class="bg-cardBg border border-cardBorder rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2 w-full md:w-auto">
        <div class="relative w-full md:w-80">
          <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
          <input type="text" id="searchInput" placeholder="Tìm kiếm IP trong bảng..." onkeyup="filterTable()" class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500">
        </div>
      </div>

      <!-- Quick Manual Block Form -->
      <form onsubmit="handleManualBlock(event)" class="flex items-center gap-2 w-full md:w-auto">
        <div class="relative flex-1 md:w-64">
          <i class="fa-solid fa-ban absolute left-3.5 top-1/2 -translate-y-1/2 text-rose-400 text-xs"></i>
          <input type="text" id="manualIpInput" placeholder="Nhập IP cần chặn thủ công..." required pattern="^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$|^[0-9a-fA-F:]+$" class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono">
        </div>
        <button type="submit" class="px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-rose-600/20 active:scale-95 whitespace-nowrap">
          <i class="fa-solid fa-shield"></i>
          <span>Chặn Ngay</span>
        </button>
      </form>
    </div>

    <!-- MAIN GRID: TABLE IP & LIVE LOGS -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- IP MANAGEMENT TABLE (2 COLS) -->
      <div class="lg:col-span-2 bg-cardBg border border-cardBorder rounded-2xl p-5 flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-base font-bold text-white flex items-center gap-2">
              <i class="fa-solid fa-users text-emerald-400"></i>
              Danh Sách IP Kết Nối & Trạng Thái
            </h2>
            <p class="text-xs text-slate-400">Giám sát tần suất kết nối thời gian thực (Cửa sổ trượt 30 giây)</p>
          </div>
          <span id="ipCountBadge" class="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">0 IP</span>
        </div>

        <div class="overflow-x-auto custom-scrollbar flex-1">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400 uppercase font-semibold text-[11px] tracking-wider">
                <th class="py-3 px-3">Địa Chỉ IP</th>
                <th class="py-3 px-3">Tổng Kết Nối</th>
                <th class="py-3 px-3">30s Gần Nhất</th>
                <th class="py-3 px-3">Hoạt Động</th>
                <th class="py-3 px-3">Trạng Thái</th>
                <th class="py-3 px-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody id="ipTableBody" class="divide-y divide-slate-800/60">
              <tr>
                <td colspan="6" class="py-8 text-center text-slate-500">
                  <i class="fa-solid fa-circle-notch fa-spin text-lg mb-2"></i>
                  <p>Đang đồng bộ dữ liệu kết nối...</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- LIVE LOGS CONSOLE (1 COL) -->
      <div class="bg-cardBg border border-cardBorder rounded-2xl p-5 flex flex-col">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-terminal text-cyan-400"></i>
            Nhật Ký Tường Lửa Real-time
          </h2>
          <span class="flex items-center gap-1.5 text-[11px] text-emerald-400">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Live Feed
          </span>
        </div>
        <p class="text-xs text-slate-400 mb-3">Ghi nhận sự kiện chặn, mở khóa và cảnh báo bảo mật</p>

        <!-- Log entries box -->
        <div id="logsContainer" class="flex-1 bg-slate-950 border border-slate-900 rounded-xl p-3 font-mono text-[11px] custom-scrollbar overflow-y-auto max-h-[460px] space-y-2">
          <div class="text-slate-500">Đang chờ sự kiện hệ thống...</div>
        </div>
      </div>

    </div>

  </main>

  <!-- FOOTER -->
  <footer class="border-t border-cardBorder py-4 px-6 text-center text-xs text-slate-500">
    Game Port Shield & Management Tool • Anti-DDoS TCP Proxy Layer • Chạy trên NodeJS & ${SYSTEM_OS}
  </footer>

  <!-- SCRIPT CLIENT -->
  <script>
    let globalIps = [];

    // Khởi tạo SSE (Server-Sent Events) kết nối Real-time
    function initEventSource() {
      const evtSource = new EventSource('/api/stream');

      evtSource.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          renderDashboard(data);
        } catch (e) {
          console.error('Lỗi phân tích SSE data:', e);
        }
      };

      evtSource.onerror = function() {
        console.warn('Mất kết nối SSE, đang tự động kết nối lại...');
      };
    }

    // Hiển thị dữ liệu lên giao diện
    function renderDashboard(data) {
      // 1. Hệ điều hành
      const osNameEl = document.getElementById('osName');
      if (data.os === 'win32') {
        osNameEl.innerHTML = '<span class="text-cyan-400 font-semibold">Windows</span> (netsh advfirewall)';
      } else if (data.os === 'linux') {
        osNameEl.innerHTML = '<span class="text-amber-400 font-semibold">Linux</span> (iptables DROP)';
      } else {
        osNameEl.textContent = data.os;
      }

      // 2. Uptime
      const hrs = Math.floor(data.uptimeSeconds / 3600);
      const mins = Math.floor((data.uptimeSeconds % 3600) / 60);
      const secs = data.uptimeSeconds % 60;
      document.getElementById('uptimeText').textContent = \`\${hrs}h \${mins}m \${secs}s\`;

      // 3. Stats Cards
      document.getElementById('statActiveSockets').textContent = data.activeConnections;
      document.getElementById('statTotalConn').textContent = data.totalConnections;
      document.getElementById('statBanned').textContent = data.bannedCount;
      document.getElementById('ipCountBadge').textContent = \`\${data.ips.length} IP đã ghi nhận\`;

      // 4. Lưu cache IP và render table
      globalIps = data.ips;
      renderTable(data.ips);

      // 5. Render Logs
      renderLogs(data.logs);
    }

    function renderTable(ips) {
      const tbody = document.getElementById('ipTableBody');
      const filter = (document.getElementById('searchInput').value || '').trim().toLowerCase();

      const filtered = filter ? ips.filter(item => item.ip.toLowerCase().includes(filter)) : ips;

      if (filtered.length === 0) {
        tbody.innerHTML = \`
          <tr>
            <td colspan="6" class="py-8 text-center text-slate-500">
              <i class="fa-solid fa-inbox text-2xl mb-2 text-slate-600 block"></i>
              Chưa có kết nối nào hoặc không tìm thấy IP phù hợp.
            </td>
          </tr>
        \`;
        return;
      }

      tbody.innerHTML = filtered.map(item => {
        // Status Badge
        let statusBadge = '';
        if (item.status === 'ACTIVE') {
          statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Hoạt động</span>';
        } else if (item.status === 'SPAMMER') {
          const rem = item.remainingBanSeconds > 0 ? \` (\${item.remainingBanSeconds}s)\` : '';
          statusBadge = \`<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse"><i class="fa-solid fa-triangle-exclamation"></i> SPAMMER\${rem}</span>\`;
        } else if (item.status === 'MANUAL_BLOCKED') {
          statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30"><i class="fa-solid fa-ban"></i> Chặn thủ công</span>';
        }

        // Action Buttons
        let actionBtn = '';
        if (item.status === 'ACTIVE') {
          actionBtn = \`
            <button onclick="banIp('\${item.ip}')" class="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 border border-rose-500/30 hover:border-transparent text-rose-400 hover:text-white transition-all">
              <i class="fa-solid fa-ban mr-1"></i> Chặn IP
            </button>
          \`;
        } else {
          actionBtn = \`
            <button onclick="unbanIp('\${item.ip}')" class="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 hover:border-transparent text-emerald-400 hover:text-white transition-all">
              <i class="fa-solid fa-lock-open mr-1"></i> Mở khóa
            </button>
          \`;
        }

        const timeAgo = formatTimeAgo(item.lastSeen);
        const rateColor = item.recentConnections > 7 ? 'text-amber-400 font-bold' : (item.recentConnections > 3 ? 'text-blue-400' : 'text-slate-400');

        return \`
          <tr class="hover:bg-slate-900/60 transition-colors">
            <td class="py-3 px-3 font-mono font-semibold text-slate-200">
              <span class="flex items-center gap-2">
                \${item.ip}
                <button title="Sao chép" onclick="copyIp('\${item.ip}')" class="text-slate-500 hover:text-slate-300">
                  <i class="fa-regular fa-copy"></i>
                </button>
              </span>
            </td>
            <td class="py-3 px-3 font-mono text-slate-300">\${item.totalConnections}</td>
            <td class="py-3 px-3 font-mono \${rateColor}">
              \${item.recentConnections}/10 <span class="text-[10px] text-slate-500 font-normal">/ 30s</span>
            </td>
            <td class="py-3 px-3 text-slate-400">\${timeAgo}</td>
            <td class="py-3 px-3">\${statusBadge}</td>
            <td class="py-3 px-3 text-right">\${actionBtn}</td>
          </tr>
        \`;
      }).join('');
    }

    function renderLogs(logs) {
      const container = document.getElementById('logsContainer');
      if (!logs || logs.length === 0) return;

      container.innerHTML = logs.map(entry => {
        let typeClass = 'text-slate-400';
        let badge = entry.type;
        if (entry.type === 'ALERT' || entry.type === 'ERROR') {
          typeClass = 'text-rose-400 font-semibold';
        } else if (entry.type === 'FIREWALL') {
          typeClass = 'text-amber-400';
        } else if (entry.type === 'ADMIN') {
          typeClass = 'text-cyan-400';
        } else if (entry.type === 'UPDATE') {
          typeClass = 'text-indigo-400 font-semibold';
        } else if (entry.type === 'INFO' || entry.type === 'SYSTEM') {
          typeClass = 'text-emerald-400';
        }

        return \`
          <div class="leading-relaxed border-b border-slate-900/60 pb-1">
            <span class="text-slate-600">[\${entry.time}]</span>
            <span class="\${typeClass}">[\${badge}]</span>
            <span class="text-slate-300">\${escapeHtml(entry.message)}</span>
          </div>
        \`;
      }).join('');
    }

    function filterTable() {
      renderTable(globalIps);
    }

    function formatTimeAgo(timestamp) {
      if (!timestamp) return 'Chưa rõ';
      const diffSec = Math.floor((Date.now() - timestamp) / 1000);
      if (diffSec < 5) return 'Vừa xong';
      if (diffSec < 60) return \`\${diffSec}s trước\`;
      if (diffSec < 3600) return \`\${Math.floor(diffSec / 60)}m trước\`;
      return \`\${Math.floor(diffSec / 3600)}h trước\`;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.innerText = text;
      return div.innerHTML;
    }

    function copyIp(ip) {
      navigator.clipboard.writeText(ip);
      alert('Đã sao chép IP: ' + ip);
    }

    // Gửi yêu cầu Chặn IP
    async function banIp(ip) {
      if (!confirm(\`Bạn có chắc chắn muốn CHẶN địa chỉ IP: \${ip} ?\`)) return;
      try {
        const res = await fetch('/api/ban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip })
        });
        const data = await res.json();
        if (!data.success) alert(data.message);
      } catch (err) {
        alert('Lỗi gửi lệnh chặn: ' + err.message);
      }
    }

    // Gửi yêu cầu Mở khóa IP
    async function unbanIp(ip) {
      try {
        const res = await fetch('/api/unban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip })
        });
        const data = await res.json();
        if (!data.success) alert(data.message);
      } catch (err) {
        alert('Lỗi gửi lệnh mở khóa: ' + err.message);
      }
    }

    // Chặn thủ công từ Form
    async function handleManualBlock(e) {
      e.preventDefault();
      const input = document.getElementById('manualIpInput');
      const ip = input.value.trim();
      if (!ip) return;

      await banIp(ip);
      input.value = '';
    }

    // Kích hoạt Cập nhật Git
    async function triggerGitUpdate() {
      if (!confirm('Bạn có chắc chắn muốn kéo mã nguồn mới nhất từ GitHub (git pull) và khởi động lại tiến trình?')) return;
      
      const btn = document.getElementById('btnUpdateGit');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải git pull...';

      try {
        const res = await fetch('/api/update', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          alert(data.message);
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        } else {
          alert('Cập nhật thất bại: ' + (data.error || data.message));
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      } catch (err) {
        // Trường hợp server exit ngay trước khi HTTP response hoàn tất
        alert('Đã gửi lệnh cập nhật và tiến trình đang khởi động lại...');
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    }

    // Bắt đầu
    initEventSource();
  </script>
</body>
</html>`);
});

// Khởi chạy Web Server Dashboard
app.listen(CONFIG.WEB_PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` [WEB DASHBOARD] Đang chạy tại http://localhost:${CONFIG.WEB_PORT}`);
  console.log(` Truy cập trình duyệt để quản lý IP và giám sát thời gian thực`);
  console.log(`=======================================================`);
  addLog('SYSTEM', `Khởi động Web Dashboard tại cổng ${CONFIG.WEB_PORT}`);
});

