import * as path from "path"
import { QueryFile, IDatabase } from "pg-promise"

function loadQueryFile(file: string) {
  const fullPath = path.join(__dirname, file)
  const options = {
    minify: true,
    params: {
      schema: "public", // replace ${schema~} with "public"
    },
  }
  const qf = new QueryFile(fullPath, options)
  if (qf.error) {
    console.error(qf.error)
  }
  return qf
}

export async function up(pgp: IDatabase<{}>) {
  const create = loadQueryFile("create.sql")
  await pgp.none(create)
}

export async function reset(pgp: IDatabase<{}>) {
  const truncate = loadQueryFile("truncate.sql")
  await pgp.none(truncate)
}
