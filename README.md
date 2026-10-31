# 🛡️ Game Port Shield - Hướng Dẫn Sử Dụng

Phần mềm bảo vệ máy chủ game, chuyển tiếp cổng TCP và chống spam kết nối tự động. Ứng dụng Desktop độc lập chuyên nghiệp.

---

### 1. Cài Đặt Lên Màn Hình Chính (Desktop)

1. Tải bộ cài đặt: 👉 **[Tải xuống GamePortShield-Setup.exe](https://github.com/hoangdepzaixxxz/anti-ddos-basic/raw/main/GamePortShield-Setup.exe)** *(Hoặc click trực tiếp file `GamePortShield-Setup.exe` trên danh sách repository).*
2. Mở file **`GamePortShield-Setup.exe`**.
3. Chọn **Yes** khi Windows xuất hiện bảng cấp quyền Administrator (UAC).
4. Nhấn **Cài đặt**. Trình cài đặt sẽ tự động tạo biểu tượng ngoài **Bàn làm việc (Desktop)** và Start Menu.
5. Cài xong, phần mềm sẽ mở ra cửa sổ ứng dụng Desktop riêng biệt (không dùng trình duyệt).

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
