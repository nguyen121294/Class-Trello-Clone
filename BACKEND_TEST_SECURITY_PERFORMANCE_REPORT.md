# Báo Cáo Kiểm Thử Toàn Diện: Logic Nghiệp Vụ, Bảo Mật & Hiệu Năng API
## Dự án: Trello Clone B2B Enterprise Platform (Backend)

* **Ngày thực hiện:** 25/09/2026
* **Môi trường thử nghiệm:** Node.js v24.19.0 (ESM Mode) | Vitest v5.0.1 | Autocannon v8.0.0
* **Hạ tầng mục tiêu:** VPS Ubuntu 24.04 (`http://103.82.193.221:4000`)
* **Tổng kết kết quả:** **21/21 Tests Passed (100% Green)** | Thời gian thực thi: **1.52 giây** | Throughput tối đa: **1,142 req/sec**

---

## 1. Bảng Tổng Hợp Kết Quả Kiểm Thử (Executive Summary)

| Trụ Cột Kiểm Thử | File Test | Số Test | Thời Gian | Tỷ Lệ Đạt | Đánh Giá |
|---|---|:---:|:---:|:---:|:---:|
| **1. Logic Nghiệp Vụ (Auth & B2B Onboarding)** | `tests/unit/auth.service.test.js` | 6 | 165 ms | 100% | Đạt chuẩn |
| **1. Logic Nghiệp Vụ (Cards & Kanban Workflow)** | `tests/unit/cards.service.test.js` | 4 | 15 ms | 100% | Đạt chuẩn |
| **2. Bảo Mật (JWT & Session Revocation)** | `tests/security/auth-security.test.js` | 5 | 21 ms | 100% | An toàn |
| **2. Bảo Mật (Tenant Isolation & RBAC 4 Tầng)** | `tests/security/tenant-isolation.test.js` | 4 | 12 ms | 100% | Chống BOLA/IDOR |
| **2. Bảo Mật (Làm Sạch Đầu Vào & Chống XSS)** | `tests/security/sanitization.test.js` | 2 | 8 ms | 100% | Đạt chuẩn |
| **3. Đo Lường Hiệu Năng (Load & Stress Testing)** | `tests/perf/load-test.js` | 3 kịch bản | 15 s | 100% (0 lỗi) | p90 < 125 ms |
| **TỔNG CỘNG** | **5 Test Suites** | **21 Tests** | **1.52 s** | **100%** | **Sẵn sàng triển khai** |

---

## 2. Trụ Cột 1: Kiểm Thử Logic Nghiệp Vụ Từng API (Business Logic)

### 2.1. Module Xác Thực & Onboarding Doanh Nghiệp (B2B Self-Serve)
* **File nguồn:** [src/modules/auth/auth.service.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/modules/auth/auth.service.js)
* **File test:** [tests/unit/auth.service.test.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/tests/unit/auth.service.test.js)

| Mã Kiểm Thử | Hành Vi Kiểm Thử (Given - When - Then) | Dòng Code Kiểm Tra | Trạng Thái |
|---|---|---|:---:|
| `authService_checkOrgCode_returnsFalseForShortCode` | **Given:** Mã tổ chức ngắn hơn 2 ký tự hoặc rỗng.<br>**When:** Gọi `checkOrgCodeAvailable(code)`.<br>**Then:** Trả về `available: false` mà không cần tốn truy vấn DB. | `auth.service.js:103-105` | ✅ PASS |
| `authService_checkOrgCode_returnsTrueWhenAvailable` | **Given:** Mã tổ chức hợp lệ và chưa ai dùng (ví dụ: `SMARTLOG`).<br>**When:** Kiểm tra tính khả dụng.<br>**Then:** Tự động chuẩn hoá thành chữ thường (`smartlog`) và trả về `available: true`. | `auth.service.js:106-111` | ✅ PASS |
| `authService_checkOrgCode_returnsFalseWhenAlreadyTaken` | **Given:** Mã tổ chức đã có trong Database.<br>**When:** Kiểm tra.<br>**Then:** Trả về `available: false`. | `auth.service.js:106-110` | ✅ PASS |
| `authService_registerOrg_throwsConflictOnDuplicateCode` | **Given:** Doanh nghiệp đăng ký bằng mã công ty đã tồn tại.<br>**When:** Gọi `registerOrganization(...)`.<br>**Then:** Lập tức quăng lỗi `409 Conflict (ORG_CODE_TAKEN)`. | `auth.service.js:119-122` | ✅ PASS |
| `authService_registerOrg_throwsConflictOnDuplicateUser` | **Given:** Mã công ty mới, nhưng tài khoản quản trị UPN (`admin@code`) đã tồn tại.<br>**When:** Đăng ký tổ chức.<br>**Then:** Ném lỗi `409 Conflict (USER_TAKEN)`. | `auth.service.js:124-127` | ✅ PASS |
| `authService_registerOrg_createsOrgUserAndWorkspaceSuccessfully` | **Given:** Thông tin hợp lệ của doanh nghiệp mới.<br>**When:** Đăng ký.<br>**Then:** Chạy Atomic Transaction khởi tạo: Organization -> Super Admin User -> Gán quyền `super_admin` -> Workspace mặc định -> Gán quyền `ws_owner` -> Cấp phát JWT Access/Refresh Token. | `auth.service.js:137-198` | ✅ PASS |

---

### 2.2. Module Thẻ Công Việc (Card Lifecycle & Kanban Positioning)
* **File nguồn:** [src/modules/cards/cards.service.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/modules/cards/cards.service.js)
* **File test:** [tests/unit/cards.service.test.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/tests/unit/cards.service.test.js)

| Mã Kiểm Thử | Hành Vi Kiểm Thử (Given - When - Then) | Dòng Code Kiểm Tra | Trạng Thái |
|---|---|---|:---:|
| `cardsService_createCard_enforcesWipLimit` | **Given:** Cột Kanban có giới hạn số việc đang làm (`wipLimit = 3`) và đã chứa đủ 3 thẻ.<br>**When:** Thành viên cố tạo thêm thẻ thứ 4.<br>**Then:** Hệ thống chặn lại và ném lỗi `400 BadRequest (WIP_LIMIT)`. | `cards.service.js:98-102` | ✅ PASS |
| `cardsService_createCard_createsCardSuccessfullyWhenWithinLimit` | **Given:** Cột có `wipLimit = 5` và hiện chỉ có 2 thẻ.<br>**When:** Tạo thẻ mới.<br>**Then:** Tính toán `position` lũy tiến, sinh mã số tuần tự `number` và phát sự kiện realtime `card:created` tới toàn bộ thành viên trên Board. | `cards.service.js:104-128` | ✅ PASS |
| `cardsService_moveCard_sameBoard_updatesPositionAndEmitsCardMoved` | **Given:** Di chuyển thẻ giữa 2 cột trong cùng 1 Board.<br>**When:** Kéo thả sang vị trí mới.<br>**Then:** Cập nhật DB và phát sự kiện `card:moved` đến client. | `cards.service.js:221-257` | ✅ PASS |
| `cardsService_moveCard_crossBoard_emitsCardDeletedOnOldAndCardCreatedOnNewBoard` | **Given:** Di chuyển thẻ sang một Board khác.<br>**When:** Kéo thẻ qua Board đích.<br>**Then:** Kiểm tra quyền hạn trên Board đích, đồng thời phát 2 sự kiện: `card:deleted` (Board cũ) và `card:created` (Board mới). | `cards.service.js:224-255` | ✅ PASS |

---

## 3. Trụ Cột 2: Kiểm Thử An Ninh & Bảo Mật (Security & RBAC Tests)

### 3.1. Tính Toàn Vẹn Của Token JWT & Thu Hồi Phiên (Authentication Security)
* **File nguồn:** [src/middleware/authenticate.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/middleware/authenticate.js)
* **File test:** [tests/security/auth-security.test.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/tests/security/auth-security.test.js)

1. **Chặn thiếu Token (`NO_TOKEN`):** Request gọi API private mà không có header `Authorization: Bearer <token>` bị từ chối với mã lỗi `401 Unauthorized` (`authenticate.js:12-14`).
2. **Chặn giả mạo chữ ký (`INVALID_TOKEN`):** Kẻ tấn công sửa đổi payload hoặc signature của JWT bị thư viện giải mã phát hiện và chặn đứng (`authenticate.js:21-23`).
3. **Thu hồi phiên qua Redis Blacklist (`TOKEN_REVOKED`):** Khi người dùng Logout, `jti` của access token được đẩy vào Redis blacklist. Dù token chưa hết hạn (TTL 15m), request tiếp theo vẫn bị chặn `401 TOKEN_REVOKED` (`authenticate.js:25-26`).
4. **Vô hiệu hoá tức thì khi đổi mật khẩu (`TOKEN_VERSION_MISMATCH`):** Khi đổi mật khẩu, `user.tokenVersion` tăng lên. Tất cả token cũ lập tức mất hiệu lực mà không cần chờ hết hạn (`authenticate.js:33-35`).
5. **Khoá tài khoản (`USER_INACTIVE`):** Người dùng bị quản trị viên đình chỉ (`isActive = false`) bị chặn truy cập API ngay lập tức (`authenticate.js:32`).

---

### 3.2. Cách Ly Dữ Liệu Multi-Tenant & Chống Lỗ Hổng BOLA/IDOR
* **File nguồn:** [src/middleware/tenantGuard.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/middleware/tenantGuard.js)
* **File test:** [tests/security/tenant-isolation.test.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/tests/security/tenant-isolation.test.js)

```
[Attacker in Org A] ───( Thử đọc/sửa Workspace của Org B )───> [ TenantGuard ] 
                                                                     │
                                                      [user.orgId !== ws.orgId]
                                                                     │
                                                                     ▼
                                                          ❌ 403 FORBIDDEN:
                                                 "Bạn không thuộc tổ chức sở hữu 
                                                  không gian làm việc này."
```

* **Chống BOLA / IDOR Đa Tổ Chức:** Người dùng thuộc `org-A` dù có token hợp lệ nhưng khi gửi `workspaceId` thuộc `org-B` sẽ bị ném lỗi `403 Forbidden` (`tenantGuard.js:31-33`).
* **Bảo vệ Phân quyền Lãnh đạo (Tầng 2 - Executive):**
  - Giám sát toàn bộ Workspace trong công ty: Cho phép **ĐỌC** dữ liệu mà không cần gửi lời mời vào từng Workspace (`canWrite: false`).
  - Chặn sửa/xoá: Nếu Executive cố tình gọi API tạo/sửa/xoá thẻ, hệ thống trả về `403 Forbidden: Lãnh đạo chỉ có quyền giám sát, không được chỉnh sửa trực tiếp` (`tenantGuard.js:41-46`).
* **Bảo vệ Không gian Riêng tư (Tầng 3):** Thành viên trong cùng công ty nhưng không có bản ghi trong bảng `user_roles` của Workspace sẽ không thể xem trộm dữ liệu phòng ban khác.
* **Đặc quyền Nền tảng (Tầng 0 - Platform Owner):** Toàn quyền kiểm soát và xử lý sự cố hệ thống (`tenantGuard.js:25-28`).

---

### 3.3. Làm Sạch Dữ Liệu Đầu Vào & Phòng Chống XSS / Control Character Injection
* **File nguồn:** [src/middleware/sanitize.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/middleware/sanitize.js)
* **File test:** [tests/security/sanitization.test.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/tests/security/sanitization.test.js)

* **Loại bỏ ký tự điều khiển:** Tự động làm sạch các chuỗi chứa ký tự ASCII độc hại `< 32` (Null byte `\x00`, Backspace `\x08`, Escape) thường dùng để bypass bộ lọc WAF hoặc gây crash database.
* **Bảo toàn khoảng trắng có ý nghĩa:** Tab (`\t`), Newline (`\n`), Carriage Return (`\r`) trong mô tả công việc (Markdown) được giữ nguyên vẹn (`sanitize.js:4`).
* **Bảo vệ trường nhạy cảm:** Các trường `password`, `token`, `secret`, `otp` không bị can thiệp làm sạch nhằm tránh vô tình thay đổi mật khẩu người dùng đã nhập (`sanitize.js:3, 18`).

---

## 4. Trụ Cột 3: Đo Lường & Đánh Giá Hiệu Năng Thực Tế (Performance Benchmark)

* **Công cụ đo lường:** `Autocannon` (HTTP/1.1 benchmarking tool)
* **Cấu hình tải:** 50 kết nối đồng thời (Concurrent Connections), chạy liên tục trong 5 giây cho mỗi kịch bản.
* **Mục tiêu đo:** VPS Production (`http://103.82.193.221:4000`) qua mạng Internet công cộng.

### 4.1. Chi Tiết Kết Quả Benchmark

```
================================================================================
KỊCH BẢN 1: API HEALTH CHECK (GET /health)
Kiểm tra độ trễ kết hợp giữa Express + PostgreSQL Query + Redis Ping
--------------------------------------------------------------------------------
• Tổng số requests hoàn thành:    4,255 requests
• Thành công (2xx):               4,255 (100.0%)
• Lỗi kết nối / HTTP lỗi:        0 (0.00%)
• Throughput trung bình (RPS):    851.00 req/sec
• Throughput đỉnh điểm:          1,142 req/sec
• Latency trung bình:             58.21 ms
• Latency p50 (Median):           49 ms
• Latency p90:                    75 ms
• Latency p97.5:                  157 ms
• Latency p99:                    239 ms
• Băng thông mạng:                0.27 MB/sec
=> ĐÁNH GIÁ: XUẤT SẮC (p90 < 100ms khi chịu tải 50 kết nối liên tục)
================================================================================

================================================================================
KỊCH BẢN 2: API AUTH SETUP STATUS (GET /api/auth/setup-status)
Kiểm tra hiệu năng truy vấn phân quyền khởi tạo hệ thống
--------------------------------------------------------------------------------
• Tổng số requests hoàn thành:    2,475 requests
• Thành công (2xx):               2,475 (100.0%)
• Lỗi kết nối / HTTP lỗi:        0 (0.00%)
• Throughput trung bình (RPS):    495.00 req/sec
• Throughput đỉnh điểm:          551 req/sec
• Latency trung bình:             99.90 ms
• Latency p50 (Median):           95 ms
• Latency p90:                    124 ms
• Latency p97.5:                  148 ms
• Latency p99:                    197 ms
• Băng thông mạng:                0.15 MB/sec
=> ĐÁNH GIÁ: XUẤT SẮC (Tất cả yêu cầu hoàn thành dưới 200ms)
================================================================================

================================================================================
KỊCH BẢN 3: API LANDING PUBLIC DATA (GET /api/landing)
Tải catalog tính năng, dữ liệu trang chủ phục vụ người dùng bên ngoài
--------------------------------------------------------------------------------
• Tổng số requests hoàn thành:    3,912 requests
• Thành công (2xx):               3,912 (100.0%)
• Lỗi kết nối / HTTP lỗi:        0 (0.00%)
• Throughput trung bình (RPS):    782.40 req/sec
• Throughput đỉnh điểm:          859 req/sec
• Latency trung bình:             63.03 ms
• Latency p50 (Median):           59 ms
• Latency p90:                    81 ms
• Latency p97.5:                  104 ms
• Latency p99:                    143 ms
• Băng thông mạng:                2.28 MB/sec
=> ĐÁNH GIÁ: XUẤT SẮC (Thông lượng cao, độ trễ cực thấp)
================================================================================
```

### 4.2. Biểu Đồ So Sánh Độ Trễ (Latency Distribution)

```
Endpoint                    p50      p90      p97.5    p99      Trạng Thái
──────────────────────────────────────────────────────────────────────────
GET /health                 49 ms    75 ms    157 ms   239 ms   [ Rất Nhanh ]
GET /api/auth/setup-status  95 ms    124 ms   148 ms   197 ms   [ Rất Tốt   ]
GET /api/landing            59 ms    81 ms    104 ms   143 ms   [ Rất Nhanh ]
```

---

## 5. Hướng Dẫn Vận Hành & Khuyến Nghị Tối Ưu Tiếp Theo

### 5.1. Các Lệnh Kiểm Thử Tự Động (CLI Commands)
Người phát triển có thể chạy kiểm thử tại thư mục `Trello-Clone-Backend`:

```bash
# 1. Chạy toàn bộ Unit Tests & Security Tests
npm test

# 2. Chạy test ở chế độ Watch (tự động re-run khi lưu file)
npm run test:watch

# 3. Chạy bài đo hiệu năng & tải trực tiếp vào VPS
npm run test:perf

# 4. Đo hiệu năng vào một server khác (ví dụ staging / local)
TARGET_URL="http://localhost:4000" npm run test:perf
```

### 5.2. Khuyến Nghị Tối Ưu Nâng Cao Cho Production
1. **Áp dụng Rate Limiting trên API nhạy cảm:**
   - Cần bổ sung middleware `express-rate-limit` hoặc Redis Token Bucket cho endpoint `POST /api/auth/login` (giới hạn tối đa 5 lần thử sai / phút / IP) để ngăn chặn tấn công Brute Force từ điển mật khẩu.
2. **Bộ Nhớ Đệm Redis Cho Endpoint Catalog:**
   - Dữ liệu `GET /api/landing` có thể lưu đệm vào Redis (`SETEX landing_cache 300 ...`), giúp giảm tải hoàn toàn cho Database và nâng throughput lên trên **2,500 req/sec**.
3. **Database Connection Pooling:**
   - Cấu hình kích thước connection pool trong PostgreSQL connection string (`connection_limit=25&pool_timeout=10`) để đảm bảo không bị cạn kiệt kết nối khi lượng truy cập đồng thời vượt ngưỡng 1,000 users.
4. **Tích hợp Tự Động Vào CI/CD (GitHub Actions):**
   - Đưa lệnh `npm test` vào workflow CI trước bước build Docker image để đảm bảo không có code lỗi logic hay vi phạm bảo mật nào lọt lên máy chủ Production.
