# 🛡️ Game Port Shield - Hướng Dẫn Sử Dụng

Phần mềm bảo vệ máy chủ game, chuyển tiếp cổng TCP và chống spam kết nối tự động. Phiên bản siêu nhẹ Native Engine chỉ **~240 KB** (không cần cài thêm bất kỳ runtime nào).

---

### 1. Tải Về & Cài Đặt (Tự Động Xuất Hiện Trên Bàn Làm Việc / Desktop)

1. Tải file: 👉 **[Tải xuống GamePortShield-Setup.exe (~240 KB)](https://github.com/hoangdepzaixxxz/anti-ddos-basic/raw/main/GamePortShield-Setup.exe)** *(Hoặc click trực tiếp file `GamePortShield.exe` trên danh sách repository).*
2. Mở file **`GamePortShield-Setup.exe`**.
3. Chọn quyền Administrator (Yes) khi Windows xuất hiện thông báo UAC.
4. Ứng dụng sẽ **tự động tạo biểu tượng trên Bàn làm việc (Desktop)** ngay lập tức và mở giao diện ứng dụng.
5. Những lần sau, bạn chỉ cần click vào biểu tượng trên Desktop để sử dụng.

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

### 4. Cập Nhật Khi Có Phiên Bản Mới

- Khi có bản cập nhật mới, nút **"Cập nhật"** ở góc trên bên phải sẽ xuất hiện **dấu chấm đỏ**.
- Bấm vào nút đó để tải phiên bản mới nhất về máy.
