import { TestActionHandler } from "./testHelpers/TestActionHandler"
import blockchains from "./testHelpers/blockchains"

const { blockchain } = blockchains

describe("Action Handler", () => {
  let actionHandler: TestActionHandler

  const notRunUpdater = jest.fn()
  const notRunEffect = jest.fn()

  const runUpdater = jest.fn()
  const runEffect = jest.fn()

  beforeAll(() => {
    actionHandler = new TestActionHandler([{
      versionName: "v1",
      updaters: [
        {
          actionName: "eosio.token::transfer",
          apply: runUpdater,
        },
        {
          actionName: "eosio.token::issue",
          apply: notRunUpdater,
        },
      ],
      effects: [
        {
          actionName: "eosio.token::transfer",
          run: runEffect,
        },
        {
          actionName: "eosio.token::issue",
          run: notRunEffect,
        },
      ],
    }])
  })

  it("runs the correct updater based on action type", async () => {
    await actionHandler._applyUpdaters({}, blockchain[1], {})
    expect(runUpdater).toHaveBeenCalled()
    expect(notRunUpdater).not.toHaveBeenCalled()
  })

  it("runs the correct effect based on action type", async () => {
    const versionedActions = await actionHandler._applyUpdaters({}, blockchain[1], {})
    actionHandler._runEffects(versionedActions, blockchain[1], {})
    expect(runEffect).toHaveBeenCalled()
    expect(notRunEffect).not.toHaveBeenCalled()
  })

  it("retrieves indexState when processing first block", async () => {
    actionHandler.state.indexState = {
      blockNumber: 3,
      blockHash: "000f42401b5636c3c1d88f31fe0e503654091fb822b0ffe21c7d35837fc9f3d8",
    }
    const [needToSeek, seekBlockNum] = await actionHandler.handleBlock(blockchain[0], false, true)
    expect(needToSeek).toBe(true)
    expect(seekBlockNum).toBe(4)
  })

  it("seeks to the next block needed when block number doesn't match last processed block", async () => {
    actionHandler.setLastProcessedBlockNumber(2)
    const [needToSeek, seekBlockNum] = await actionHandler.handleBlock(blockchain[3], false, false)
    expect(needToSeek).toBe(true)
    expect(seekBlockNum).toBe(3)
  })

  it("throws error if previous block hash and last processed don't match up", async () => {
    actionHandler.setLastProcessedBlockNumber(3)
    actionHandler.setLastProcessedBlockHash("asdfasdfasdf")
    const expectedError = new Error("Block hashes do not match; block not part of current chain.")
    await expect(actionHandler.handleBlock(blockchain[3], false, false)).rejects.toEqual(expectedError)
  })
})
