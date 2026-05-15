import mysql from "mysql2/promise";

let pool;

/**
 * Returns the module-level MySQL connection pool, creating it lazily on the
 * first call. Reads connection settings from environment variables at the
 * moment the pool is created (so test environments can inject `.env.test`
 * before the first query).
 *
 * @returns {import("mysql2/promise").Pool}
 */
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

/**
 * Runs a prepared statement against the pool and returns the resulting rows.
 *
 * Prefer this over importing `mysql2` directly: it uses `execute` (server-side
 * prepared statements) so parameters are bound safely and immune to SQL
 * injection. The pool is shared across the whole process and created on first
 * use.
 *
 * @param {string} sql - SQL with `?` placeholders for each parameter.
 * @param {Array<unknown>} [params] - Values bound to the placeholders, in order.
 * @returns {Promise<Array<object>>} - Result rows as plain objects.
 *
 * @example
 * const rows = await query("SELECT id, name FROM users WHERE email = ?", [email]);
 */
export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

/**
 * Closes every connection in the pool and resets the singleton, so a later
 * call to `query`/`getConnection` will lazily build a fresh pool.
 *
 * Used by the test teardown (`tests/setup.js`) to let Vitest exit cleanly —
 * production code never needs to call this.
 *
 * @returns {Promise<void>}
 */
export async function end() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

/**
 * Borrows a dedicated connection from the pool. The caller is responsible for
 * releasing it back with `conn.release()` (typically inside a `finally` block).
 *
 * Use this when multiple queries must share state, in particular
 * transactions: `BEGIN ... COMMIT` is per-connection in MySQL, so a sequence
 * of `query()` calls would not work — each one could land on a different
 * pooled connection.
 *
 * @returns {Promise<import("mysql2/promise").PoolConnection>}
 *
 * @example
 * const conn = await getConnection();
 * try {
 *   await conn.beginTransaction();
 *   await conn.execute("INSERT INTO ...", [...]);
 *   await conn.execute("INSERT INTO ...", [...]);
 *   await conn.commit();
 * } catch (err) {
 *   await conn.rollback();
 *   throw err;
 * } finally {
 *   conn.release();
 * }
 */
export async function getConnection() {
  return getPool().getConnection();
}
