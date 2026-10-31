let latestData = null;
let currentTab = 'monitor';

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await window.shieldAPI.getInitialData();
    renderApp(data);
    loadSettings();
  } catch (err) {
    console.error('Lỗi nạp dữ liệu:', err);
  }

  window.shieldAPI.onStatsUpdate((data) => {
    renderApp(data);
  });
});

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));

  const tabIndex = { monitor: 0, settings: 1, logs: 2 }[tab];
  document.querySelectorAll('.tab-item')[tabIndex].classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');

  if (tab === 'settings') {
    loadSettings();
  }
}

function renderApp(data) {
  if (!data) return;
  latestData = data;

  // 1. Top bar Status
  const statusTag = document.getElementById('proxyStatusTag');
  if (data.isProxyRunning) {
    statusTag.className = 'status-tag';
    statusTag.textContent = '● Đang chạy';
  } else {
    statusTag.className = 'status-tag stopped';
    statusTag.textContent = '■ Đã dừng';
  }

  // 2. Mapping
  const cfg = data.config || {};
  document.getElementById('proxyMapping').innerHTML = `0.0.0.0:<strong>${cfg.publicPort || 14445}</strong> → ${cfg.realHost || '127.0.0.1'}:<strong>${cfg.realPort || 34567}</strong>`;
  document.getElementById('osBadge').textContent = `HĐH: ${data.os === 'win32' ? 'Windows (netsh)' : (data.os === 'linux' ? 'Linux (iptables)' : data.os)}`;
  document.getElementById('footerOs').textContent = `Hệ điều hành: ${data.os} | Phiên bản 1.1`;

  // 3. Mini Stats
  document.getElementById('statActive').textContent = data.activeConnections || 0;
  document.getElementById('statTotal').textContent = data.totalConnections || 0;
  document.getElementById('statBanned').textContent = data.bannedCount || 0;

  const hrs = Math.floor(data.uptimeSeconds / 3600);
  const mins = Math.floor((data.uptimeSeconds % 3600) / 60);
  const secs = data.uptimeSeconds % 60;
  document.getElementById('statUptime').textContent = `${hrs}h ${mins}m ${secs}s`;

  // 4. IP Table
  renderIpTable();

  // 5. Logs Console
  renderLogs(data.logs);
}

function renderIpTable() {
  if (!latestData || !latestData.ips) return;
  const tbody = document.getElementById('ipTableBody');
  const filter = (document.getElementById('filterInput').value || '').trim().toLowerCase();

  const filtered = filter
    ? latestData.ips.filter(item => item.ip.toLowerCase().includes(filter))
    : latestData.ips;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #6b7280; padding: 24px;">Không tìm thấy địa chỉ IP nào.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    let badge = '';
    if (item.status === 'ACTIVE') {
      badge = '<span class="badge badge-active">Hoạt động</span>';
    } else if (item.status === 'SPAMMER') {
      const rem = item.remainingBanSeconds > 0 ? ` (${item.remainingBanSeconds}s)` : '';
      badge = `<span class="badge badge-spammer">SPAMMER${rem}</span>`;
    } else if (item.status === 'MANUAL_BLOCKED') {
      badge = '<span class="badge badge-blocked">Đã chặn</span>';
    }

    const diffSec = Math.floor((Date.now() - item.lastSeen) / 1000);
    const timeAgo = diffSec < 5 ? 'Vừa xong' : (diffSec < 60 ? `${diffSec}s trước` : `${Math.floor(diffSec / 60)}m trước`);

    let actionBtn = item.status === 'ACTIVE'
      ? `<button class="btn btn-danger btn-sm" onclick="banIp('${item.ip}')">Chặn</button>`
      : `<button class="btn btn-success btn-sm" onclick="unbanIp('${item.ip}')">Mở khóa</button>`;

    return `
      <tr>
        <td style="font-family: monospace; font-weight: 600; color: #f3f4f6;">${item.ip}</td>
        <td style="font-family: monospace;">${item.totalConnections}</td>
        <td style="font-family: monospace; ${item.recentConnections > 7 ? 'color: #fbbf24; font-weight: bold;' : ''}">${item.recentConnections}</td>
        <td style="color: #9ca3af;">${timeAgo}</td>
        <td>${badge}</td>
        <td style="text-align: right;">${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

function renderLogs(logs) {
  const container = document.getElementById('logsConsole');
  if (!logs || logs.length === 0) return;

  container.innerHTML = logs.map(entry => {
    return `
      <div class="log-line">
        <span class="log-time">[${entry.time}]</span>
        <span class="log-type-${entry.type}">[${entry.type}]</span>
        <span>${escapeHtml(entry.message)}</span>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

// Cài đặt
async function loadSettings() {
  try {
    const cfg = await window.shieldAPI.getConfig();
    if (!cfg) return;
    document.getElementById('cfgPublicPort').value = cfg.publicPort || 14445;
    document.getElementById('cfgRealPort').value = cfg.realPort || 34567;
    document.getElementById('cfgRealHost').value = cfg.realHost || '127.0.0.1';
    document.getElementById('cfgMaxReq').value = cfg.rateLimitMaxReq || 10;
    document.getElementById('cfgWindowSec').value = cfg.rateLimitWindowSec || 30;
    document.getElementById('cfgBanDurationMin').value = cfg.banDurationMin || 5;
    document.getElementById('cfgGithubRemote').value = cfg.githubRemote || '';
  } catch (err) {
    console.error('Lỗi đọc cấu hình:', err);
  }
}

async function saveSettings() {
  const newConfig = {
    publicPort: parseInt(document.getElementById('cfgPublicPort').value, 10),
    realPort: parseInt(document.getElementById('cfgRealPort').value, 10),
    realHost: document.getElementById('cfgRealHost').value.trim(),
    rateLimitMaxReq: parseInt(document.getElementById('cfgMaxReq').value, 10),
    rateLimitWindowSec: parseInt(document.getElementById('cfgWindowSec').value, 10),
    banDurationMin: parseInt(document.getElementById('cfgBanDurationMin').value, 10),
    githubRemote: document.getElementById('cfgGithubRemote').value.trim()
  };

  const res = await window.shieldAPI.saveConfig(newConfig);
  alert(res.message);
  if (res.success) {
    switchTab('monitor');
  }
}

// Thao tác Proxy & IP
async function restartProxy() {
  const res = await window.shieldAPI.restartProxy();
  alert(res.message);
}

async function banIp(ip) {
  if (!confirm(`Xác nhận chặn IP: ${ip}?`)) return;
  const res = await window.shieldAPI.banIp(ip);
  if (!res.success) alert(res.message);
}

async function unbanIp(ip) {
  const res = await window.shieldAPI.unbanIp(ip);
  if (!res.success) alert(res.message);
}

async function manualBan() {
  const input = document.getElementById('manualIpInput');
  const ip = input.value.trim();
  if (!ip) return;
  await banIp(ip);
  input.value = '';
}

function clearLogs() {
  document.getElementById('logsConsole').innerHTML = '<div class="log-line">Đã xóa nhật ký hiển thị.</div>';
}

// GitHub Pull
async function gitPull() {
  if (!confirm('Kéo mã nguồn mới nhất từ GitHub (git pull) và tự động khởi động lại App?')) return;
  const res = await window.shieldAPI.gitPull();
  alert(res.message);
}

// GitHub Push
async function gitPush() {
  const cfg = await window.shieldAPI.getConfig();
  if (!cfg.githubRemote) {
    const url = prompt('Chưa cấu hình GitHub Remote URL. Vui lòng nhập link repo GitHub của bạn (ví dụ: https://github.com/username/anti-ddos.git):');
    if (!url) return;
    cfg.githubRemote = url.trim();
    await window.shieldAPI.saveConfig(cfg);
  }

  const msg = prompt('Nhập nội dung commit (hoặc để trống để dùng mặc định):', 'Update Game Port Shield');
  if (msg === null) return;

  const res = await window.shieldAPI.gitPush(msg);
  if (res.success) {
    alert(res.message);
  } else {
    alert(res.message + (res.details ? '\n\nChi tiết: ' + res.details : ''));
  }
}
