import blockchains from "./testHelpers/blockchains"
import { TestActionHandler } from "./testHelpers/TestActionHandler"
import { ActionCallback, StatelessActionCallback } from "./interfaces"

const { blockchain, upgradeHandler } = blockchains

describe("Action Handler", () => {
  let actionHandler: TestActionHandler

  let runUpdater: ActionCallback
  let runEffect: StatelessActionCallback

  let notRunUpdater: ActionCallback
  let notRunEffect: StatelessActionCallback

  let runUpgradeUpdater: ActionCallback

  let runUpdaterAfterUpgrade: ActionCallback
  let runEffectAfterUpgrade: StatelessActionCallback

  let notRunUpdaterAfterUpgrade: ActionCallback
  let notRunEffectAfterUpgrade: StatelessActionCallback

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
            deferUntilIrreversible: true,
          },
          {
            actionType: "eosio::bidname",
            run: runEffect,
            deferUntilIrreversible: true,
          },
          {
            actionType: "eosio.token::issue",
            run: notRunEffect,
            deferUntilIrreversible: true,
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
            deferUntilIrreversible: true,
          },
          {
            actionType: "eosio.token::issue",
            run: runEffectAfterUpgrade,
            deferUntilIrreversible: true,
          },
        ],
      },
    ])
  })

  it("runs the correct updater based on action type", async () => {
    await actionHandler._applyUpdaters({}, blockchain[1], {}, false)
    expect(runUpdater).toHaveBeenCalledTimes(1)
    expect(notRunUpdater).not.toHaveBeenCalled()
  })

  it("runs the correct effect based on action type", async () => {
    const versionedActions = await actionHandler._applyUpdaters({}, blockchain[1], {},  false)
    const blockMeta = {
      isRollback: false,
      isFirstBlock: true,
      isNewBlock: true,
    }
    const nextBlock = {
      block: blockchain[1],
      blockMeta,
      lastIrreversibleBlockNumber: 2,
    }
    actionHandler._runEffects(versionedActions, {}, nextBlock)
    expect(runEffect).toHaveBeenCalledTimes(2)
    expect(notRunEffect).not.toHaveBeenCalled()
  })

  it("retrieves indexState when processing first block", async () => {
    actionHandler.state.indexState = {
      blockNumber: 3,
      blockHash: "000f42401b5636c3c1d88f31fe0e503654091fb822b0ffe21c7d35837fc9f3d8",
    }
    const blockMeta = {
      isRollback: false,
      isFirstBlock: true,
      isNewBlock: true,
    }
    const nextBlock = {
      block: blockchain[0],
      blockMeta,
      lastIrreversibleBlockNumber: 1,
    }
    const seekBlockNum = await actionHandler.handleBlock(nextBlock, false)
    expect(seekBlockNum).toBe(4)
  })

  it("seeks to the next block needed when block number doesn't match last processed block", async () => {
    actionHandler.setLastProcessedBlockNumber(2)
    const blockMeta = {
      isRollback: false,
      isFirstBlock: false,
      isNewBlock: true,
    }
    const nextBlock = {
      block: blockchain[3],
      blockMeta,
      lastIrreversibleBlockNumber: 1,
    }
    const seekBlockNum = await actionHandler.handleBlock(nextBlock, false)
    expect(seekBlockNum).toBe(3)
  })

  it("throws error if previous block hash and last processed don't match up", async () => {
    actionHandler.setLastProcessedBlockNumber(3)
    actionHandler.setLastProcessedBlockHash("asdfasdfasdf")
    const blockMeta = {
      isRollback: false,
      isFirstBlock: false,
      isNewBlock: true,
    }
    const expectedError = new Error("Block hashes do not match; block not part of current chain.")
    const nextBlock = {
      block: blockchain[3],
      blockMeta,
      lastIrreversibleBlockNumber: 1,
    }
    await expect(actionHandler.handleBlock(nextBlock, false)).rejects.toEqual(expectedError)
  })

  it("upgrades the action handler correctly", async () => {
    const blockMeta = {
      isRollback: false,
      isFirstBlock: true,
      isNewBlock: true,
    }
    const nextBlock = {
      block: upgradeHandler[0],
      blockMeta,
      lastIrreversibleBlockNumber: 2,
    }
    const versionedActions = await actionHandler._applyUpdaters({}, upgradeHandler[0], {}, false)
    actionHandler._runEffects(versionedActions, {}, nextBlock)

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

  it("defers the effects until the block is irreversible", async () => {
    const blockMeta = {
      isRollback: false,
      isFirstBlock: true,
      isNewBlock: true,
    }
    const nextBlock = {
      block: upgradeHandler[0],
      blockMeta,
      lastIrreversibleBlockNumber: 1,
    }
    const versionedActions = await actionHandler._applyUpdaters({}, upgradeHandler[0], {}, false)
    actionHandler._runEffects(versionedActions, {}, nextBlock)

    expect(runEffect).not.toHaveBeenCalled()
    expect(runEffectAfterUpgrade).not.toHaveBeenCalled()

    const blockMeta2 = {
      isRollback: false,
      isFirstBlock: false,
      isNewBlock: true,
    }
    const nextBlock2 = {
      block: upgradeHandler[1],
      blockMeta: blockMeta2,
      lastIrreversibleBlockNumber: 2,
    }
    const versionedActions2 = await actionHandler._applyUpdaters({}, upgradeHandler[1], {}, false)
    actionHandler._runEffects(versionedActions2, {}, nextBlock2)

    expect(runEffect).toHaveBeenCalledTimes(2)
    expect(runEffectAfterUpgrade).toHaveBeenCalledTimes(1)
  })
})
