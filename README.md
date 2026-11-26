# LuckyDraw
Next.js + Supabase. Một chiến dịch, một lượt/SĐT, không OTP.
1. Tạo Supabase project riêng. Chạy supabase/schema.sql một lần trong SQL Editor.
2. Tắt public signup. Seed admin bằng `node seed-admin.mjs` trong môi trường có cấu hình Supabase; đăng nhập username admin. Script chỉ tạo tài khoản mới, không ghi đè tài khoản hiện có; mật khẩu khởi tạo chỉ hiển thị một lần. Đổi mật khẩu trong Supabase Dashboard sau khi nhận.
3. Copy .env.example thành .env.local. Điền URL, publishable key và secret key server-only.
4. npm install; npm run dev. Trang / và /admin.
5. Tạo giải, nhập voucher CSV/TXT một mã mỗi dòng, bật chương trình.
Tất cả dữ liệu nằm trong Supabase. Tổng xác suất tối đa 100%. Quà hết kho/hết mã chuyển thành không trúng. SQL transaction khóa settings và phần thưởng; mã duy nhất; request UUID giúp retry an toàn trong phiên. SĐT chưa OTP nên không xác minh quyền sở hữu. Cấu hình CAPTCHA/rate limit ở hosting trước khi public; xác nhận thể lệ và thông báo dữ liệu. Không công khai secret.