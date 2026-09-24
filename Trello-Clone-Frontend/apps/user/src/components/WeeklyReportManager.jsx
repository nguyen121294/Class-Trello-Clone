import React, { useState, useEffect } from 'react';
import { Button, Input, Modal, radius, font } from '@trello/ui';
import { FileText, Sparkles, Download, Calendar, Plus, CheckCircle, Clock, Users, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

export function WeeklyReportManager({ boardId, board }) {
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);

  // Form checkin states
  const [doneText, setDoneText] = useState('');
  const [planText, setPlanText] = useState('');
  const [blockerText, setBlockerText] = useState('');
  const [hoursWorked, setHoursWorked] = useState('40');

  // Lịch họp mới
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTopic, setMeetingTopic] = useState('');
  const [meetingAttendees, setMeetingAttendees] = useState('');

  const loadReports = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/boards/${boardId}/weekly-reports`);
      setReports(res || []);
      if (res?.length > 0 && !activeReport) {
        loadReportDetails(res[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadReportDetails = async (id) => {
    try {
      const res = await api.get(`/weekly-reports/${id}`);
      setActiveReport(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (boardId) loadReports();
  }, [boardId]);

  // Nút bấm: "⚡ TẠO BÁO CÁO TUẦN TỰ ĐỘNG"
  const handleAutoGenerate = async () => {
    try {
      setGenerating(true);
      const res = await api.post(`/boards/${boardId}/weekly-reports/auto-generate`);
      setActiveReport(res);
      loadReports();
    } catch (err) {
      alert(err.message || 'Lỗi khi tạo báo cáo tự động');
    } finally {
      setGenerating(false);
    }
  };

  // Thêm cuộc họp vào báo cáo
  const handleAddMeeting = async () => {
    if (!meetingTopic.trim() || !meetingDate) return;
    const currentMeetings = Array.isArray(activeReport.meetings) ? activeReport.meetings : [];
    const updatedMeetings = [
      ...currentMeetings,
      { date: meetingDate, topic: meetingTopic.trim(), attendees: meetingAttendees.trim() },
    ];
    try {
      const res = await api.put(`/weekly-reports/${activeReport.id}`, { meetings: updatedMeetings });
      setActiveReport(res);
      setMeetingTopic('');
      setMeetingDate('');
      setMeetingAttendees('');
    } catch (err) {
      alert(err.message || 'Lỗi khi lưu lịch họp');
    }
  };

  // Nộp form chấm công tuần cho thành viên
  const handleSubmitCheckin = async () => {
    if (!doneText.trim() || !planText.trim()) {
      alert('Vui lòng điền những việc đã làm và dự kiến làm tuần tới.');
      return;
    }
    try {
      await api.post(`/boards/${boardId}/checkins`, {
        doneText,
        planText,
        blockerText,
        hoursWorked,
      });
      alert('Đã gửi báo cáo chấm công tuần thành công!');
      setCheckinOpen(false);
      setDoneText('');
      setPlanText('');
      setBlockerText('');
    } catch (err) {
      alert(err.message || 'Lỗi khi nộp form chấm công');
    }
  };

  // Xuất file PDF / Trang in chuẩn TMS
  const handleExportPdf = () => {
    if (!activeReport) return;
    const printUrl = `/api/weekly-reports/${activeReport.id}/pdf`;
    window.open(printUrl, '_blank');
  };

  const lastWeekTasks = activeReport?.tasks?.filter((t) => t.scopeType === 'last_week') || [];
  const thisWeekTasks = activeReport?.tasks?.filter((t) => t.scopeType === 'this_week') || [];

  return (
    <div style={{ background: '#fff', borderRadius: radius.base, margin: '16px 24px', padding: 24, border: '1px solid #e2e8f0' }}>
      {/* Header & Nút tạo tự động */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={20} color="#0284c7" /> Quản Lý Báo Cáo Tuần Dự Án
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Hệ thống tự động tính toán số tuần tới Golive, đối soát task tuần trước và xuất PDF theo mẫu dự án TMS.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" leftIcon={<Clock size={16} />} onClick={() => setCheckinOpen(true)}>
            Nộp Form Chấm Công Tuần (Team)
          </Button>

          <Button
            leftIcon={<Sparkles size={16} />}
            onClick={handleAutoGenerate}
            disabled={generating}
            style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#fff' }}
          >
            {generating ? 'Đang phân tích...' : '⚡ Tạo Báo Cáo Tuần Tự Động'}
          </Button>
        </div>
      </div>

      {/* Danh sách các tuần đã lập báo cáo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 6 }}>
        {reports.map((r) => (
          <button
            key={r.id}
            onClick={() => loadReportDetails(r.id)}
            style={{
              padding: '6px 14px', borderRadius: radius.base, fontSize: 12, cursor: 'pointer',
              fontWeight: activeReport?.id === r.id ? 700 : 500,
              background: activeReport?.id === r.id ? '#0284c7' : '#f1f5f9',
              color: activeReport?.id === r.id ? '#fff' : '#334155',
              border: 'none', whiteSpace: 'nowrap',
            }}
          >
            Tuần {r.weekNumber} ({new Date(r.startDate).toLocaleDateString('vi-VN')} - {new Date(r.endDate).toLocaleDateString('vi-VN')})
          </button>
        ))}
      </div>

      {activeReport ? (
        <div>
          {/* Khối KPI Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: radius.base, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Kỳ Báo Cáo</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>Tuần {activeReport.weekNumber} / {activeReport.year}</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: radius.base, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Milestone Gần Nhất</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                {activeReport.nearMilestone?.title || 'Chưa thiết lập'}
              </div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: radius.base, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Đếm Ngược Tới Golive</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0284c7', marginTop: 4 }}>
                {activeReport.weeksToGolive ? `${activeReport.weeksToGolive} tuần` : 'Chưa có ngày'}
              </div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: radius.base, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Button leftIcon={<Download size={16} />} onClick={handleExportPdf} style={{ width: '100%' }}>
                Xuất PDF / Gửi Khách
              </Button>
            </div>
          </div>

          {/* Bảng 1: Công việc tuần qua */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 10, textTransform: 'uppercase', borderLeft: '4px solid #0284c7', paddingLeft: 8 }}>
              1. Các công việc đã thực hiện trong tuần {activeReport.weekNumber}
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', borderBottom: '2px solid #cbd5e1' }}>Nội dung công việc</th>
                  <th style={{ padding: '8px 10px', borderBottom: '2px solid #cbd5e1' }}>Kết quả kỳ vọng</th>
                  <th style={{ padding: '8px 10px', borderBottom: '2px solid #cbd5e1' }}>Smartlog PIC</th>
                  <th style={{ padding: '8px 10px', borderBottom: '2px solid #cbd5e1' }}>Foodlog PIC</th>
                  <th style={{ padding: '8px 10px', borderBottom: '2px solid #cbd5e1' }}>Tình trạng</th>
                  <th style={{ padding: '8px 10px', borderBottom: '2px solid #cbd5e1' }}>Tiến độ</th>
                </tr>
              </thead>
              <tbody>
                {lastWeekTasks.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t.card?.title || 'Công việc'}</td>
                    <td style={{ padding: '8px 10px' }}>{t.expectedResult || '-'}</td>
                    <td style={{ padding: '8px 10px', color: '#0284c7', fontWeight: 500 }}>{t.internalPicsText || 'Smartlog PIC'}</td>
                    <td style={{ padding: '8px 10px', color: '#16a34a', fontWeight: 500 }}>{t.clientPicsText || 'Foodlog PIC'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: t.statusText === 'Done' ? '#dcfce7' : '#e0f2fe', color: t.statusText === 'Done' ? '#15803d' : '#0369a1' }}>
                        {t.statusText || 'Doing'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: t.progressEvaluation?.includes('Trễ') ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                      {t.progressEvaluation || 'Đúng tiến độ'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bảng 2: Kế hoạch tuần tới */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 10, textTransform: 'uppercase', borderLeft: '4px solid #16a34a', paddingLeft: 8 }}>
              2. Kế hoạch công việc tuần tiếp theo (Tuần {activeReport.weekNumber + 1})
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', borderBottom: '2px solid #cbd5e1' }}>Nội dung công việc</th>
                  <th style={{ padding: '8px 10px', borderBottom: '2px solid #cbd5e1' }}>Kết quả kỳ vọng</th>
                  <th style={{ padding: '8px 10px', borderBottom: '2px solid #cbd5e1' }}>Smartlog PIC</th>
                  <th style={{ padding: '8px 10px', borderBottom: '2px solid #cbd5e1' }}>Foodlog PIC</th>
                  <th style={{ padding: '8px 10px', borderBottom: '2px solid #cbd5e1' }}>Tình trạng</th>
                  <th style={{ padding: '8px 10px', borderBottom: '2px solid #cbd5e1' }}>Tiến độ</th>
                </tr>
              </thead>
              <tbody>
                {thisWeekTasks.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                      {t.card?.title || 'Công việc'}
                      {t.isCarriedOver && <span style={{ marginLeft: 6, fontSize: 10, background: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: 3 }}>Chuyển tiếp</span>}
                    </td>
                    <td style={{ padding: '8px 10px' }}>{t.expectedResult || '-'}</td>
                    <td style={{ padding: '8px 10px', color: '#0284c7', fontWeight: 500 }}>{t.internalPicsText || 'Smartlog PIC'}</td>
                    <td style={{ padding: '8px 10px', color: '#16a34a', fontWeight: 500 }}>{t.clientPicsText || 'Foodlog PIC'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: '#e0f2fe', color: '#0369a1' }}>
                        {t.statusText || 'Doing'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#16a34a', fontWeight: 600 }}>{t.progressEvaluation || 'Đúng tiến độ'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lịch họp trong tuần */}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 10, textTransform: 'uppercase', borderLeft: '4px solid #eab308', paddingLeft: 8 }}>
              3. Lịch họp & Thảo luận trong tuần
            </h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} style={{ width: 160 }} />
              <Input placeholder="Chủ đề cuộc họp (ví dụ: Review ma trận phân quyền)" value={meetingTopic} onChange={(e) => setMeetingTopic(e.target.value)} style={{ flex: 1 }} />
              <Input placeholder="Người tham dự (Mr. Sơn, Ms. Tố...)" value={meetingAttendees} onChange={(e) => setMeetingAttendees(e.target.value)} style={{ width: 220 }} />
              <Button leftIcon={<Plus size={15} />} onClick={handleAddMeeting}>Thêm họp</Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(Array.isArray(activeReport.meetings) ? activeReport.meetings : []).map((m, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#f8fafc', borderRadius: radius.base, border: '1px solid #e2e8f0', fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: '#0284c7' }}>{m.date}</span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{m.topic}</span>
                  <span style={{ color: '#64748b' }}>Tham gia: {m.attendees}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: '#f8fafc', borderRadius: radius.base }}>
          Chưa có báo cáo tuần nào. Nhấn nút <strong>"⚡ Tạo Báo Cáo Tuần Tự Động"</strong> để hệ thống tự động sinh báo cáo tuần này!
        </div>
      )}

      {/* Modal Chấm Công Tuần cho Thành Viên */}
      {checkinOpen && (
        <Modal title="Phiếu Khai Báo Tiến Độ & Chấm Công Tuần" open={checkinOpen} onClose={() => setCheckinOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '10px 0' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>1. Tuần này bạn đã làm được những gì? *</label>
              <textarea
                rows={3}
                style={{ width: '100%', padding: 8, borderRadius: radius.base, border: '1px solid #cbd5e1', fontSize: 13 }}
                placeholder="- Hoàn thành module Gantt chart&#10;- Fix lỗi kéo thả task"
                value={doneText}
                onChange={(e) => setDoneText(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>2. Tuần tới bạn sẽ làm những việc gì? *</label>
              <textarea
                rows={3}
                style={{ width: '100%', padding: 8, borderRadius: radius.base, border: '1px solid #cbd5e1', fontSize: 13 }}
                placeholder="- Viết tài liệu bàn giao&#10;- Hỗ trợ UAT với khách hàng"
                value={planText}
                onChange={(e) => setPlanText(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>3. Khó khăn hoặc cần hỗ trợ gì?</label>
              <textarea
                rows={2}
                style={{ width: '100%', padding: 8, borderRadius: radius.base, border: '1px solid #cbd5e1', fontSize: 13 }}
                placeholder="Cần bên khách hàng mở port firewall để test kết nối"
                value={blockerText}
                onChange={(e) => setBlockerText(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Số giờ làm việc ghi nhận (Hours)</label>
              <Input type="number" value={hoursWorked} onChange={(e) => setHoursWorked(e.target.value)} style={{ width: 120 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <Button variant="ghost" onClick={() => setCheckinOpen(false)}>Đóng</Button>
              <Button onClick={handleSubmitCheckin}>Gửi Báo Cáo Chấm Công</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
