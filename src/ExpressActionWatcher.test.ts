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
    if (expressActionWatcher.server) {
      await expressActionWatcher.server.close()
    }
  })

  it("defualts to paused state", async () => {
    await expressActionWatcher.listen()
    const server = request(expressActionWatcher.express)

    const status = await server.get("/status")
    expect(JSON.parse(status.text)).toEqual({
      running: false,
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
    const status = await server.get("/status")
    expect(JSON.parse(status.text)).toEqual({
      running: true,
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
    const status = await server.get("/status")
    await wait(1000)
    expect(JSON.parse(status.text)).toEqual({
      running: false,
      lastProcessedBlockHash: "0000000000000000000000000000000000000000000000000000000000000003",
      lastProcessedBlockNumber: 4,
      handlerVersionName: "v1",
    })
  })
})
