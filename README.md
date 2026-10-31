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

---

### 3. Giám Sát & Quản Lý IP

- Xem danh sách người chơi đang kết nối tại tab **"Giám sát IP"**.
- Nếu phát hiện IP spam quá 10 kết nối trong 30 giây, hệ thống sẽ tự động dán nhãn **SPAMMER** và khóa IP trên tường lửa 5 phút.
- Bạn có thể chủ động bấm **"Chặn"** hoặc **"Mở khóa"** bất kỳ IP nào trên bảng danh sách.

---

### 4. Tự Động Cập Nhật 1-Click (In-App Auto Update)

- Khi có bản cập nhật mới, nút **"Cập nhật"** ở góc trên bên phải sẽ sáng **dấu chấm đỏ**.
- **Chỉ cần bấm nút "Cập nhật"**: Phần mềm sẽ **tự động tải ngầm bản mới về máy và tự bật bảng cài đặt lên luôn**, bạn không cần mở trình duyệt hay tải thủ công!
