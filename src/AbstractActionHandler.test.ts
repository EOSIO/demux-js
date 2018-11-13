import blockchains from "./testHelpers/blockchains"
import { TestActionHandler } from "./testHelpers/TestActionHandler"

const { blockchain, upgradeHandler } = blockchains

describe("Action Handler", () => {
  let actionHandler: TestActionHandler

  let runUpdater
  let runEffect

  let notRunUpdater
  let notRunEffect

  let runUpgradeUpdater

  let runUpdaterAfterUpgrade
  let runEffectAfterUpgrade

  let notRunUpdaterAfterUpgrade
  let notRunEffectAfterUpgrade

  beforeEach(() => {
    runUpdater = jest.fn()
    runEffect = jest.fn()

    notRunUpdater = jest.fn()
    notRunEffect = jest.fn()

    runUpgradeUpdater = jest.fn().mockReturnValue("v2")

    runUpdaterAfterUpgrade = jest.fn()
    runEffectAfterUpgrade = jest.fn()

    notRunUpdaterAfterUpgrade = jest.fn()
    notRunEffectAfterUpgrade = jest.fn()

    actionHandler = new TestActionHandler([
      {
        versionName: "v1",
        updaters: [
          {
            actionType: "eosio.token::transfer",
            apply: runUpdater,
          },
          {
            actionType: "mycontract::upgrade",
            apply: runUpgradeUpdater,
          },
          {
            actionType: "eosio.token::issue",
            apply: notRunUpdater,
          },
        ],
        effects: [
          {
            actionType: "eosio.token::transfer",
            run: runEffect,
          },
          {
            actionType: "eosio::bidname",
            run: runEffect,
          },
          {
            actionType: "eosio.token::issue",
            run: notRunEffect,
          },
        ],
      },
      {
        versionName: "v2",
        updaters: [
          {
            actionType: "eosio.token::transfer",
            apply: notRunUpdaterAfterUpgrade,
          },
          {
            actionType: "eosio.token::issue",
            apply: runUpdaterAfterUpgrade,
          },
        ],
        effects: [
          {
            actionType: "eosio.token::transfer",
            run: notRunEffectAfterUpgrade,
          },
          {
            actionType: "eosio.token::issue",
            run: runEffectAfterUpgrade,
          },
        ],
      },
    ])
  })

  it("runs the correct updater based on action type", async () => {
    await actionHandler._applyUpdaters({}, blockchain[1], false, {})
    expect(runUpdater).toHaveBeenCalledTimes(1)
    expect(notRunUpdater).not.toHaveBeenCalled()
  })

  it("runs the correct effect based on action type", async () => {
    const versionedActions = await actionHandler._applyUpdaters({}, blockchain[1], false, {})
    actionHandler._runEffects(versionedActions, blockchain[1], {})
    expect(runEffect).toHaveBeenCalledTimes(2)
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

  it("upgrades the action handler correctly", async () => {
    const versionedActions = await actionHandler._applyUpdaters({}, upgradeHandler[0], false, {})
    actionHandler._runEffects(versionedActions, upgradeHandler[0], {})

    expect(actionHandler._handlerVersionName).toEqual("v2")
    expect(runUpdater).toHaveBeenCalledTimes(1)
    expect(runEffect).toHaveBeenCalledTimes(2)
    expect(runUpgradeUpdater).toHaveBeenCalledTimes(1)
    expect(notRunUpdater).not.toHaveBeenCalled()
    expect(notRunUpdaterAfterUpgrade).not.toHaveBeenCalled()
    expect(runUpdaterAfterUpgrade).toHaveBeenCalledTimes(1)
    expect(notRunEffectAfterUpgrade).not.toHaveBeenCalled()
    expect(runEffectAfterUpgrade).toHaveBeenCalledTimes(1)
  })
})
