import React, { useState, useEffect } from 'react';
import { Button, Input, Modal, radius, font } from '@trello/ui';
import { Flag, Plus, Trash2, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { api } from '../lib/api';

export function MilestonesManager({ boardId }) {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [description, setDescription] = useState('');

  const loadMilestones = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/boards/${boardId}/milestones`);
      setMilestones(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (boardId) loadMilestones();
  }, [boardId]);

  const handleCreate = async () => {
    if (!title.trim() || !targetDate) {
      alert('Vui lòng nhập tên cột mốc và ngày ấn định.');
      return;
    }
    try {
      await api.post(`/boards/${boardId}/milestones`, {
        title: title.trim(),
        targetDate,
        paymentAmount: paymentAmount ? Number(paymentAmount) : null,
        description,
      });
      setTitle('');
      setTargetDate('');
      setPaymentAmount('');
      setDescription('');
      setOpenModal(false);
      loadMilestones();
    } catch (err) {
      alert(err.message || 'Lỗi khi tạo cột mốc');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa cột mốc này?')) return;
    try {
      await api.delete(`/milestones/${id}`);
      loadMilestones();
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa cột mốc');
    }
  };

  const handleTogglePaid = async (m) => {
    try {
      await api.patch(`/milestones/${m.id}`, { isPaid: !m.isPaid });
      loadMilestones();
    } catch (err) {
      alert(err.message || 'Lỗi khi cập nhật trạng thái thu tiền');
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: radius.base, margin: '16px 24px', padding: 24, border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flag size={20} color="#eab308" /> Cột Mốc Milestone & Đợt Thu Tiền Dự Án
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Mỗi cột mốc là một ngày xác định (Single Date) để nghiệm thu giai đoạn và giải ngân thanh toán hợp đồng.
          </p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setOpenModal(true)}>
          Thêm Milestone Mới
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Đang nạp danh sách mốc Milestone...</div>
      ) : milestones.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: '#f8fafc', borderRadius: radius.base }}>
          Dự án chưa thiết lập cột mốc Milestone nào. Bấm nút "Thêm Milestone Mới" để bắt đầu.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {milestones.map((m) => (
            <div key={m.id} style={{ border: '1px solid #e2e8f0', borderRadius: radius.base, padding: 16, background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{m.title}</span>
                <button
                  onClick={() => handleDelete(m.id)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0', fontSize: 13, color: '#0284c7', fontWeight: 600 }}>
                <Clock size={15} /> Ngày ấn định: {new Date(m.targetDate).toLocaleDateString('vi-VN')}
              </div>

              {m.paymentAmount && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#16a34a', fontWeight: 700, marginBottom: 12 }}>
                  <DollarSign size={15} /> Số tiền thu: {Number(m.paymentAmount).toLocaleString('vi-VN')} VND
                </div>
              )}

              {m.description && (
                <p style={{ fontSize: 12, color: '#475569', margin: '0 0 12px 0' }}>{m.description}</p>
              )}

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: m.isPaid ? '#16a34a' : '#ea580c' }}>
                  {m.isPaid ? 'Đã thanh toán' : 'Chưa thu tiền'}
                </span>
                <Button size="sm" variant={m.isPaid ? 'secondary' : 'primary'} onClick={() => handleTogglePaid(m)}>
                  {m.isPaid ? 'Đánh dấu chưa thu' : 'Xác nhận đã thu tiền'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Thêm Milestone */}
      {openModal && (
        <Modal title="Thêm Cột Mốc Milestone Mới" open={openModal} onClose={() => setOpenModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '10px 0' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Tên cột mốc *</label>
              <Input placeholder="Ví dụ: Nghiệm thu Giai đoạn 1 & Thu 30% HĐ" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Ngày ấn định (Target Date - 1 ngày duy nhất) *</label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Số tiền dự kiến thu (VND)</label>
              <Input type="number" placeholder="50000000" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Ghi chú điều kiện nghiệm thu</label>
              <Input placeholder="Hoàn thành UAT và bàn giao tài liệu" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <Button variant="ghost" onClick={() => setOpenModal(false)}>Hủy</Button>
              <Button onClick={handleCreate}>Tạo Milestone</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
