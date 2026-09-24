// Shared Prisma select/include shapes for ChatSession reads — used by both
// ChatService (session lifecycle) and ChatReportingService (dashboard/queue
// reads), so they need to stay in one place rather than drifting apart.
export const KNOWN_USER_SELECT = {
  id: true,
  displayName: true,
  email: true,
  avatarMediaId: true,
  isActive: true,
  lastLogin: true,
  createdAt: true,
  roles: { select: { role: { select: { name: true, slug: true } } } },
} as const;

export const OPERATOR_SELECT = {
  id: true,
  displayName: true,
  avatarMediaId: true,
} as const;

export const SESSION_INCLUDE = {
  operator: { select: OPERATOR_SELECT },
  knownUser: { select: KNOWN_USER_SELECT },
  closedByOperator: { select: OPERATOR_SELECT },
  messages: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  program: { select: { id: true, name: true } },
  region: { select: { id: true, name: true } },
} as const;
