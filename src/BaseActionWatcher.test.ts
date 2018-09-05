import { BaseActionWatcher } from "./BaseActionWatcher"
import { Block } from "./interfaces"
import blockchains from "./testHelpers/blockchains"
import { TestActionHandler } from "./testHelpers/TestActionHandler"
import { TestActionReader } from "./testHelpers/TestActionReader"

class TestActionWatcher extends BaseActionWatcher {
  public async _checkForBlocks(isReplay: boolean = false) {
    await this.checkForBlocks(isReplay)
  }
}

describe("BaseActionWatcher", () => {
  let actionReader: TestActionReader
  let actionReaderStartAt3: TestActionReader
  let actionReaderNegative: TestActionReader
  let blockchain: Block[]
  let actionHandler: TestActionHandler
  let actionHandlerStartAt3: TestActionHandler
  let actionHandlerNegative: TestActionHandler
  let actionWatcher: TestActionWatcher
  let actionWatcherStartAt3: TestActionWatcher
  let actionWatcherNegative: TestActionWatcher

  const runEffect = jest.fn()

  beforeEach(() => {
    actionReader = new TestActionReader()
    actionReaderStartAt3 = new TestActionReader(3)
    actionReaderNegative = new TestActionReader(-1)

    blockchain = JSON.parse(JSON.stringify(blockchains.blockchain))
    actionReader.blockchain = blockchain
    actionReaderStartAt3.blockchain = blockchain
    actionReaderNegative.blockchain = blockchain

    const updaters = [{
      actionType: "eosio.token::transfer",
      updater: async (state: any, payload: any) => {
        if (!state.totalTransferred) {
          state.totalTransferred = parseFloat(payload.data.quantity.amount)
        } else {
          state.totalTransferred += parseFloat(payload.data.quantity.amount)
        }
      },
    }]
    const effects = [{
      actionType: "eosio.token::transfer",
      effect: runEffect,
    }]

    actionHandler = new TestActionHandler(updaters, effects)
    actionHandlerStartAt3 = new TestActionHandler(updaters, effects)
    actionHandlerNegative = new TestActionHandler(updaters, effects)

    actionWatcher = new TestActionWatcher(actionReader, actionHandler, 500)
    actionWatcherStartAt3 = new TestActionWatcher(actionReaderStartAt3, actionHandlerStartAt3, 500)
    actionWatcherNegative = new TestActionWatcher(actionReaderNegative, actionHandlerNegative, 500)
  })

  it("processes blocks", async () => {
    await actionWatcher._checkForBlocks()
    expect(actionHandler.state).toEqual({
      indexState: {
        blockHash: "0000000000000000000000000000000000000000000000000000000000000003",
        blockNumber: 4,
      },
      totalTransferred: 66,
    })
    expect(actionReader.currentBlockNumber).toBe(4)
  })

  it("processes blocks starting at block 3", async () => {
    await actionWatcherStartAt3._checkForBlocks()
    expect(actionHandlerStartAt3.state).toEqual({
      indexState: {
        blockHash: "0000000000000000000000000000000000000000000000000000000000000003",
        blockNumber: 4,
      },
      totalTransferred: 24,
    })
    expect(actionReaderStartAt3.currentBlockNumber).toBe(4)
  })

  it("processes blocks starting at block 3 (negative indexed)", async () => {
    await actionWatcherNegative._checkForBlocks()
    expect(actionHandlerNegative.state).toEqual({
      indexState: {
        blockHash: "0000000000000000000000000000000000000000000000000000000000000003",
        blockNumber: 4,
      },
      totalTransferred: 24,
    })
    expect(actionReaderNegative.currentBlockNumber).toBe(4)
  })

  it("processes blocks after seeing more blocks", async () => {
    await actionWatcher._checkForBlocks()
    actionReader.blockchain.push({
      blockInfo: {
        blockHash: "newblock",
        blockNumber: 5,
        previousBlockHash: "0000000000000000000000000000000000000000000000000000000000000003",
        timestamp: new Date("2018-06-06T11:53:39.500"),
      },
      actions: [{
        payload: {
          account: "eosio.token",
          actionIndex: 0,
          authorization: [],
          data: {
            quantity: {
              amount: "123.00000",
              symbol: "EOS",
            },
          },
          name: "transfer",
          transactionId: "1",
        },
        type: "eosio.token::transfer",
      }],
    })
    await actionWatcher._checkForBlocks()
    expect(actionHandler.state).toEqual({
      indexState: {
        blockHash: "newblock",
        blockNumber: 5,
      },
      totalTransferred: 189,
    })
  })
})
