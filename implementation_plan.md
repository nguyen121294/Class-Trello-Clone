# Kế hoạch Triển khai (Implementation Plan)
## Tích hợp Kiến trúc Phân quyền B2B RBAC 4 Tầng & Hệ thống Quản lý Tiến độ Gantt, Milestone, Báo cáo Tuần

> **Tài liệu tham chiếu:**
> - Đặc tả phân quyền: [CAU_TRUC_PHAN_QUYEN_RBAC_B2B.txt](file:///c:/Users/jackn/spyder/Class-Trello-Clone/CAU_TRUC_PHAN_QUYEN_RBAC_B2B.txt)
> - Đặc tả quy trình nghiệp vụ: [QT-01-quan-ly-tien-do-gantt-milestone-va-bao-cao-tuan.md](file:///c:/Users/jackn/spyder/Class-Trello-Clone/docs/flows/QT-01-quan-ly-tien-do-gantt-milestone-va-bao-cao-tuan.md)
> - Mẫu báo cáo tuần thực tế: `docs/W23 - 27_06_22 - Weekly Report _TMS Project.pptx`
> - Mô hình Prisma hiện tại: [schema.prisma](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/prisma/schema.prisma)

---

## 1. Mục tiêu & Phạm vi (Objectives & Scope)

Dự án mở rộng nền tảng Trello Clone hiện tại thành một giải pháp Quản trị Dự án Doanh nghiệp B2B SaaS toàn diện với hai trụ cột cốt lõi:

1. **Kiến trúc Phân quyền B2B Enterprise RBAC 4 Tầng & Cách ly Dữ liệu Multi-Tenant:**
   - **Tầng 0 (Platform Owner):** Kiểm soát Feature Flags toàn hệ thống, cấu hình gói tenant.
   - **Tầng 1 (Super Admin Doanh nghiệp):** Quản lý người dùng công ty, cấp phát hạn ngạch, phân quyền nội bộ.
   - **Tầng 2 (Executive / Phó Giám Đốc C):** Giám sát liên phòng ban (Cross-workspace), xem **Executive Overview Dashboard** và đọc chi tiết (Read-only) mọi Workspace mà không cần mời.
   - **Tầng 3 (Workspace & Board Level):** Giám đốc phòng ban (`ws_owner`/`ws_admin`), Nhân viên (`ws_member`) và Khách hàng (`client` / `observer` chế độ chỉ đọc).

2. **Hệ thống Quản lý Tiến độ Chuyên sâu (Gantt, Milestone & Báo cáo Tuần):**
   - Quản lý kho lưu trữ Google Drive gắn liền với từng Dự án (Board).
   - Thiết lập các cột mốc Milestone thu tiền cố định 1 ngày (`targetDate`).
   - Biểu đồ Gantt trực quan với liên kết phụ thuộc (Predecessor/Successor) và 2 chế độ kéo thả:
     + **Mode 1 (Cascade Push):** Giữ nguyên thời lượng, tự động tịnh tiến các task phụ thuộc nối sau.
     + **Mode 2 (Flexible Stretch):** Co dãn thời lượng tự do, thay đổi ngày bắt đầu/hạn chót độc lập.
   - Quản lý đa phụ trách (**Multiple PICs**): Phân định rõ **PIC nội bộ (Smartlog PIC)** và **PIC khách hàng (Foodlog PIC)**, gắn link Jira và kết quả kỳ vọng.
   - Vòng lặp Báo cáo Tuần với nút bấm **"⚡ Tạo Báo Cáo Tuần Tự Động"**:
     + Tự tính số tuần tới Golive & khoảng cách Milestone gần nhất.
     + Đối soát task tuần trước (trạng thái, số ngày trễ).
     + Tự động chuyển giao (Rollover) các task dở dang sang tuần mới.
     + Thu thập form chấm công/tiến độ tuần của thành viên team.
     + Lịch chọn cuộc họp trong tuần (Meeting Calendar Picker).
     + Xuất bản file PDF chuyên nghiệp chuẩn mẫu dự án TMS.
   - Phân hệ **Client Portal View**: Chế độ xem chỉ đọc an toàn dành riêng cho Khách hàng (Kanban, Dashboard, Gantt).

---

## 2. Phân tích Hiện trạng Hệ thống (Current State Analysis)

| Thành phần | Hiện trạng trong Codebase | Khoảng cách cần phát triển (Gap) |
|------------|---------------------------|----------------------------------|
| **Multi-Tenancy (Tổ chức)** | Bảng `users` ([schema.prisma:L13](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/prisma/schema.prisma#L13)) và `workspaces` ([schema.prisma:L144](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/prisma/schema.prisma#L144)) chưa có trường `org_id`. Chưa có model `Organization`. | Thêm bảng `organizations`, thêm khóa ngoại `org_id` vào `users` và `workspaces`. |
| **Hệ thống Roles** | File seed ([seed.js:L62-L78](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/db/seed.js#L62-L78)) chỉ có `super_admin`, `admin`, `support`, `user`, `ws_owner`, `ws_admin`, `ws_member`, `observer`. | Bổ sung các role chuẩn: `platform_owner`, `executive`, `client`. Cập nhật ma trận phân quyền. |
| **Feature Flags** | Bảng `settings` ([schema.prisma:L472](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/prisma/schema.prisma#L472)) chỉ lưu Key-Value chung. | Xây dựng middleware `requireFeature(key)` hỗ trợ `default_flags` và `tenant_overrides`. |
| **Cách ly dữ liệu (Isolation)** | Truy vấn workspace hiện tại chủ yếu theo `ownerId` hoặc bảng `user_roles`. | Bổ sung 2 tầng lọc bắt buộc: Tầng 1: `org_id`, Tầng 2: Scope Workspace (riêng `executive`/`super_admin` được bypass tầng 2 để đọc toàn bộ). |
| **Board / Dự án** | Bảng `boards` ([schema.prisma:L176](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/prisma/schema.prisma#L176)) đã có `isTemplate`, `visibility`. | Bổ sung `google_drive_url`, `golive_date`. |
| **Thẻ công việc (Card)** | Bảng `cards` ([schema.prisma:L258](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/prisma/schema.prisma#L258)) có `startDate`, `dueDate`. Bảng `card_members` ([schema.prisma:L338](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/prisma/schema.prisma#L338)) gán ngang hàng. | Bổ sung `jira_url`, `expected_result`. Bổ sung bảng `card_assignees` hỗ trợ đa PIC nội bộ và khách hàng. |
| **Milestone & Dependencies** | Chưa có trong Database. | Tạo mới bảng `milestones` và `card_dependencies`. |
| **Báo cáo Tuần & Chấm công** | Chưa có trong Database. | Tạo mới bảng `weekly_reports`, `weekly_report_tasks`, `member_weekly_checkins`. |
| **Frontend Views** | Đã có [BoardView.jsx](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Frontend/apps/user/src/pages/BoardView.jsx), [Dashboard.jsx](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Frontend/apps/user/src/pages/Dashboard.jsx). | Bổ sung: Executive Overview Dashboard, Tab Gantt Chart, Tab Milestones, Màn hình Báo cáo Tuần (với nút tự động tạo), Form chấm công tuần, và Client Portal View. |

---

## 3. Kiến trúc Chi tiết & Mô hình Kỹ thuật (Technical Specifications)

### 3.1. Thiết kế Cơ sở dữ liệu (Prisma Schema Updates)

Cần mở rộng [Trello-Clone-Backend/prisma/schema.prisma](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/prisma/schema.prisma):

```prisma
// 1. Tổ chức Doanh nghiệp (Multi-Tenancy)
model Organization {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  plan      String   @default("pro") // starter | pro | enterprise
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  users      User[]
  workspaces Workspace[]

  @@map("organizations")
}

// 2. Cập nhật User & Workspace với org_id
// User:
//   orgId String? @map("org_id") @db.Uuid
//   org   Organization? @relation(fields: [orgId], references: [id], onDelete: SetNull)
// Workspace:
//   orgId String? @map("org_id") @db.Uuid
//   org   Organization? @relation(fields: [orgId], references: [id], onDelete: Cascade)

// 3. Cập nhật Board
// Board:
//   googleDriveUrl String?   @map("google_drive_url")
//   goliveDate     DateTime? @map("golive_date") @db.Date
//   milestones     Milestone[]
//   weeklyReports  WeeklyReport[]
//   checkins       MemberWeeklyCheckin[]

// 4. Cột mốc Milestone thu tiền (Single Target Date)
model Milestone {
  id            String    @id @default(uuid()) @db.Uuid
  boardId       String    @map("board_id") @db.Uuid
  title         String
  targetDate    DateTime  @map("target_date") @db.Date
  paymentAmount Decimal?  @map("payment_amount") @db.Decimal(15, 2)
  isPaid        Boolean   @default(false) @map("is_paid")
  status        String    @default("pending") // pending | achieved | overdue | paid
  description   String?
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  board Board @relation(fields: [boardId], references: [id], onDelete: Cascade)

  @@index([boardId, targetDate])
  @@map("milestones")
}

// 5. Đa phụ trách (Multiple PICs - Internal & Client)
model CardAssignee {
  id           String   @id @default(uuid()) @db.Uuid
  cardId       String   @map("card_id") @db.Uuid
  userId       String?  @map("user_id") @db.Uuid
  externalName String?  @map("external_name") // Tên hiển thị (ví dụ: Ms. Tố, Mr. Khánh)
  assigneeType String   @default("internal") @map("assignee_type") // internal | client

  card Card  @relation(fields: [cardId], references: [id], onDelete: Cascade)
  user User? @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([cardId])
  @@map("card_assignees")
}

// 6. Phụ thuộc công việc (Task Dependencies)
model CardDependency {
  id            String @id @default(uuid()) @db.Uuid
  predecessorId String @map("predecessor_id") @db.Uuid
  successorId   String @map("successor_id") @db.Uuid
  type          String @default("FS") // FS: Finish-to-Start | SS: Start-to-Start

  predecessor Card @relation("PredecessorCard", fields: [predecessorId], references: [id], onDelete: Cascade)
  successor   Card @relation("SuccessorCard", fields: [successorId], references: [id], onDelete: Cascade)

  @@unique([predecessorId, successorId])
  @@map("card_dependencies")
}

// 7. Báo cáo tuần (Weekly Report)
model WeeklyReport {
  id              String   @id @default(uuid()) @db.Uuid
  boardId         String   @map("board_id") @db.Uuid
  weekNumber      Int      @map("week_number")
  year            Int
  startDate       DateTime @map("start_date") @db.Date
  endDate         DateTime @map("end_date") @db.Date
  nearMilestoneId String?  @map("near_milestone_id") @db.Uuid
  weeksToGolive   Decimal? @map("weeks_to_golive") @db.Decimal(5, 1)
  meetings        Json?    // Array: [{ date, topic, attendees, notes }]
  pdfUrl          String?  @map("pdf_url")
  status          String   @default("draft") // draft | published
  createdById     String   @map("created_by_id") @db.Uuid
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  board Board @relation(fields: [boardId], references: [id], onDelete: Cascade)
  tasks WeeklyReportTask[]

  @@unique([boardId, weekNumber, year])
  @@map("weekly_reports")
}

// 8. Nhiệm vụ trong báo cáo tuần (7 cột chuẩn mẫu TMS)
model WeeklyReportTask {
  id                 String  @id @default(uuid()) @db.Uuid
  reportId           String  @map("report_id") @db.Uuid
  cardId             String  @map("card_id") @db.Uuid
  scopeType          String  @map("scope_type") // last_week | this_week | special_module
  moduleName         String? @map("module_name") // Tích hợp, Auto Planning, ...
  expectedResult     String? @map("expected_result")
  internalPicsText   String? @map("internal_pics_text")
  clientPicsText     String? @map("client_pics_text")
  statusText         String? @map("status_text") // Done | Doing | Pending | Cancel
  progressEvaluation String? @map("progress_evaluation") // Đúng tiến độ | Trễ X ngày...
  isCarriedOver      Boolean @default(false) @map("is_carried_over")

  report WeeklyReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  card   Card         @relation(fields: [cardId], references: [id], onDelete: Cascade)

  @@index([reportId])
  @@map("weekly_report_tasks")
}

// 9. Biểu mẫu chấm công / Check-in tuần cho thành viên
model MemberWeeklyCheckin {
  id          String   @id @default(uuid()) @db.Uuid
  boardId     String   @map("board_id") @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  weekNumber  Int      @map("week_number")
  year        Int
  doneText    String   @map("done_text")
  planText    String   @map("plan_text")
  blockerText String?  @map("blocker_text")
  hoursWorked Decimal? @map("hours_worked") @db.Decimal(5, 1)
  status      String   @default("submitted") // draft | submitted
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  board Board @relation(fields: [boardId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([boardId, userId, weekNumber, year])
  @@map("member_weekly_checkins")
}
```

---

### 3.2. Thiết kế Backend RBAC & Data Isolation Middleware

1. **Feature Flags Engine ([featureFlags.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/middleware/featureFlags.js)):**
   - Đọc cấu hình JSONB từ bảng `settings` (`key = 'feature_flags'`), lưu cache Redis 5 phút.
   - Hỗ trợ cờ tính năng: `module_gantt`, `module_weekly_report`, `module_executive_dashboard`, `module_backup_gdrive`.
   - Middleware `requireFeature(featureKey)` chặn `403 Forbidden` khi cờ bị tắt.

2. **Multi-Tenant Data Isolation Guard ([tenantGuard.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/middleware/tenantGuard.js)):**
   - **Tầng 1 (Organization):** Mọi query tự động gán `WHERE orgId = req.user.orgId` (trừ `platform_owner`).
   - **Tầng 2 (Workspace Scope):**
     + Nếu `roles.includes('super_admin')` hoặc `roles.includes('platform_owner')`: Toàn quyền trong Org.
     + Nếu `roles.includes('executive')`: Tự động được phép **đọc tất cả Workspace** trong cùng Org ở chế độ Read-only. Chặn mọi thao tác Ghi/Sửa/Xóa (`403 Forbidden`).
     + Nếu `roles.includes('client')`: Chỉ được xem dữ liệu đã được gán hoặc public qua link chia sẻ an toàn.
     + Nếu là nhân viên thông thường: Bắt buộc `tenantId = workspaceId` hoặc `ownerId = user.id`.

3. **Gantt Drag-Drop Engine ([ganttService.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/modules/gantt/ganttService.js)):**
   - **Thuật toán Cycle Detection:** Dùng DFS kiểm tra đồ thị phụ thuộc để chặn vòng lặp phụ thuộc (E2).
   - **Chế độ 1 (Cascade Push):** Khi task A dịch chuyển $\Delta$ ngày:
     $$\text{newStart}_B = \max(\text{start}_B, \text{newDue}_A + 1)$$
     Tự động tịnh tiến toàn bộ chuỗi task phụ thuộc nối sau theo đồ thị DAG, giữ nguyên `duration`.
   - **Chế độ 2 (Flexible Stretch):** Chỉ cập nhật `startDate` hoặc `dueDate` của task hiện tại, cảnh báo nếu vi phạm ràng buộc tối thiểu.

4. **Weekly Report Auto-Generation Engine ([weeklyReportService.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/modules/weeklyReport/weeklyReportService.js)):**
   - Nút bấm **"Tạo Báo Cáo Tuần Tự Động"**:
     1. Xác định `weekNumber`, `year`, `startDate`, `endDate`.
     2. Tìm Milestone gần nhất $\ge$ ngày hiện tại và tính khoảng cách (ngày/tuần).
     3. Tính số tuần đếm lùi tới Golive: $(\text{goliveDate} - \text{now}) / 7$.
     4. Quét `weekly_report_tasks` của tuần trước:
        - Nếu status $\neq$ `Done`: Đánh dấu `isCarriedOver = true`, đưa vào danh sách tuần này.
        - Đánh giá tiến độ: So sánh ngày kết thúc thực tế với kế hoạch để sinh chuỗi text `Trễ tiến độ X ngày phần ...`.
     5. Nạp danh sách check-in của các thành viên trong tuần.

5. **PDF Export Service ([pdfExportService.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/modules/weeklyReport/pdfExportService.js)):**
   - Sinh file PDF chất lượng cao chuẩn mẫu PowerPoint TMS Project:
     - Slide 1: Bìa Báo cáo Tuần (Tên dự án, số tuần, ngày xuất bản).
     - Slide 2: Lộ trình tổng thể & Milestone đếm ngược Golive.
     - Slide 3: Bảng Công việc Tuần qua (7 cột: Thời gian, Nội dung, Kết quả kỳ vọng, Smartlog PIC, Foodlog PIC, Tình trạng, Tiến độ).
     - Slide 4: Bảng Kế hoạch Tuần tới (7 cột).
     - Slide 5: Lịch họp trong tuần & Quản lý rủi ro phát sinh.
   - Lưu trữ bản PDF vào MinIO S3 và trả link tải trực tiếp.

---

### 3.3. Thiết kế Frontend & Giao diện Người dùng

1. **Phân quyền Frontend (`usePermission` Hook & Dynamic Navigation):**
   - Đọc vai trò người dùng từ JWT & Context.
   - Điều hướng Menu:
     + `platform_owner`: Menu Quản trị Platform, Quản lý Doanh nghiệp, Cấu hình Feature Flags.
     + `super_admin`: Menu Nhân sự Doanh nghiệp, Phân quyền, Nhật ký Audit Log.
     + `executive`: Mặc định mở **Executive Overview Dashboard** (thống kê toàn bộ workspace/dự án trong công ty).
     + `ws_owner` / `ws_member`: Danh sách Workspace & Bảng Kanban của phòng ban.
     + `client`: Giao diện Client Portal chỉ đọc.

2. **Tab Gantt Chart trên [BoardView.jsx](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Frontend/apps/user/src/pages/BoardView.jsx):**
   - Header Toolbar: Nút chuyển chế độ kéo thả (Mode 1 / Mode 2), ô liên kết Google Drive (nhấp để mở tab mới), nút nạp Gantt Template.
   - Trục thời gian Gantt: Vẽ các thanh bar công việc kèm đường nối mũi tên quan hệ, cờ Milestone thu tiền màu vàng/xanh.
   - Modal chi tiết thẻ: Chọn nhiều PIC nội bộ, PIC khách hàng, liên kết Jira, kết quả kỳ vọng.

3. **Màn hình Báo cáo Tuần ([WeeklyReportView.jsx](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Frontend/apps/user/src/pages/WeeklyReportView.jsx)):**
   - Nút nổi bật: **"⚡ Tạo Báo Cáo Tuần Tự Động"**.
   - Khối chỉ số KPI: Milestone thu tiền gần nhất, số tuần cách Golive.
   - Bảng 7 cột tuần qua & tuần tới (cho phép chỉnh sửa trực tiếp inline hoặc kéo task).
   - Lịch chọn cuộc họp trong tuần (Meeting Calendar Picker).
   - Nút bấm xuất bản và tải file PDF.

4. **Biểu mẫu Chấm công & Check-in Tuần ([WeeklyCheckinModal.jsx](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Frontend/apps/user/src/components/WeeklyCheckinModal.jsx)):**
   - Popup/Form cho thành viên: 3 ô nhập (Đã làm gì? Sẽ làm gì? Khó khăn/Hỗ trợ?).
   - Ghi nhận số giờ làm việc trong tuần.

5. **Client Portal View ([ClientPortalView.jsx](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Frontend/apps/user/src/pages/ClientPortalView.jsx)):**
   - Màn hình chuyên dụng cho khách hàng truy cập qua URL an toàn `/portal/:shareToken`.
   - Chế độ chỉ xem (Read-only), gồm 3 tab: Bảng Kanban, Dashboard chỉ số và Biểu đồ Gantt.

---

## 4. Kế hoạch Triển khai theo Từng Giai đoạn (Phased Implementation Plan)

```mermaid
gantt
  title Lộ trình Triển khai Dự án
  dateFormat YYYY-MM-DD
  section Phase 1: Database & RBAC B2B
  Prisma Migration Organizations & Schema :p1_1, 2026-09-25, 2d
  Seed Data 4 Tầng & Feature Flags       :p1_2, after p1_1, 1d
  Backend Middleware RBAC & Isolation    :p1_3, after p1_2, 2d
  Executive Dashboard & Frontend Guards   :p1_4, after p1_3, 2d
  section Phase 2: Gantt & Milestone
  Backend API Milestone & Dependencies   :p2_1, after p1_4, 2d
  Gantt Drag-Drop Engine (Mode 1 & 2)    :p2_2, after p2_1, 2d
  Gantt UI Canvas/SVG trên BoardView     :p2_3, after p2_2, 3d
  section Phase 3: Báo cáo Tuần & PDF
  Engine Tự động Báo cáo & Rollover task :p3_1, after p2_3, 2d
  Form Chấm công Tuần cho Team          :p3_2, after p3_1, 1d
  PDF Export Engine chuẩn mẫu TMS        :p3_3, after p3_2, 2d
  WeeklyReportView UI & Calendar Picker  :p3_4, after p3_3, 2d
  section Phase 4: Client View & Testing
  Client Portal View Read-only           :p4_1, after p3_4, 2d
  Kiểm thử Toàn diện & Nghiệm thu        :p4_2, after p4_1, 2d
```

### Giai đoạn 1: Cơ sở Dữ liệu & Kiến trúc Phân quyền B2B RBAC 4 Tầng (Ước tính: Bước 1 - 4)
- **Công việc:**
  1. Cập nhật `schema.prisma`: Thêm `Organization`, khóa ngoại `org_id` vào `User` và `Workspace`. Thêm model `Milestone`, `CardAssignee`, `CardDependency`, `WeeklyReport`, `WeeklyReportTask`, `MemberWeeklyCheckin`.
  2. Tạo migration an toàn (bảo toàn dữ liệu hiện tại, tự động gán user/workspace hiện tại vào một Organization mặc định).
  3. Cập nhật seed file ([seed.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/db/seed.js)): Nạp đủ role `platform_owner`, `super_admin`, `executive`, `user`, `ws_owner`, `ws_admin`, `ws_member`, `client` và cấu hình feature flags ban đầu trong `settings`.
  4. Cập nhật [authenticate.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/middleware/authenticate.js) và [authorize.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/middleware/authorize.js): Hỗ trợ cách ly dữ liệu 2 tầng (Org & Workspace) và quyền bypass của `executive`.
  5. Xây dựng trang **Executive Overview Dashboard** trên Frontend và bộ điều hướng menu theo vai trò.
- **Tiêu chí nghiệm thu Giai đoạn 1:**
  - Executive đăng nhập thấy tổng quan toàn bộ Workspace của công ty ở chế độ Read-only.
  - Workspace A và B cách ly 100%, không truy cập chéo được dữ liệu của nhau.

### Giai đoạn 2: Quản lý Tiến độ Gantt, Google Drive & Cột mốc Milestone (Ước tính: Bước 5 - 8)
- **Công việc:**
  1. Xây dựng API quản lý Google Drive URL và Cột mốc Milestone (`/api/boards/:id/milestones`, `/api/boards/:id/drive-url`).
  2. Xây dựng API quản lý quan hệ phụ thuộc công việc (`/api/cards/:id/dependencies`) kèm thuật toán Cycle Detection.
  3. Xây dựng thuật toán dịch chuyển Gantt trên Backend: Mode 1 (Cascade Push) và Mode 2 (Flexible Stretch).
  4. Tích hợp Tab Gantt Chart và Tab Milestone vào giao diện [BoardView.jsx](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Frontend/apps/user/src/pages/BoardView.jsx).
  5. Cập nhật modal chỉnh sửa thẻ: Gán nhiều PIC nội bộ, PIC khách hàng, liên kết Jira, kết quả kỳ vọng.
- **Tiêu chí nghiệm thu Giai đoạn 2:**
  - Nhập link Google Drive mở ra tab mới chuẩn xác.
  - Kéo thả Mode 1 đẩy các task phụ thuộc phía sau mà không đổi duration; Mode 2 co dãn linh hoạt.

### Giai đoạn 3: Vòng lặp Báo cáo Tuần & Xuất bản PDF Chuẩn Mẫu TMS (Ước tính: Bước 9 - 12)
- **Công việc:**
  1. Xây dựng Biểu mẫu Check-in/Chấm công Tuần cho thành viên (API & Giao diện nộp báo cáo).
  2. Xây dựng Engine Nút bấm **"⚡ Tạo Báo Cáo Tuần Tự Động"**:
     - Tự tính Milestone gần nhất, số tuần cách Golive.
     - Tự động kéo task tuần trước, tính số ngày trễ, tự rollover các task dở dang.
     - Nạp nội dung chấm công của team.
  3. Xây dựng giao diện [WeeklyReportView.jsx](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Frontend/apps/user/src/pages/WeeklyReportView.jsx) với bảng 7 cột, Meeting Calendar Picker và ghi chú rủi ro.
  4. Xây dựng PDF Export Service bằng Puppeteer/HTML template kết xuất file PDF chất lượng cao đúng layout TMS Project (Bìa, Roadmap, Bảng 7 cột, Lịch họp).
- **Tiêu chí nghiệm thu Giai đoạn 3:**
  - Bấm 1 nút sinh ngay báo cáo tuần chính xác 80% dữ liệu.
  - Tải về file PDF sắc nét, chuyên nghiệp, sẵn sàng gửi khách hàng.

### Giai đoạn 4: Client Portal View & Kiểm thử Toàn diện (Ước tính: Bước 13 - 15) - [ĐÃ HOÀN TẤT]
- **Công việc:**
  1. Xây dựng trang [ClientPortalView.jsx](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Frontend/apps/user/src/pages/ClientPortalView.jsx) truy cập qua token an toàn.
  2. Khóa toàn bộ quyền sửa, ẩn thông tin nhạy cảm nội bộ (form chấm công, số tiền).
  3. Chạy toàn bộ kiểm thử bảo mật, kiểm thử quyền và kiểm thử hiệu năng.

### Giai đoạn 5: Tự Đăng ký Doanh nghiệp (SaaS Self-Serve Onboarding) & Định danh UPN (`username@company_code`)
- **Mục tiêu:**
  - Cho phép Khách hàng tự đăng ký Doanh nghiệp mới mà không cần can thiệp thủ công từ SaaS Platform Owner.
  - Tự động gán vai trò `super_admin` cho người sáng lập tổ chức và tạo sẵn Workspace mặc định.
  - Áp dụng mô hình định danh chuẩn **User Principal Name (UPN)**: `username@company_code` (ví dụ `admin@achau`, `ketoan@achau`).
  - Xóa bỏ triệt để nguy cơ xung đột trùng username giữa Khách hàng A và Khách hàng B mà không cần cấu hình Wildcard DNS/Subdomain phức tạp.
- **Công việc chi tiết:**
  1. **Database Schema:**
     - Mở rộng model `Organization` trong [schema.prisma](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/prisma/schema.prisma): Thêm trường `code String @unique` (Mã định danh viết liền không dấu, ví dụ: `achau`, `smartlog`).
     - Cập nhật [seed.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/db/seed.js) gán `code: "default"` cho Default Organization.
  2. **Backend Authentication & Service:**
     - Xây dựng Zod validation `registerOrgSchema`: Kiểm tra tên công ty, `orgCode` (regex: `^[a-z0-9-]+$`), `username`, `password`, `name`.
     - Thêm API kiểm tra mã công ty khả dụng: `GET /api/auth/check-org-code?code=...`.
     - Xây dựng hàm `registerOrganization` trong [auth.service.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/modules/auth/auth.service.js):
       + Database Transaction nguyên tử:
         1. Kiểm tra tính duy nhất của `orgCode`.
         2. Tạo `Organization` (`name`, `code`, `plan: "starter"`).
         3. Tạo `User` với định danh UPN `${username}@${orgCode}`.
         4. Gán role `super_admin` trong phạm vi Organization (`tenantId: null`).
         5. Tạo Workspace mặc định: `"Không gian làm việc chung"`, `ownerId = user.id`, `orgId = org.id`.
         6. Gán role `ws_owner` trên Workspace mặc định.
         7. Ký phát JWT tokens và trả về phiên đăng nhập ngay lập tức.
     - Cập nhật hàm `login` trong [auth.service.js](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Backend/src/modules/auth/auth.service.js): Cho phép đăng nhập mượt mà bằng UPN (`nhanvien@ctyA`) hoặc Email truyền thống.
     - Cập nhật endpoint thêm thành viên nội bộ: Tự động hỗ trợ hậu tố `@${currentUserOrg.code}`.
  3. **Frontend User App:**
     - Xây dựng trang [RegisterOrg.jsx](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Frontend/apps/user/src/pages/RegisterOrg.jsx):
       + Form đăng ký doanh nghiệp thân thiện với người dùng.
       + Tự động chuyển đổi Tên công ty sang Mã định danh không dấu (Slug generator).
       + Debounce API check tính khả dụng của mã công ty realtime.
       + Khối hiển thị xem trước trực quan: *Tài khoản quản trị của bạn: `admin@mã_cty`*.
       + Bấm Đăng ký -> Chuyển thẳng vào Workspace làm việc.
     - Cập nhật [Login.jsx](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Frontend/apps/user/src/pages/Login.jsx): Thêm nút *"Đăng ký Doanh nghiệp mới"* và gợi ý định dạng `username@cty`.
     - Đăng ký route `/register-org` trong [App.jsx](file:///c:/Users/jackn/spyder/Class-Trello-Clone/Trello-Clone-Frontend/apps/user/src/App.jsx).

---

## 5. Đánh giá Rủi ro & Giải pháp Kiểm soát (Risk Management)

| Rủi ro kỹ thuật | Mức độ | Biện pháp kiểm soát & Giải pháp |
|-----------------|:------:|----------------------------------|
| **Xung đột Migration khi thêm `org_id` & `code`** | Cao | Viết migration script có bước khởi tạo Organization mặc định (`Default Org` với `code: "default"`), gán toàn bộ người dùng và workspace hiện tại vào Org này trước khi áp dụng ràng buộc `NOT NULL`. |
| **Vòng lặp phụ thuộc vô tận (Circular Dependency)** | Trung bình | Áp dụng thuật toán kiểm tra chu trình đồ thị có hướng (Cycle Detection - DFS) ngay tại tầng API trước khi lưu quan hệ phụ thuộc. |
| **Tính toán Gantt tịnh tiến bị giật lag** | Trung bình | Tách logic tính toán: Frontend phản hồi lạc quan (Optimistic UI) bằng requestAnimationFrame, Backend xác nhận và cập nhật batch qua giao dịch Prisma transaction. |
| **Khách hàng gõ sai cú pháp mã công ty** | Thấp | Regex tự động chuẩn hóa lowercase, loại bỏ dấu tiếng Việt và ký tự đặc biệt ngay khi người dùng gõ trên Frontend và validate chặt chẽ tại Zod schema trên Backend. |

---

## 6. Quyết định & Bước tiếp theo (Next Action)

Kế hoạch bổ sung Giai đoạn 5 đã được cập nhật chi tiết và tuân thủ nghiêm ngặt **Write Guard Policy** của hệ thống. 

👉 **Xin mời bạn xem xét kế hoạch triển khai Giai đoạn 5 trên. Khi bạn duyệt ("Tiến hành" / "Approved"), tôi sẽ bắt đầu thực thi code (Cập nhật Schema `Organization.code`, Backend API `/register-org` và Giao diện `RegisterOrg.jsx`).**
