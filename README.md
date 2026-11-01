# 🛡️ Game Port Shield - Hướng Dẫn Sử Dụng

Phần mềm bảo vệ máy chủ game, chuyển tiếp cổng TCP và chống spam kết nối tự động. Ứng dụng Desktop độc lập chuyên nghiệp.

---

### 1. Hướng Dẫn Tải & Chạy Phần Mềm

Ứng dụng hỗ trợ 100% mọi phiên bản Windows (Windows Server 2012 / 2012 R2, Windows Server 2016 - 2025, Windows 7, 8, 10, 11):

- ⚡ **Cách 1: Bản Chạy Ngay (Portable - Khuyên Dùng Cho VPS / Server)**
  1. Tải file: 👉 **[GamePortShield.exe (Bản Portable)](https://github.com/hoangdepzaixxxz/anti-ddos-basic/raw/main/GamePortShield.exe)**
  2. Double-click file `GamePortShield.exe` là app mở lên chạy ngay lập tức, không cần cài đặt!

- 💻 **Cách 2: Bản Cài Đặt Vào Máy (Tạo biểu tượng Desktop)**
  1. Tải bộ cài: 👉 **[GamePortShield-Setup.exe](https://github.com/hoangdepzaixxxz/anti-ddos-basic/raw/main/GamePortShield-Setup.exe)**
  2. Chạy file cài đặt, nhấn **Cài đặt**. Trình cài đặt sẽ tạo biểu tượng ngoài **Bàn làm việc (Desktop)** và Start Menu.

---

### 2. Cài Đặt Cổng & IP Game Server

1. Chọn tab **"Cài đặt Cổng & Mạng"** trên giao diện:
   - **Cổng Công Khai (Public Port)**: Cổng đưa cho người chơi kết nối vào (mặc định: `14445`).
   - **IP Game Server Thật**: Địa chỉ IP game server đang chạy (mặc định `127.0.0.1` nếu cùng máy).
   - **Cổng Game Server Thật**: Cổng nội bộ của game server (mặc định: `34567`).
2. Bấm nút **"Lưu Cài Đặt & Áp Dụng Ngay"**.

> Game server phải chạy ở **Cổng Game Server Thật**, người chơi vào bằng **Cổng Công Khai**. Hai cổng phải khác nhau. Nếu game đang chiếm cổng công khai, proxy sẽ báo lỗi và không bật các luật ẩn cổng.

---

### 3. Giám Sát & Quản Lý IP

- Xem danh sách người chơi đang kết nối tại tab **"Giám sát IP"**.
- IP vượt giới hạn kết nối sẽ bị từ chối phần dư. Nếu vẫn spam thì bị dán nhãn **SPAMMER** và khóa ở tường lửa, tái phạm thì thời gian khóa tăng gấp 3 lần.
- IP đang có người chơi thật (ví dụ quán net chung IP) được nới giới hạn để tránh khóa nhầm.
- Bạn có thể chủ động bấm **"Chặn"** hoặc **"Mở khóa"** bất kỳ IP nào trên bảng danh sách.

---

### 4. Bảo Vệ & Ẩn Cổng

Chạy app bằng **quyền Administrator** và **bật Windows Firewall** thì các tính năng này mới có tác dụng. App sẽ cảnh báo nếu thiếu một trong hai điều kiện.

- **Ẩn cổng game thật**: mọi IP bên ngoài đều không kết nối được vào cổng thật, chỉ proxy nội bộ nối vào được.
- **Ẩn khỏi Check-Host**: chặn IP các node Check-Host trên cả hai cổng. Danh sách tự cập nhật mỗi 6 giờ. Người chơi không bị ảnh hưởng.
- **Khóa cửa**: chỉ IP tin cậy mới vào được, nên cổng công khai ẩn với mọi công cụ quét. IP được tin cậy tự động sau khi chơi thật đủ 2 phút. Có thể bật tay, hoặc để app tự bật khi phát hiện tấn công.
- **Cổng xác minh**: link để người chơi mới tự mở khóa IP của mình khi server đang khóa cửa.
- **Chạy kiểm tra**: nhờ các node Check-Host thử kết nối thật vào máy để xác nhận cổng đã ẩn.

Các luật được gỡ khi tắt app. Luật chỉ áp dụng trên cổng game, không chạm đến RDP/SSH.

**Giới hạn cần biết:**

- Ẩn khỏi Check-Host chỉ che được Check-Host. Kẻ tấn công dùng công cụ quét khác vẫn thấy cổng công khai, trừ khi bật Khóa cửa.
- App lọc được flood kết nối, nhưng không chống được flood băng thông làm nghẽn đường truyền của VPS. Trường hợp đó cần chống DDoS từ nhà cung cấp mạng.
- Game server thấy mọi người chơi là `127.0.0.1`. Nếu server có giới hạn số tài khoản theo IP thì cần nới giới hạn đó.
- Nếu game ở máy khác, app không ẩn được cổng thật. Hãy cấu hình tường lửa máy đó chỉ cho IP proxy đi vào.

---

### 5. Tự Động Cập Nhật 1-Click (In-App Auto Update)

- Khi có bản cập nhật mới, nút **"Cập nhật"** ở góc trên bên phải sẽ sáng **dấu chấm đỏ**.
- **Chỉ cần bấm nút "Cập nhật"**: Phần mềm sẽ **tự động tải ngầm bản mới về máy và tự bật bảng cài đặt lên luôn**, bạn không cần mở trình duyệt hay tải thủ công!
