# 🛡️ Game Port Shield & Management Tool (Desktop Application)

**Game Port Shield & Management Tool** là một **Ứng dụng Desktop hoàn chỉnh** (xây dựng bằng Electron & Node.js) đóng vai trò là một proxy trung gian chuyên dụng để bảo vệ các máy chủ game (Minecraft, GTA V, SA-MP, CS:GO, Rust, FiveM, Unity/Unreal TCP Server...) trước spam flood và tấn công TCP.

Ứng dụng hiển thị cửa sổ phần mềm máy tính (Desktop App GUI) hiện đại, không cần mở trình duyệt web.

---

## 🚀 Tính Năng Kỹ Thuật

1. **Giao Diện Desktop App GUI Chuyên Nghiệp**:
   - Cửa sổ phần mềm độc lập phong cách Dark Theme / Cyber Defense.
   - Thống kê Real-time: Cấu hình cổng, số kết nối TCP trực tiếp, tổng lượt kết nối, số IP bị khóa.
   - Bảng điều khiển giám sát IP trực quan: Xem tần suất kết nối trong 30 giây gần nhất, trạng thái hoạt động, thời gian hoạt động.
   - Nút Chặn / Mở khóa IP nhanh, thanh tìm kiếm lọc IP tức thì.
   - Hộp nhật ký Live Feed (Console) hiển thị mọi hành động kích hoạt tường lửa cấp hệ thống.

2. **Cấu Hình Cổng & Mạng (Network Proxy)**:
   - **Cổng công khai (Public / Fake Port)**: `14445` (Người chơi bên ngoài kết nối vào).
   - **Cổng thật (Internal Game Server)**: `34567` tại `127.0.0.1` (Game server thực tế chạy ngầm).
   - Chuyển tiếp 2 chiều TCP hiệu năng cao, trích xuất chính xác địa chỉ IP của từng người chơi.

3. **Tự Động Nhận Diện Hệ Điều Hành & Điều Khiển Tường Lửa**:
   - **Windows**: Điều khiển trực tiếp Windows Firewall bằng `netsh advfirewall firewall add/delete rule`.
   - **Linux**: Điều khiển `sudo iptables -I/-D INPUT -s <IP> -j DROP`.
   - Kiểm tra định dạng IP chặt chẽ chống Command Injection.

4. **Cơ Chế Bảo Vệ & Auto-Ban Chống Spam (Rate Limiting)**:
   - Thuật toán cửa sổ trượt (Sliding Window) 30 giây.
   - Nếu 1 IP gửi quá **10 kết nối trong 30 giây**:
     - Đánh nhãn **SPAMMER**.
     - Gọi lệnh hệ thống khóa IP trên tường lửa trong đúng **5 phút (300 giây)**.
     - Sau 5 phút, hệ thống tự động gỡ lệnh khóa (unblock) và phục hồi trạng thái hoạt động.

5. **⚡ Nút Bấm Tự Động Cập Nhật Từ GitHub (Auto-Update)**:
   - Tích hợp nút **"⚡ Cập nhật từ GitHub"** ngay trên thanh tiêu đề của App.
   - Tự động gọi lệnh `git pull` để lấy mã nguồn mới nhất từ GitHub.
   - Tự động khởi động lại ứng dụng Desktop (`app.relaunch()` & `app.exit(0)`) mà không cần thao tác tay.

---

## 🛠️ Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### 1. Cài đặt thư viện

Mở Terminal trong thư mục dự án và chạy:
```bash
npm install
```

### 2. Khởi chạy Ứng Dụng Desktop với Quyền Quản trị viên (BẮT BUỘC)

> [!IMPORTANT]
> Để ứng dụng có quyền thêm và xóa rule chặn IP trên tường lửa của hệ điều hành, bạn **BẮT BUỘC** phải chạy với quyền Administrator hoặc root:

- **Trên Windows**:
  1. Mở PowerShell hoặc Command Prompt bằng **"Run as Administrator"**.
  2. Di chuyển đến thư mục dự án và chạy:
     ```cmd
     npm start
     ```
     *(Hoặc click đúp chạy file `run.bat` bằng Administrator).*

- **Trên Linux**:
  Chạy lệnh:
  ```bash
  sudo npm start
  ```
  *(Hoặc chạy `bash run.sh`).*

---

## 🎮 Hướng Dẫn Thử Nghiệm

1. **Khởi chạy Game Server Giả lập (Port 34567)**:
   ```bash
   npm run test-server
   ```
2. **Khởi chạy Desktop App Shield**:
   ```bash
   npm start
   ```
   *(Cửa sổ ứng dụng Desktop sẽ xuất hiện ngay lập tức)*.
3. **Thử kết nối vào cổng giả 14445**:
   Bạn có thể dùng PowerShell:
   ```powershell
   Test-NetConnection -ComputerName 127.0.0.1 -Port 14445
   ```
   Hoặc thử spam kết nối nhiều lần để thấy nhãn **SPAMMER** tự động kích hoạt cùng đếm ngược 5 phút mở khóa ngay trên giao diện Desktop!
