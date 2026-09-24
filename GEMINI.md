# Project Rules & Policies for Gemini (Antigravity)

Hệ thống quy chuẩn vận hành và rào chắn an toàn cho Google Antigravity.

---

## 1. Write Guard Policy (BẮT BUỘC)
- **Tuyệt đối KHÔNG** xóa, ghi đè hoặc chỉnh sửa file mã nguồn nếu không có yêu cầu cụ thể, rõ ràng từ người dùng.
- Khi có các thay đổi kiến trúc hoặc tác động đến nhiều file lớn, **bắt buộc** phải lập kế hoạch (`implementation_plan.md`) và được người dùng duyệt trước khi thực thi.
- Không tự ý giả lập code hay đoán mò: Mọi khẳng định kiến trúc phải được trích dẫn chính xác đường dẫn file và dòng code (`file:line`).

## 2. Kỷ luật Token & Context (Token Discipline)
- Phản hồi ngắn gọn, súc tích, đi thẳng vào giải pháp và code.
- Không lặp lại toàn bộ nội dung file khi sửa đổi, ưu tiên sử dụng diff hoặc cập nhật từng khối (chunk).
- Tận dụng cơ chế **Progressive Disclosure**: Chỉ đọc các tài liệu sâu trong `references/` khi thực sự cần giải quyết tác vụ liên quan.

## 3. Giới hạn Multi-Agent
- Khi chia việc chạy song song các sub-agent, tối đa **5 agent đồng thời** để tránh nghẽn luồng và lãng phí tài nguyên.

## 4. Quy chuẩn đặt tên & Cấu trúc
- Tuân thủ quy chuẩn đặt tên biến, API route, database column, cache key theo hướng dẫn trong `.agents/rules/naming-conventions.md`.
- Giữ cấu trúc thư mục phân lớp rõ ràng (Layered / Modular Monolith).
