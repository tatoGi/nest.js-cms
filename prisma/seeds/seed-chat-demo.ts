// prisma/seeds/seed-chat-demo.ts
// Dev-only demo data: chat sessions, messages, and chat tags for the demo
// operator accounts (see seed-chat-dev-users.ts). NEVER run against
// production — see assertNotProduction below.
// Safe to re-run — clears previous demo data first.

import { createPrismaClient } from './prisma-client';
import { assertNotProduction } from './assert-not-production';

const prisma = createPrismaClient();

const DEMO_EMAILS = [
  'giorgi@example.com',
  'nino@example.com',
  'luka@example.com',
  'tamara@example.com',
  'david@example.com',
  'ana@example.com',
  'nikoloz@example.com',
  'alice@example.com',
  'bob@example.com',
  'sarah@example.com',
  'james@example.com',
  'mari@example.com',
  'sophie@example.com',
  'elene@example.com',
  'michael@example.com',
  'kate@example.com',
  'irakli@example.com',
  'tom@example.com',
];

// Mirrors ChatService's ChatCloseReason enum (src/modules/chat/application/
// chat.service.ts) — kept as plain literals here since seed scripts don't
// import from src/. Every closed demo session must use one of these three.
const CLOSE_REASON = {
  CLIENT_CLOSED: 'Client Ended Chat',
  INACTIVITY_TIMEOUT: 'Session Timed Out',
  OPERATOR_CLOSED: 'Closed by Operator',
} as const;

async function main() {
  assertNotProduction('seed-chat-demo.ts');
  console.log('🌱 Seeding demo chat data...\n');

  const op1 = await prisma.user.findUnique({ where: { email: 'operator@admin.ge' } });
  const op2 = await prisma.user.findUnique({ where: { email: 'operator2@admin.ge' } });
  const op3 = await prisma.user.findUnique({ where: { email: 'operator3@admin.ge' } });

  if (!op1) {
    console.error('❌ Operator user not found. Run seed-chat.ts first.');
    process.exit(1);
  }

  // ── Clear previous demo sessions ────────────────────────────────────────────────
  await prisma.chatSession.deleteMany({ where: { visitorEmail: { in: DEMO_EMAILS } } });
  await prisma.chatSession.deleteMany({ where: { visitorName: null, visitorEmail: null } });

  const o1 = op1.id;
  const o2 = op2?.id ?? o1;
  const o3 = op3?.id ?? o1;

  // ── Sessions ──────────────────────────────────────────────────────────────
  const sessions = [
    // ── Open, assigned ─────────────────────────────────────────────────────────
    {
      visitorName: 'გიორგი მამულაშვილი',
      visitorEmail: 'giorgi@example.com',
      visitorPhone: '+995 599 112233',
      visitorLanguage: 'ka',
      visitorBrowser: 'Chrome 124 / macOS',
      visitorPage: '',
      operatorId: o1,
      status: 'open',
      messages: [
        { role: 'visitor', body: 'გამარჯობა, მჭირდება დახმარება ბიზნეს გრანტთან დაკავშირებით' },
        { role: 'operator', body: 'გამარჯობა! რა სახის გრანტი გაინტერესებთ?', authorId: o1 },
        { role: 'visitor', body: 'საწყისი ბიზნესისთვის სახელმწიფო პროგრამა' },
        {
          role: 'operator',
          body: 'დიახ, გვაქს რამდენიმე პროგრამა. გთხოვთ მიუთითოთ ბიზნეს სფერო.',
          authorId: o1,
        },
        { role: 'visitor', body: 'სოფლის მეურნეობა' },
        {
          role: 'operator',
          body: 'სამი აქტიური პროგრამა გვაქს. დეტალებს გამოგიგზავნით.',
          authorId: o1,
        },
      ],
    },
    {
      visitorName: 'Alice Johnson',
      visitorEmail: 'alice@example.com',
      visitorPhone: '+1 650 555 0101',
      visitorLanguage: 'en',
      visitorBrowser: 'Chrome 124 / macOS',
      visitorPage: '',
      operatorId: o1,
      status: 'open',
      messages: [
        { role: 'visitor', body: 'Hi, I have a question about my invoice.' },
        { role: 'operator', body: 'Of course! Which invoice are you referring to?', authorId: o1 },
        { role: 'visitor', body: 'Invoice #2024-0891 — I think I was overcharged.' },
        { role: 'operator', body: 'Let me pull that up. One moment please.', authorId: o1 },
        {
          role: 'operator',
          body: '[Internal] Checking with billing team',
          authorId: o1,
          isInternal: true,
        },
      ],
    },
    {
      visitorName: 'Luka Beridze',
      visitorEmail: 'luka@example.com',
      visitorPhone: '+995 577 334455',
      visitorLanguage: 'en',
      visitorBrowser: 'Chrome 123 / Windows',
      visitorPage: '',
      operatorId: o2,
      status: 'open',
      messages: [
        { role: 'visitor', body: 'Hi, the payment page is throwing an error.' },
        { role: 'operator', body: 'Can you share the error message?', authorId: o2 },
        { role: 'visitor', body: '"Transaction declined — code 4012"' },
        {
          role: 'operator',
          body: 'Try re-entering your card with the billing address exactly as on file.',
          authorId: o2,
        },
        { role: 'visitor', body: 'Still same error :(' },
        { role: 'operator', body: 'Escalating to our payments team now.', authorId: o2 },
      ],
    },
    {
      visitorName: 'Tamara Jishkariani',
      visitorEmail: 'tamara@example.com',
      visitorPhone: '+995 591 667788',
      visitorLanguage: 'ka',
      visitorBrowser: 'Safari / iPhone',
      visitorPage: '',
      operatorId: o3,
      status: 'open',
      messages: [
        { role: 'visitor', body: 'გამარჯობა, კორპორატიული სერვისები მაინტერესს' },
        { role: 'operator', body: 'გამარჯობა! გადავცემ გაყიდვების გუნდს.', authorId: o3 },
        {
          role: 'operator',
          body: '[Internal] Corporate inquiry — forward to sales',
          authorId: o3,
          isInternal: true,
        },
      ],
    },
    {
      visitorName: 'Irakli Tsiklauri',
      visitorEmail: 'irakli@example.com',
      visitorPhone: '+995 555 998877',
      visitorLanguage: 'en',
      visitorBrowser: 'Firefox / Windows',
      visitorPage: '',
      operatorId: o2,
      status: 'open',
      messages: [
        { role: 'visitor', body: 'What are your working hours?' },
        { role: 'operator', body: 'We are available Mon–Fri, 9am–6pm (GET).', authorId: o2 },
        { role: 'visitor', body: 'What about weekends?' },
        {
          role: 'operator',
          body: 'Currently weekdays only, but live chat is available 24/7.',
          authorId: o2,
        },
        { role: 'visitor', body: 'Great, thank you!' },
      ],
    },
    // ── Open, unassigned ─────────────────────────────────────────────────────
    {
      visitorName: 'ნინო კვარაცხელია',
      visitorEmail: 'nino@example.com',
      visitorPhone: '+995 598 123456',
      visitorLanguage: 'ka',
      visitorBrowser: 'Firefox 125 / Windows',
      visitorPage: '',
      status: 'open',
      messages: [
        { role: 'visitor', body: 'Hello, I need help with my application status' },
        { role: 'visitor', body: "I submitted 2 weeks ago and haven't heard back" },
      ],
    },
    {
      visitorName: 'Bob Smith',
      visitorEmail: 'bob@example.com',
      visitorPhone: '+44 20 7946 0101',
      visitorLanguage: 'en',
      visitorBrowser: 'Firefox / Linux',
      visitorPage: '',
      status: 'open',
      messages: [
        { role: 'visitor', body: 'I forgot my password and the reset email is not arriving.' },
      ],
    },
    {
      visitorName: 'ნიკოლოზ ბერიძე',
      visitorEmail: 'nikoloz@example.com',
      visitorPhone: '+995 593 445566',
      visitorLanguage: 'ka',
      visitorBrowser: 'Firefox / macOS',
      visitorPage: '',
      status: 'open',
      messages: [{ role: 'visitor', body: 'გამარჯობა!' }],
    },
    {
      visitorName: 'Sophie Laurent',
      visitorEmail: 'sophie@example.com',
      visitorPhone: '+33 6 12 34 56 78',
      visitorLanguage: 'en',
      visitorBrowser: 'Chrome / Windows',
      visitorPage: '',
      status: 'open',
      messages: [
        { role: 'visitor', body: 'Do you offer services in French?' },
        { role: 'visitor', body: 'Or only Georgian/English?' },
      ],
    },
    {
      visitorName: 'Tom Baker',
      visitorEmail: 'tom@example.com',
      visitorPhone: '+1 212 555 0199',
      visitorLanguage: 'en',
      visitorBrowser: 'Edge / Windows',
      visitorPage: '',
      status: 'open',
      messages: [
        { role: 'visitor', body: 'What documents do I need for registration?' },
        { role: 'visitor', body: 'Also is there an age requirement?' },
      ],
    },
    // ── Open, anonymous ────────────────────────────────────────────────────────
    {
      visitorName: null,
      visitorEmail: null,
      visitorPhone: null,
      visitorLanguage: null,
      visitorBrowser: 'Edge / Windows',
      visitorPage: '',
      status: 'open',
      messages: [{ role: 'visitor', body: 'How do I request a demo?' }],
    },
    {
      visitorName: null,
      visitorEmail: null,
      visitorPhone: null,
      visitorLanguage: null,
      visitorBrowser: 'Chrome / Android',
      visitorPage: '',
      status: 'open',
      messages: [
        { role: 'visitor', body: 'გვერდი არ იტვირთება' },
        { role: 'visitor', body: 'პროგრამების სექცია' },
      ],
    },
    // ── Closed ───────────────────────────────────────────────────────────────────
    {
      visitorName: 'Sarah Connor',
      visitorEmail: 'sarah@example.com',
      visitorPhone: '+1 415 555 0187',
      visitorLanguage: 'en',
      visitorBrowser: 'Chrome / Windows',
      visitorPage: '',
      operatorId: o1,
      closedByOperatorId: o1,
      status: 'closed',
      closedAt: new Date(Date.now() - 2 * 3600_000),
      resolutionTag: CLOSE_REASON.OPERATOR_CLOSED,
      visitorRating: 5,
      closureSummary: 'Helped visitor find the right grant program and sent application link.',
      messages: [
        { role: 'visitor', body: 'Can you help me find grants for tech startups?' },
        { role: 'operator', body: 'We have two active programs for tech.', authorId: o1 },
        { role: 'visitor', body: 'Great, where do I apply?' },
        { role: 'operator', body: 'Here: enterprise.ge/apply/tech-grant', authorId: o1 },
        { role: 'visitor', body: 'Perfect, thank you!' },
      ],
    },
    {
      visitorName: 'James Wilson',
      visitorEmail: 'james@example.com',
      visitorPhone: '+44 7911 123456',
      visitorLanguage: 'en',
      visitorBrowser: 'Safari / macOS',
      visitorPage: '',
      operatorId: o2,
      closedByOperatorId: o2,
      status: 'closed',
      closedAt: new Date(Date.now() - 5 * 3600_000),
      resolutionTag: CLOSE_REASON.OPERATOR_CLOSED,
      visitorRating: 3,
      closureSummary: 'Visitor requested callback from sales. Ticket created.',
      messages: [
        { role: 'visitor', body: 'I want to speak with your sales department.' },
        { role: 'operator', body: "I can arrange a callback. What's a good time?", authorId: o2 },
        { role: 'visitor', body: 'Tomorrow morning, 10am.' },
        { role: 'operator', body: 'Sales team will call at 10am tomorrow.', authorId: o2 },
      ],
    },
    {
      visitorName: 'David Kapanadze',
      visitorEmail: 'david@example.com',
      visitorPhone: '+995 574 778899',
      visitorLanguage: 'ka',
      visitorBrowser: 'Chrome / Android',
      visitorPage: '',
      status: 'closed',
      closedAt: new Date(Date.now() - 24 * 3600_000),
      resolutionTag: CLOSE_REASON.INACTIVITY_TIMEOUT,
      messages: [
        { role: 'visitor', body: 'hello?' },
        { role: 'visitor', body: 'is anyone there' },
      ],
    },
    {
      visitorName: 'ანა გოგუა',
      visitorEmail: 'ana@example.com',
      visitorPhone: '+995 599 001122',
      visitorLanguage: 'ka',
      visitorBrowser: 'Chrome / Windows',
      visitorPage: '',
      operatorId: o3,
      closedByOperatorId: o3,
      status: 'closed',
      closedAt: new Date(Date.now() - 3 * 3600_000),
      resolutionTag: CLOSE_REASON.OPERATOR_CLOSED,
      visitorRating: 4,
      messages: [
        { role: 'visitor', body: 'გამარჯობა, რეგისტრაციისთვის რა დოკუმენტებია საჭირო?' },
        { role: 'operator', body: 'პირადობა, საბანკო ანგარიში და ბიზნეს გეგმა.', authorId: o3 },
        { role: 'visitor', body: 'გმადლობთ!' },
      ],
    },
    {
      visitorName: 'Elene Kvaratskhelia',
      visitorEmail: 'elene@example.com',
      visitorPhone: '+995 557 223344',
      visitorLanguage: 'en',
      visitorBrowser: 'Safari / iPhone',
      visitorPage: '',
      operatorId: o1,
      closedByOperatorId: o1,
      status: 'closed',
      closedAt: new Date(Date.now() - 48 * 3600_000),
      resolutionTag: CLOSE_REASON.OPERATOR_CLOSED,
      visitorRating: 5,
      closureSummary: 'Upgraded to Business plan successfully.',
      messages: [
        { role: 'visitor', body: 'I want to upgrade my plan.' },
        {
          role: 'operator',
          body: "I'll help you with that! Which plan are you on now?",
          authorId: o1,
        },
        { role: 'visitor', body: 'Starter. Want to move to Business.' },
        {
          role: 'operator',
          body: "Upgraded! You'll see the new features immediately.",
          authorId: o1,
        },
        { role: 'visitor', body: 'Amazing, works perfectly. Thank you!' },
      ],
    },
    {
      visitorName: 'Mari Tabatadze',
      visitorEmail: 'mari@example.com',
      visitorPhone: '+995 595 556677',
      visitorLanguage: 'ka',
      visitorBrowser: 'Chrome / macOS',
      visitorPage: '',
      operatorId: o2,
      closedByOperatorId: o2,
      status: 'closed',
      closedAt: new Date(Date.now() - 6 * 3600_000),
      resolutionTag: CLOSE_REASON.OPERATOR_CLOSED,
      messages: [
        { role: 'visitor', body: 'I need a refund for my last payment.' },
        { role: 'operator', body: 'I understand. Can you share the transaction ID?', authorId: o2 },
        { role: 'visitor', body: 'TXN-20240411-8823' },
        {
          role: 'operator',
          body: 'Submitted to billing. You will hear back in 2 business days.',
          authorId: o2,
        },
      ],
    },
    {
      visitorName: 'Michael Brown',
      visitorEmail: 'michael@example.com',
      visitorPhone: '+1 310 555 0177',
      visitorLanguage: 'en',
      visitorBrowser: 'Firefox / Windows',
      visitorPage: '',
      status: 'closed',
      closedAt: new Date(Date.now() - 72 * 3600_000),
      resolutionTag: CLOSE_REASON.OPERATOR_CLOSED,
      messages: [{ role: 'visitor', body: 'BUY CHEAP SEO SERVICES CLICK HERE' }],
    },
    {
      visitorName: 'Kate Williams',
      visitorEmail: 'kate@example.com',
      visitorPhone: '+44 7700 900123',
      visitorLanguage: 'en',
      visitorBrowser: 'Chrome / iOS',
      visitorPage: '',
      operatorId: o3,
      closedByOperatorId: o3,
      status: 'closed',
      closedAt: new Date(Date.now() - 10 * 3600_000),
      resolutionTag: CLOSE_REASON.OPERATOR_CLOSED,
      visitorRating: 4,
      messages: [
        { role: 'visitor', body: 'My account got locked after too many login attempts.' },
        {
          role: 'operator',
          body: "I've unlocked it. Please reset your password now.",
          authorId: o3,
        },
        { role: 'visitor', body: 'Done, logged in successfully. Thanks!' },
      ],
    },
  ] as const;

  let i = 1;
  for (const s of sessions) {
    const { messages, ...data } = s as any;
    const session = await prisma.chatSession.create({ data });
    for (const m of messages) {
      await prisma.chatMessage.create({ data: { sessionId: session.id, ...m } });
    }
    console.log(
      `  ✅ Session ${i++}: ${s.visitorName ?? 'Anonymous'} — ${s.status}${(s as any).tag ? ` [${(s as any).tag}]` : ''}`,
    );
  }

  const open = sessions.filter((s) => s.status === 'open').length;
  const closed = sessions.filter((s) => s.status === 'closed').length;
  console.log(
    `\n✨ Demo seed complete — ${sessions.length} sessions (${open} open, ${closed} closed)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
