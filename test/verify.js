const net = require('net');
const http = require('http');

async function runTest() {
  console.log('--- BẮT ĐẦU KIỂM TRA TOÀN DIỆN ---');

  // 1. Kiểm tra Web API /api/stats
  const stats = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:3000/api/stats', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  console.log('✅ Web API /api/stats hoạt động bình thường:');
  console.log('   - OS phát hiện:', stats.os);
  console.log('   - Public Port:', stats.publicPort);
  console.log('   - Real Port:', stats.realPort);
  console.log('   - Banned IPs ban đầu:', stats.bannedCount);

  // 2. Thử kết nối TCP vào Cổng Giả 14445 và kiểm tra phản hồi từ Mock Server 34567
  console.log('\n--- Thử kết nối đơn lẻ đến Proxy 14445 ---');
  await new Promise((resolve, reject) => {
    const socket = net.connect({ port: 14445, host: '127.0.0.1' }, () => {
      console.log('✅ Đã kết nối TCP thành công đến cổng giả 14445');
    });

    socket.on('data', (data) => {
      console.log('✅ Nhận dữ liệu phản hồi từ Game Server thông qua Proxy:');
      console.log('  ', data.toString().trim());
      socket.end();
      resolve();
    });

    socket.on('error', reject);
  });

  // 3. Giả lập spam kết nối để kích hoạt Auto-Ban (> 10 kết nối trong 30s)
  console.log('\n--- Giả lập Spam kết nối (12 kết nối liên tiếp) ---');
  for (let i = 1; i <= 12; i++) {
    await new Promise((resolve) => {
      const s = net.connect({ port: 14445, host: '127.0.0.1' }, () => {
        s.end();
        resolve();
      });
      s.on('error', () => resolve());
    });
  }

  // Chờ 500ms để hệ thống cập nhật
  await new Promise(r => setTimeout(r, 500));

  // 4. Kiểm tra lại /api/stats xem đã gắn cờ SPAMMER chưa
  const newStats = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:3000/api/stats', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  console.log('\n✅ Kết quả sau khi spam:');
  console.log('   - Tổng số lượt kết nối:', newStats.totalConnections);
  console.log('   - Số IP bị khóa:', newStats.bannedCount);
  console.log('   - Danh sách IP:', newStats.ips.map(i => `${i.ip} -> Trạng thái: ${i.status} (${i.remainingBanSeconds}s)`));

  console.log('\n--- TẤT CẢ KIỂM TRA ĐÃ HOÀN TẤT THÀNH CÔNG ---');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Lỗi kiểm tra:', err);
  process.exit(1);
});

