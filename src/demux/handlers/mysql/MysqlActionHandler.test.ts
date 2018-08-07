import Docker from "dockerode"
import mysql from "promise-mysql"
import { MysqlActionHandler } from "./MysqlActionHandler"
import { JsonActionReader } from "../../readers/testing/JsonActionReader"
import blockchain from "./testHelpers/blockchain.json"
import * as migrate from "./testHelpers/migrate"
import * as dockerUtils from "./testHelpers/docker"
import updaters from "./testHelpers/updaters"

const docker = new Docker()
const mysqlImageName = "mysql:5"
const mysqlContainerName = "mysql-action-handler-test"
const dbName = "demuxmysqltest"
const dbUser = "root"
const dbPass = "docker"
let conn: any

export function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

jest.setTimeout(30000)

beforeAll(async () => {
  await dockerUtils.pullImage(docker, mysqlImageName)
  await dockerUtils.removeMysqlContainer(docker, mysqlContainerName)
  await dockerUtils.startMysqlContainer(docker, mysqlImageName, mysqlContainerName, dbName, dbUser, dbPass)
  conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: dbUser,
    password: dbPass,
    multipleStatements: true
  })
  await migrate.up(conn)
})

afterAll(async () => {
  await conn.end();
  await dockerUtils.removeMysqlContainer(docker, mysqlContainerName)
})

describe("MysqlActionHandler", async () => {
  beforeEach(async () => {
    await migrate.reset(conn)
  })

  it("populates database correctly", async () => {
    const actionReader = new JsonActionReader(blockchain)
    const actionHandler = new MysqlActionHandler(updaters, [], conn)
    const [block1, isRollback] = await actionReader.nextBlock()
    await actionHandler.handleBlock(block1, isRollback, actionReader.isFirstBlock)
    await wait(500)

    let rows = await conn.query(`SELECT * FROM todo WHERE id=1`);
    const groceries = rows[0];
    expect(groceries).toEqual({
      id: 1,
      name: "Groceries",
    })
    rows = await conn.query(`SELECT * FROM todo WHERE id=2`);
    const placesToVisit = rows[0];
    expect(placesToVisit).toEqual({
      id: 2,
      name: "Places to Visit",
    })

    const [block2, isNotRollback] = await actionReader.nextBlock()
    await actionHandler.handleBlock(block2, isNotRollback, actionReader.isFirstBlock)
    await wait(500)

    rows = await conn.query(`SELECT * FROM task WHERE name="cookies" LIMIT 1`);
    const cookies = rows[0];
    expect(cookies).toEqual({
      id: 5,
      name: "cookies",
      completed: 0,
      todo_id: 1,
    })

    rows = await conn.query(`SELECT * FROM task WHERE name="San Francisco" LIMIT 1`);
    const sanFrancisco = rows[0];
    expect(sanFrancisco).toEqual({
      id: 9,
      name: "San Francisco",
      completed: 0,
      todo_id: 2,
    })

    const [block3, alsoNotRollback] = await actionReader.nextBlock()
    await actionHandler.handleBlock(block3, alsoNotRollback, actionReader.isFirstBlock)
    await wait(500)

    rows = await conn.query(`SELECT * FROM task WHERE name="milk" LIMIT 1`);
    const milk = rows[0];
    rows = await conn.query(`SELECT * FROM task WHERE name="cookies" LIMIT 1`);
    const dippedCookies = rows[0];
    expect(milk).toEqual({
      id: 4,
      name: "milk",
      completed: 1,
      todo_id: 1,
    })
    expect(dippedCookies).toEqual({
      id: 5,
      name: "cookies",
      completed: 1,
      todo_id: 1,
    })

    rows = await conn.query(`SELECT * FROM task WHERE completed=true AND todo_id=2 LIMIT 1`);
    const hongKong = rows[0];
    expect(hongKong).toEqual({
      id: 6,
      name: "Hong Kong",
      completed: 1,
      todo_id: 2,
    })
  })
})
