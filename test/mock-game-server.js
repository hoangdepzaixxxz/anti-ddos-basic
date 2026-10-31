/**
 * Mock Game Server chạy tại cổng 34567 (TCP)
 * Dùng để kiểm tra khả năng chuyển tiếp (forwarding) của Game Port Shield.
 */
const net = require('net');

const PORT = 34567;
const HOST = '127.0.0.1';

const server = net.createServer((socket) => {
  const clientInfo = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[GameServer:34567] Nhận kết nối mới từ: ${clientInfo}`);

  socket.write(`[GameServer 34567] Kết nối thành công! Chào mừng bạn tham gia server.\n`);

  socket.on('data', (data) => {
    console.log(`[GameServer:34567] Nhận dữ liệu từ ${clientInfo}: ${data.toString().trim()}`);
    socket.write(`[GameServer Echo]: ${data}`);
  });

  socket.on('close', () => {
    console.log(`[GameServer:34567] Kết nối đóng: ${clientInfo}`);
  });

  socket.on('error', (err) => {
    console.error(`[GameServer:34567] Lỗi socket:`, err.message);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(` [GAME SERVER NỘI BỘ] Đang lắng nghe tại ${HOST}:${PORT}`);
  console.log(` Sẵn sàng nhận lưu lượng forward từ Game Port Shield (14445)`);
  console.log(`=======================================================`);
});

