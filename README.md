# 🛡️ Game Port Shield & Management Tool

**Game Port Shield** là công cụ Desktop chuyên dụng để bảo vệ các máy chủ game trước các cuộc tấn công DDoS quy mô vừa và nhỏ, spam flood kết nối TCP. Ứng dụng tích hợp tự động phát hiện hệ điều hành (Windows/Linux), điều khiển tường lửa cấp Kernel/Hệ điều hành, tự động Auto-Ban chống spam kết nối và cung cấp giao diện quản trị trực quan.

---

## 📥 Tải Về Phiên Bản Chính Thức (File .EXE)

Tải file chạy trực tiếp (Portable) dành cho Windows, không cần cài đặt NodeJS hay môi trường phức tạp:

👉 **[Tải xuống GamePortShield.exe (v1.0.0)](https://github.com/hoangdepzaixxxz/anti-ddos-basic/releases/download/v1.0.0/GamePortShield.exe)**

*(Bản phát hành chính thức: [Releases v1.0.0](https://github.com/hoangdepzaixxxz/anti-ddos-basic/releases/tag/v1.0.0))*

---

## 🚀 Tính Năng Nổi Bật

1. **Proxy TCP Hiệu Năng Cao**:
   - Cổng công khai mặc định: `14445` (Người chơi bên ngoài kết nối vào).
   - Cổng Game Server thật: `34567` tại `127.0.0.1` (Chạy ngầm nội bộ).
   - Cho phép tùy chỉnh Cổng và IP Game Server đích trực tiếp ngay trên giao diện Tab "Cài Đặt".

2. **Tự Động Can Thiệp Tường Lửa Hệ Thống**:
   - Tự động nhận diện Windows (`netsh advfirewall`) hoặc Linux (`iptables`).
   - Tự động kích hoạt quyền Administrator khi khởi chạy trên Windows.

3. **Cơ Chế Auto-Ban Chống Spam (Rate Limiting)**:
   - Cửa sổ trượt 30 giây: Nếu 1 IP kết nối vượt quá 10 lần sẽ tự động dán nhãn **SPAMMER**.
   - Khóa IP trên tường lửa trong 5 phút, sau 5 phút tự động gỡ chặn.

4. **Giao Diện Quản Trị Trực Quan**:
   - Giám sát danh sách IP đang kết nối theo thời gian thực.
   - Thao tác Chặn / Mở khóa thủ công cho từng IP.
   - Xem nhật ký hoạt động của tường lửa trực tiếp trên màn hình console.

---

## ⚙️ Hướng Dẫn Sử Dụng

1. Tải file **`GamePortShield.exe`** từ đường dẫn trên.
2. Click đúp để khởi chạy (chọn **Yes** khi Windows hỏi quyền Administrator UAC để phần mềm có thể điều khiển tường lửa).
3. Vào tab **"Cài đặt Cổng & Mạng"** để chỉnh cổng theo mong muốn của bạn.
4. Bấm **"Lưu Cài Đặt & Áp Dụng Ngay"**.
