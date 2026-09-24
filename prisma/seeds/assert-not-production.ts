// prisma/seeds/assert-not-production.ts
// Safety net for dev-only seed scripts (demo user accounts, fake chat
// sessions/messages) that must never run against a production database —
// even if someone runs the script manually by mistake.

export function assertNotProduction(scriptName: string): void {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      `❌ ${scriptName} seeds dev-only demo data and refuses to run with NODE_ENV=production.`,
    );
    process.exit(1);
  }
}
