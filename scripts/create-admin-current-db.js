const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const bcrypt = require('bcryptjs')

const envText = fs.readFileSync(path.resolve('.env'), 'utf8')
const dbLine = envText
  .split(/\r?\n/)
  .find((line) => line.startsWith('DATABASE_URL='))

if (!dbLine) {
  console.error('DATABASE_URL not found in .env')
  process.exit(1)
}

const databaseUrl = dbLine
  .slice('DATABASE_URL='.length)
  .trim()
  .replace(/^"|"$/g, '')

if (!databaseUrl) {
  console.error('DATABASE_URL is empty in .env')
  process.exit(1)
}

async function main() {
  const username = 'admin'
  const plainPassword = 'Admin@12345'
  const hashedPassword = await bcrypt.hash(plainPassword, 12)
  const id = `admin_${Date.now()}`

  const sql = `
CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'LABORER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "users" ("id", "username", "password", "role", "createdAt", "updatedAt")
VALUES ('${id}', '${username}', '${hashedPassword}', 'OWNER', NOW(), NOW())
ON CONFLICT ("username")
DO UPDATE SET
  "password" = EXCLUDED."password",
  "role" = 'OWNER',
  "updatedAt" = NOW();
`

  const sqlPath = path.resolve('scripts', 'tmp-create-admin.sql')
  fs.writeFileSync(sqlPath, sql, 'utf8')

  try {
    const command = `npx prisma db execute --url "${databaseUrl}" --file "${sqlPath}"`
    execSync(command, { stdio: 'inherit' })
  } finally {
    if (fs.existsSync(sqlPath)) {
      fs.unlinkSync(sqlPath)
    }
  }

  console.log(
    JSON.stringify(
      {
        username,
        password: plainPassword,
        role: 'OWNER',
        database: 'current DATABASE_URL from .env',
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
