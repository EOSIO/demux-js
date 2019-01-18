import request from "supertest"
import { ExpressActionWatcher } from "./ExpressActionWatcher"
import blockchains from "./testHelpers/blockchains"
import { TestActionHandler } from "./testHelpers/TestActionHandler"
import { TestActionReader } from "./testHelpers/TestActionReader"
import { Block } from "./interfaces"

const wait = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe("ExpressActionWatcher", () => {
  let actionReader: TestActionReader
  let actionHandler: TestActionHandler
  let expressActionWatcher: ExpressActionWatcher
  let blockchain: Block[]

  beforeEach(() => {
    actionReader = new TestActionReader()
    blockchain = JSON.parse(JSON.stringify(blockchains.blockchain))
    actionReader.blockchain = blockchain

    const updaters = [{
      actionType: "eosio.token::transfer",
      apply: async (state: any, payload: any) => {
        if (!state.totalTransferred) {
          state.totalTransferred = parseFloat(payload.data.quantity.amount)
        } else {
          state.totalTransferred += parseFloat(payload.data.quantity.amount)
        }
      },
    }]
    actionHandler = new TestActionHandler([{ versionName: "v1", updaters, effects: [] }])

    expressActionWatcher = new ExpressActionWatcher(actionReader, actionHandler, 500, 56544)
  })

  afterEach(async () => {
    await expressActionWatcher.close()
  })

  it("defaults to paused state", async () => {
    await expressActionWatcher.listen()
    const server = request(expressActionWatcher.express)

    const status = await server.get("/info")
    expect(JSON.parse(status.text)).toEqual({
      status: "paused",
      lastProcessedBlockHash: "",
      lastProcessedBlockNumber: 0,
      handlerVersionName: "v1",
    })
  })

  it("starts indexing", async () => {
    await expressActionWatcher.listen()
    const server = request(expressActionWatcher.express)

    const started = await server.post("/start")
    expect(JSON.parse(started.text)).toEqual({
      success: true,
    })
    const status = await server.get("/info")
    expect(JSON.parse(status.text)).toEqual({
      status: "indexing",
      lastProcessedBlockHash: "0000000000000000000000000000000000000000000000000000000000000003",
      lastProcessedBlockNumber: 4,
      handlerVersionName: "v1",
    })
  })

  it("pauses indexing", async () => {
    await expressActionWatcher.listen()
    const server = request(expressActionWatcher.express)

    await server.post("/start")
    const paused = await server.post("/pause")
    expect(JSON.parse(paused.text)).toEqual({
      success: true,
    })
    const status1 = await server.get("/info")
    expect(JSON.parse(status1.text)).toEqual({
      status: "pausing",
      lastProcessedBlockHash: "0000000000000000000000000000000000000000000000000000000000000003",
      lastProcessedBlockNumber: 4,
      handlerVersionName: "v1",
    })
    await wait(500)
    const status2 = await server.get("/info")
    expect(JSON.parse(status2.text)).toEqual({
      status: "paused",
      lastProcessedBlockHash: "0000000000000000000000000000000000000000000000000000000000000003",
      lastProcessedBlockNumber: 4,
      handlerVersionName: "v1",
    })
  })
})
