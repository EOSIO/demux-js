import * as path from "path"
import fs from "fs"

function loadQueryFile(file: string) {
  var appDir = path.dirname(require.main.filename);
  const fullPath = path.join(appDir, "testHelpers", file);
  return fs.readFileSync(fullPath, "utf-8");
}

export async function up(conn: any) {
  const create = loadQueryFile("create.sql");
  await conn.query(create)
}

export async function reset(conn: any) {
  const truncate = loadQueryFile("truncate.sql");
  await conn.query(truncate);
}
