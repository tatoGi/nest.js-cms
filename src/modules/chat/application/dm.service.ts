import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

const PARTICIPANT_SELECT = {
  id: true,
  displayName: true,
  avatarMediaId: true,
} as const;

@Injectable()
export class DmService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateThread(userId1: number, userId2: number) {
    const [p1, p2] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
    return this.prisma.operatorThread.upsert({
      where: { participant1Id_participant2Id: { participant1Id: p1, participant2Id: p2 } },
      update: {},
      create: { participant1Id: p1, participant2Id: p2 },
      include: {
        participant1: { select: PARTICIPANT_SELECT },
        participant2: { select: PARTICIPANT_SELECT },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async getThreadsForUser(userId: number) {
    return this.prisma.operatorThread.findMany({
      where: { OR: [{ participant1Id: userId }, { participant2Id: userId }] },
      include: {
        participant1: { select: PARTICIPANT_SELECT },
        participant2: { select: PARTICIPANT_SELECT },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getThreadMessages(threadId: string) {
    return this.prisma.operatorMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Used by chat.gateway.ts's dm:message handler to verify the (already
  // identity-verified) caller is actually one of this thread's two
  // participants before letting them read/write into it — threadId alone
  // is otherwise enough to reach any thread, not just the caller's own.
  async isThreadParticipant(threadId: string, userId: number): Promise<boolean> {
    const thread = await this.prisma.operatorThread.findUnique({
      where: { id: threadId },
      select: { participant1Id: true, participant2Id: true },
    });
    if (!thread) return false;
    return thread.participant1Id === userId || thread.participant2Id === userId;
  }

  async saveMessage(threadId: string, authorId: number, body: string) {
    return this.prisma.operatorMessage.create({
      data: { threadId, authorId, body },
    });
  }
}
