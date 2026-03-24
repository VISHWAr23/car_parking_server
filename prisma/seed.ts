// prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Role } from '../src/common/enums/app.enums';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Owner
  const ownerPassword = await bcrypt.hash('owner123', 12);
  const owner = await prisma.user.upsert({
    where: { username: 'owner' },
    update: {},
    create: {
      username: 'owner',
      password: ownerPassword,
      role: Role.OWNER,
    },
  });

  // Create Laborer
  const laborerPassword = await bcrypt.hash('laborer123', 12);
  const laborer = await prisma.user.upsert({
    where: { username: 'laborer' },
    update: {},
    create: {
      username: 'laborer',
      password: laborerPassword,
      role: Role.LABORER,
    },
  });

  console.log('✅ Seeded users:');
  console.log(`   - Owner:   username=owner,   password=owner123`);
  console.log(`   - Laborer: username=laborer, password=laborer123`);
  console.log(`\n📋 Owner ID:   ${owner.id}`);
  console.log(`📋 Laborer ID: ${laborer.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
