const fs = require('fs')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

if (!process.env.DATABASE_URL) {
  const envLine = fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .find((line) => line.startsWith('DATABASE_URL='))

  if (envLine) {
    process.env.DATABASE_URL = envLine
      .slice('DATABASE_URL='.length)
      .trim()
      .replaceAll('"', '')
  }
}

async function main() {
  const prisma = new PrismaClient()
  const username = 'admin'
  const plainPassword = 'Admin@12345'
  const password = await bcrypt.hash(plainPassword, 12)

  const user = await prisma.user.upsert({
    where: { username },
    update: { password, role: 'OWNER' },
    create: { username, password, role: 'OWNER' },
  })

  console.log(
    JSON.stringify(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        password: plainPassword,
      },
      null,
      2,
    ),
  )

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
