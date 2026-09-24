import { prisma } from "../../config/db.js";
import { NotFound, BadRequest } from "../../lib/errors.js";

export async function listMilestones(boardId) {
  return prisma.milestone.findMany({
    where: { boardId },
    orderBy: { targetDate: "asc" },
  });
}

export async function createMilestone(boardId, { title, targetDate, paymentAmount, description }) {
  if (!title || !title.trim()) throw BadRequest("Tên cột mốc Milestone là bắt buộc.");
  if (!targetDate) throw BadRequest("Ngày ấn định cột mốc (Target Date) là bắt buộc.");

  const target = new Date(targetDate);
  if (isNaN(target.getTime())) throw BadRequest("Định dạng ngày không hợp lệ.");

  return prisma.milestone.create({
    data: {
      boardId,
      title: title.trim(),
      targetDate: target,
      paymentAmount: paymentAmount !== undefined && paymentAmount !== null ? Number(paymentAmount) : null,
      description: description?.trim() || null,
      status: "pending",
      isPaid: false,
    },
  });
}

export async function updateMilestone(id, { title, targetDate, paymentAmount, isPaid, status, description }) {
  const existing = await prisma.milestone.findUnique({ where: { id } });
  if (!existing) throw NotFound("Không tìm thấy cột mốc Milestone.");

  const data = {};
  if (title !== undefined) data.title = title.trim();
  if (targetDate !== undefined) {
    const target = new Date(targetDate);
    if (isNaN(target.getTime())) throw BadRequest("Định dạng ngày không hợp lệ.");
    data.targetDate = target;
  }
  if (paymentAmount !== undefined) data.paymentAmount = paymentAmount !== null ? Number(paymentAmount) : null;
  if (isPaid !== undefined) {
    data.isPaid = Boolean(isPaid);
    if (data.isPaid && (!status || status === "pending")) data.status = "paid";
  }
  if (status !== undefined) data.status = status;
  if (description !== undefined) data.description = description;

  return prisma.milestone.update({
    where: { id },
    data,
  });
}

export async function deleteMilestone(id) {
  const existing = await prisma.milestone.findUnique({ where: { id } });
  if (!existing) throw NotFound("Không tìm thấy cột mốc Milestone.");

  return prisma.milestone.delete({ where: { id } });
}
