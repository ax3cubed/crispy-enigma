import Database from 'better-sqlite3'
import path from 'path'
import { runMigrations, runPgMigrations } from './migrations'
import { Pool } from 'pg'

const DB_PATH = process.env.APP_DB_PATH ?? path.join(process.cwd(), 'app.db')
const DB_URL = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL

let _sqliteDb: Database.Database | null = null
let _pgPool: Pool | null = null
let _pgWrapper: any = null

function convertPlaceholders(sql: string): string {
  const parts = sql.split('?')
  if (parts.length === 1) return sql
  let out = parts[0]
  for (let i = 1; i < parts.length; i++) {
    out += `$${i}` + parts[i]
  }
  return out
}

class PgDbWrapper {
  pool: Pool
  constructor(pool: Pool) {
    this.pool = pool
  }

  prepare(sql: string) {
    const text = convertPlaceholders(sql)
    return {
      all: async (...params: any[]) => {
        const res = await this.pool.query(text, params)
        return res.rows
      },
      get: async (...params: any[]) => {
        const res = await this.pool.query(text, params)
        return res.rows[0]
      },
      run: async (...params: any[]) => {
        const res = await this.pool.query(text, params)
        return res
      },
    }
  }
}

export async function getDb(): Promise<any> {
  if (DB_URL) {
    if (!_pgPool) {
      _pgPool = new Pool({
        connectionString: DB_URL,
        // allow opt-in SSL behavior via env
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
      })
      await runPgMigrations(_pgPool)
      _pgWrapper = new PgDbWrapper(_pgPool)
    }
    return _pgWrapper
  }

  if (!_sqliteDb) {
    _sqliteDb = new Database(DB_PATH)
    _sqliteDb.pragma('journal_mode = WAL')
    _sqliteDb.pragma('foreign_keys = ON')
    runMigrations(_sqliteDb)
  }
  return _sqliteDb
}
