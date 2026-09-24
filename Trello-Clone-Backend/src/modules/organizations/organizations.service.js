import { prisma } from "../../config/db.js";
import { NotFound, BadRequest } from "../../lib/errors.js";

export async function listOrganizations() {
  return prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { users: true, workspaces: true },
      },
    },
  });
}

export async function getOrganizationById(id) {
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, email: true, name: true, isActive: true },
      },
      workspaces: {
        select: { id: true, name: true, isLocked: true },
      },
    },
  });
  if (!org) throw NotFound("Không tìm thấy tổ chức.");
  return org;
}

export async function createOrganization({ name, plan = "pro" }) {
  if (!name || !name.trim()) throw BadRequest("Tên tổ chức là bắt buộc.");
  return prisma.organization.create({
    data: {
      name: name.trim(),
      plan,
      isActive: true,
    },
  });
}

export async function updateOrganization(id, data) {
  return prisma.organization.update({
    where: { id },
    data,
  });
}

export async function getExecutiveOverview(user) {
  const orgId = user.orgId;
  const whereOrg = orgId ? { orgId } : {};

  const [totalWorkspaces, totalBoards, totalCards, workspaces] = await Promise.all([
    prisma.workspace.count({ where: whereOrg }),
    prisma.board.count({
      where: orgId ? { workspace: { orgId } } : {},
    }),
    prisma.card.count({
      where: orgId ? { list: { board: { workspace: { orgId } } } } : {},
    }),
    prisma.workspace.findMany({
      where: whereOrg,
      select: {
        id: true,
        name: true,
        isLocked: true,
        owner: { select: { id: true, name: true, email: true } },
        boards: {
          select: {
            id: true,
            name: true,
            goliveDate: true,
            _count: { select: { lists: true } },
          },
        },
      },
    }),
  ]);

  return {
    summary: {
      totalWorkspaces,
      totalBoards,
      totalCards,
    },
    workspaces,
  };
}
