# LuckyDraw
Next.js + Supabase. Tài khoản tự đăng ký bằng email và mật khẩu, không gửi xác nhận; mỗi tài khoản sở hữu các chiến dịch riêng. Nhiều chiến dịch độc lập, giới hạn lượt theo SĐT, không OTP. / là trang giới thiệu; /admin là quản trị; /c/<slug> là trang chiến dịch (chiến dịch cũ /c/mac-dinh).
1. Tạo Supabase project riêng. Chạy `supabase/schema.sql` rồi `supabase/auto_odds_v2.sql` `supabase/auto_odds_v3.sql` `supabase/campaigns_v4.sql`  `supabase/campaigns_v5.sql` `supabase/widgets_v6.sql` `supabase/owners_v7.sql` và `supabase/signup_v8.sql` một lần theo thứ tự.
2. Tạo tài khoản qua /api/auth/register (server-side Supabase Auth, auto-confirm theo yêu cầu sản phẩm, không xác minh quyền sở hữu email). Đăng ký có quota theo email/IP và toàn hệ thống; IP chỉ là tín hiệu phụ. Không dùng trạng thái auto-confirm làm bằng chứng sở hữu email. Seed admin bằng `node seed-admin.mjs` trong môi trường có cấu hình Supabase; đăng nhập username admin. Script chỉ tạo tài khoản mới, không ghi đè tài khoản hiện có; mật khẩu khởi tạo chỉ hiển thị một lần. Đổi mật khẩu trong Supabase Dashboard sau khi nhận.
3. Copy .env.example thành .env.local. Điền URL, publishable key và secret key server-only.
4. npm install; npm run dev. Trang / và /admin.
5. Tạo giải, nhập voucher CSV/TXT một mã mỗi dòng, bật chương trình.
Tất cả dữ liệu nằm trong Supabase. Tổng xác suất hiển thị đúng 100%; việc chọn kết quả dùng vé trọng số nguyên và lấy mẫu loại bỏ sai lệch modulo, không dùng phần trăm làm tròn. Revision ngăn ghi đè dữ liệu cũ. Quà giới hạn có tồn khả dụng bằng số lượng còn lại, hoặc min(số lượng, số mã chưa dùng) nếu yêu cầu mã duy nhất. Mẫu số = max(1, lượt dự kiến còn lại, tổng tồn khả dụng); mỗi quà giới hạn có xác suất = tồn khả dụng / mẫu số. Phần dư chia theo trọng số quà không giới hạn và không trúng. Mốc lượt dự kiến không phải giới hạn cứng: vượt mốc thì ưu tiên tồn hữu hạn còn lại. Quà không giới hạn không yêu cầu mã duy nhất. Đóng chương trình trước khi chỉnh tồn kho hoặc nhập voucher. SQL transaction khóa settings; tồn kho, voucher, kết quả và ảnh chụp xác suất được lưu nguyên tử; request UUID hỗ trợ retry cùng phiên trình duyệt. SĐT chưa OTP nên không xác minh quyền sở hữu. Cấu hình CAPTCHA/rate limit ở hosting trước khi public; xác nhận thể lệ và thông báo dữ liệu. Không công khai secret.

## Widget
Trong Admin chọn chiến dịch → Widget & tích hợp → bật widget, lưu danh sách origin HTTPS (www và non-www là hai origin), chọn floating/popup/inline rồi copy code. `/embed/<slug>` hiển thị widget thật. Tất cả chế độ chia sẻ cùng game engine. Widget chỉ xuất hiện khi chiến dịch đang mở, kiểm tra lại mỗi 60 giây; đang chơi vẫn có thể xem kết quả khi đóng. Trang nhúng sử dụng CSP frame-ancestors theo allowlist; landing và admin không cho framing. HMAC nguồn được cấp qua CORS; không phải xác minh danh tính người chơi. Thống kê impression/open đếm phiên widget, không phải unique users và có thể bị bot làm nhiễu. Khi website dùng CSP, cho phép origin LuckyDraw trong script-src, connect-src, frame-src; SDK sử dụng style nội tuyến. Đặt mã inline sau container hoặc chỉ định data-target. Không cần cookie bên thứ ba.

## Icon system
All UI icons use the pinned `lucide-react` package. Run `npm run icons:generate` after changes to the Widget icon set; `npm run icons:check` verifies generated SVGs. Widget assets are bundled at build time, with no runtime CDN. The wheel geometry and confetti are game graphics, not UI icons.

Registration origin validation supports Railway TLS termination through `RAILWAY_PUBLIC_DOMAIN`; configure `APP_PUBLIC_ORIGINS` (comma-separated HTTPS origins) for custom domains. Run `npm run test:signup-origin`.

### Reward editor (v9)
Apply `supabase/rewards_v9.sql` after previous migrations. New unique-code rewards derive their quantity from the number of distinct codes. Existing rewards retain their configured remaining quantity unless explicitly edited. Reward and voucher changes are atomic; codes already assigned to a different reward reject the entire save. Only the server role can call the RPC. Legacy endpoints remain for compatibility.

### Manual probability (v10)
Apply `supabase/odds_v10.sql`. New campaigns start with zero configured prize probability; owners save odds in Rewards (basis points, total <=10000). Existing campaigns retain legacy auto allocation until custom odds are saved. Exhausted rewards' odds go to no-win; other configured odds do not change. No exact winning counts are promised.

### Draw abuse protection (v11)
Apply `supabase/draw_limits_v11.sql`. Draw requests use Railway edge X-Real-IP (IPv6 /64), HMAC-pseudonymized buckets, phone quotas and a best-effort browser UUID. Limits: global IP 180/10 min, campaign IP 60/10 min, 30 distinct phones/IP/campaign/UTC day, 3 distinct phones/browser/campaign/UTC day, 30 attempts/phone/campaign/10 min. Shared IPs are not limited to one player. Fixed windows, opportunistic expiry cleanup. Local development uses a shared development bucket. Do not expose the app directly outside trusted Railway ingress. No OTP or proof of phone ownership; browser identifiers may be cleared, and VPNs can rotate IPs. For high-value rewards, add verified phone OTP and risk-based CAPTCHA. Review privacy/retention policy before production campaigns.

### Canonical player phone (v12)
Apply `supabase/phones_v12.sql` before deploying the app. Accept 0, 84 and +84 prefixes and persist only +84 followed by nine mobile digits. Existing valid records are converted in place; request IDs and prize history are preserved. Legacy recovery and short-lived quota hash keys remain compatible. No OTP or Turnstile.

### Widget unrestricted mode (v13)
Apply `supabase/widget_open_v13.sql`. An enabled widget with an empty allowlist can be embedded on any HTTPS website (or local HTTP for development). `*` in admin is normalized to an empty list. A nonempty allowlist remains restrictive. CORS reflects only a valid origin; only the embed route relaxes frame ancestors. Existing draw limits and stock protection remain in place.

### Safe widget preview
Admin widget settings display the actual SDK on a same-origin sample website for floating, popup and inline modes. Demo draws only simulate results in the browser, never call the draw or event POST endpoints, and do not use real customer data. Demo outcomes are illustrative, not a probability test. Full prize names remain visible below the wheel; wheels with more than five outcomes use numbered segments linked to the legend.

### Campaign publishing and SEO
Published campaigns expose server-rendered content, per-campaign title/description, canonical URL, Open Graph and Twitter metadata, a branded share image and sitemap entries. Draft/paused/ended campaigns are noindex; admin/embed/demo pages use X-Robots-Tag. Set APP_PUBLIC_URL to the preferred HTTPS canonical origin (Railway public domain is the fallback). Publishing displays a share dialog and a persistent share panel. Search engine indexing and social cache refresh are controlled by external platforms.
