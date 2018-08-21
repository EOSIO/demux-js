import { AbstractActionHandler } from "./AbstractActionHandler"
import { Block, IndexState } from "./interfaces"

class TestActionHandler extends AbstractActionHandler {
  // tslint:disable-next-line
  public async handleWithState() {}

  public async rollbackTo(blockNumber: number) {
    this.setLastProcessedBlockNumber(blockNumber)
    this.setLastProcessedBlockHash("")
  }

  public setLastProcessedBlockHash(hash: string) {
    this.lastProcessedBlockHash = hash
  }

  public setLastProcessedBlockNumber(num: number) {
    this.lastProcessedBlockNumber = num
  }

  public async _runUpdaters(state: any, block: Block, context: any) {
    await this.runUpdaters(state, block, context)
  }

  public _runEffects(state: any, block: Block, context: any) {
    this.runEffects(state, block, context)
  }

  protected async loadIndexState(): Promise<IndexState> {
    return { blockNumber: 3, blockHash: "000f42401b5636c3c1d88f31fe0e503654091fb822b0ffe21c7d35837fc9f3d8" }
  }

  // tslint:disable-next-line
  protected async updateIndexState() {}
}

const firstRawBlock = {
  actions: [],
  blockInfo: {
    blockHash: "0000000000000000000000000000000000000000000000000000000000000000",
    blockNumber: 1,
    previousBlockHash: "",
    timestamp: new Date("2018-06-09T11:56:29.000"),
  },
}

const rawBlock = {
  actions: [
    {
      payload: {
        account: "testing",
        actionIndex: 0,
        authorization: [
          {
            actor: "testing",
            permission: "active",
          },
        ],
        data: {
          memo: "EOS is awesome!",
        },
        name: "action",
        transactionId: "b890beb84a6d1d77755f2e0cdad48e2ffcfd06ff3481917b4875cc5f3a343533",
      },
      type: "testing::action",
    },
    {
      payload: {
        account: "testing",
        actionIndex: 1,
        authorization: [
          {
            actor: "testing",
            permission: "active",
          },
        ],
        data: {
          memo: "Go EOS!",
        },
        name: "action2",
        transactionId: "b890beb84a6d1d77755f2e0cdad48e2ffcfd06ff3481917b4875cc5f3a343533",
      },
      type: "testing::action2",
    },
  ],
  blockInfo: {
    blockHash: "000f4241873a9aef0daefd47d8821495b6f61c4d1c73544419eb0ddc22a9e906",
    blockNumber: 4,
    previousBlockHash: "000f42401b5636c3c1d88f31fe0e503654091fb822b0ffe21c7d35837fc9f3d8",
    timestamp: new Date("2018-06-09T11:56:39.000"),
  },
}

describe("Action Handler", () => {
  let actionHandler: TestActionHandler
  let block: Block

  const notRunUpdater = jest.fn()
  const notRunEffect = jest.fn()

  const runUpdater = jest.fn()
  const runEffect = jest.fn()

  beforeAll(() => {
    actionHandler = new TestActionHandler(
      [
        {
          actionType: "eosio.token::transfer",
          updater: runUpdater,
        },
        {
          actionType: "eosio.token::issue",
          updater: notRunUpdater,
        },
      ],
      [
        {
          actionType: "eosio.token::transfer",
          effect: runEffect,
        },
        {
          actionType: "eosio.token::issue",
          effect: notRunEffect,
        },
      ],
    )

    block = {
      blockInfo: {
        blockHash: "0000000000000000000000000000000000000000000000000000000000000000",
        blockNumber: 1,
        previousBlockHash: "",
        timestamp: new Date("2018-06-06T11:53:37.000"),
      },
      actions: [
        {
          payload: {
            account: "eosio.token",
            actionIndex: 0,
            authorization: [],
            data: {},
            name: "transfer",
            transactionId: "1",
          },
          type: "eosio.token::transfer",
        },
        {
          payload: {
            account: "eosio.system",
            actionIndex: 0,
            authorization: [],
            data: {},
            name: "regproducer",
            transactionId: "1",
          },
          type: "eosio.system::regproducer",
        },
      ],
    }
  })

  it("runs the correct updater based on action type", async () => {
    await actionHandler._runUpdaters({}, block, {})
    expect(runUpdater).toHaveBeenCalled()
    expect(notRunUpdater).not.toHaveBeenCalled()
  })

  it("runs the correct effect based on action type", () => {
    actionHandler._runEffects({}, block, {})
    expect(runEffect).toHaveBeenCalled()
    expect(notRunEffect).not.toHaveBeenCalled()
  })

  it("retrieves indexState when processing first block", async () => {
    const [needToSeek, seekBlockNum] = await actionHandler.handleBlock(firstRawBlock, false, true)
    expect(needToSeek).toBe(true)
    expect(seekBlockNum).toBe(4)
  })

  it("seeks to the next block needed when block number doesn't match last processed block", async () => {
    actionHandler.setLastProcessedBlockNumber(2)
    const [needToSeek, seekBlockNum] = await actionHandler.handleBlock(rawBlock, false, false)
    expect(needToSeek).toBe(true)
    expect(seekBlockNum).toBe(3)
  })

  it("throws error if previous block hash and last processed don't match up", async () => {
    actionHandler.setLastProcessedBlockNumber(3)
    actionHandler.setLastProcessedBlockHash("asdfasdfasdf")
    const expectedError = new Error("Block hashes do not match; block not part of current chain.")
    await expect(actionHandler.handleBlock(rawBlock, false, false)).rejects.toEqual(expectedError)
  })
})
