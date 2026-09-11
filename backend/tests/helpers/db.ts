import { PrismaClient } from '@prisma/client';

// Single Prisma client bound to the test database (DATABASE_URL is rewritten by
// tests/setup/load-test-env.ts before this module is imported by any test).
export const testPrisma = new PrismaClient();

// Deletes all rows in the tables used by integration tests.
// Order matters because of foreign keys: children (Document, Warranty) before Purchase.
export const cleanDatabase = async () => {
  await testPrisma.document.deleteMany();
  await testPrisma.warranty.deleteMany();
  await testPrisma.purchase.deleteMany();
  await testPrisma.user.deleteMany();
};

export const disconnectDatabase = async () => {
  await testPrisma.$disconnect();
};
