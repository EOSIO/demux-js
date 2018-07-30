import Docker from "dockerode"
import massive from "massive"
import { MassiveActionHandler } from "./MassiveActionHandler"
import { JsonActionReader } from "../../readers/testing/JsonActionReader"
import blockchain from "./testHelpers/blockchain.json"
import * as migrate from "./testHelpers/migrate"
import * as dockerUtils from "./testHelpers/docker"
import updaters from "./testHelpers/updaters"

const docker = new Docker()
const postgresImageName = "postgres:10.4"
const postgresContainerName = "massive-action-handler-test"
const dbName = "demuxmassivetest"
const dbUser = "docker"
const dbPass = "docker"
let db: any

export function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

jest.setTimeout(30000)

beforeAll(async () => {
  await dockerUtils.pullImage(docker, postgresImageName)
  await dockerUtils.removePostgresContainer(docker, postgresContainerName)
  await dockerUtils.startPostgresContainer(docker, postgresImageName, postgresContainerName, dbName, dbUser, dbPass)
  db = await massive({
    database: dbName,
    user: dbUser,
    password: dbPass,
  })
  await migrate.up(db.instance)
  await db.reload()
})

afterAll(async () => {
  await dockerUtils.removePostgresContainer(docker, postgresContainerName)
})

describe("MassiveActionHandler", async () => {
  beforeEach(async () => {
    await migrate.reset(db.instance)
  })

  it("populates database correctly", async () => {
    const actionReader = new JsonActionReader(blockchain)
    const actionHandler = new MassiveActionHandler(updaters, [], db)
    const [block1, isRollback] = await actionReader.nextBlock()
    await actionHandler.handleBlock(block1, isRollback, actionReader.isFirstBlock)
    await wait(500)

    const groceries = await db.todo.findOne({ id: 1 })
    expect(groceries).toEqual({
      id: 1,
      name: "Groceries",
    })
    const placesToVisit = await db.todo.findOne({ id: 2 })
    expect(placesToVisit).toEqual({
      id: 2,
      name: "Places to Visit",
    })

    const [block2, isNotRollback] = await actionReader.nextBlock()
    await actionHandler.handleBlock(block2, isNotRollback, actionReader.isFirstBlock)
    await wait(500)

    const cookies = await db.task.findOne({ name: "cookies" })
    expect(cookies).toEqual({
      id: 5,
      name: "cookies",
      completed: false,
      todo_id: 1,
    })

    const sanFrancisco = await db.task.findOne({ name: "San Francisco" })
    expect(sanFrancisco).toEqual({
      id: 9,
      name: "San Francisco",
      completed: false,
      todo_id: 2,
    })

    const [block3, alsoNotRollback] = await actionReader.nextBlock()
    await actionHandler.handleBlock(block3, alsoNotRollback, actionReader.isFirstBlock)
    await wait(500)

    const milk = await db.task.findOne({ name: "milk" })
    const dippedCookies = await db.task.findOne({ name: "cookies" })
    expect(milk).toEqual({
      id: 4,
      name: "milk",
      completed: true,
      todo_id: 1,
    })
    expect(dippedCookies).toEqual({
      id: 5,
      name: "cookies",
      completed: true,
      todo_id: 1,
    })

    const hongKong = await db.task.findOne({ completed: true, todo_id: 2 })
    expect(hongKong).toEqual({
      id: 6,
      name: "Hong Kong",
      completed: true,
      todo_id: 2,
    })
  })
})
