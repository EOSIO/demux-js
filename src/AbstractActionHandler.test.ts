import { MismatchedBlockHashError, NotInitializedError } from './errors'
import { ActionCallback, StatelessActionCallback } from './interfaces'
import blockchains from './testHelpers/blockchains'
import { TestActionHandler } from './testHelpers/TestActionHandler'

const { blockchain, upgradeHandler } = blockchains

describe('Action Handler', () => {
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

    runUpgradeUpdater = jest.fn().mockReturnValue('v2')

    runUpdaterAfterUpgrade = jest.fn()
    runEffectAfterUpgrade = jest.fn()

    notRunUpdaterAfterUpgrade = jest.fn()
    notRunEffectAfterUpgrade = jest.fn()

    actionHandler = new TestActionHandler([
      {
        versionName: 'v1',
        updaters: [
          {
            actionType: 'eosio.token::transfer',
            apply: runUpdater,
          },
          {
            actionType: 'mycontract::upgrade',
            apply: runUpgradeUpdater,
          },
          {
            actionType: 'eosio.token::issue',
            apply: notRunUpdater,
          },
        ],
        effects: [
          {
            actionType: 'eosio.token::transfer',
            run: runEffect,
            deferUntilIrreversible: true,
          },
          {
            actionType: 'eosio::bidname',
            run: runEffect,
            deferUntilIrreversible: true,
          },
          {
            actionType: 'eosio.token::issue',
            run: notRunEffect,
            deferUntilIrreversible: true,
          },
        ],
      },
      {
        versionName: 'v2',
        updaters: [
          {
            actionType: 'eosio.token::transfer',
            apply: notRunUpdaterAfterUpgrade,
          },
          {
            actionType: 'eosio.token::issue',
            apply: runUpdaterAfterUpgrade,
          },
        ],
        effects: [
          {
            actionType: 'eosio.token::transfer',
            run: notRunEffectAfterUpgrade,
            deferUntilIrreversible: true,
          },
          {
            actionType: 'eosio.token::issue',
            run: runEffectAfterUpgrade,
            deferUntilIrreversible: true,
          },
        ],
      },
    ])

    actionHandler.isInitialized = true
  })

  it('runs the correct updater based on action type', async () => {
    await actionHandler._applyUpdaters({}, blockchain[1], {}, false)
    expect(runUpdater).toHaveBeenCalledTimes(1)
    expect(notRunUpdater).not.toHaveBeenCalled()
  })

  it('runs the correct effect based on action type', async () => {
    const versionedActions = await actionHandler._applyUpdaters({}, blockchain[1], {},  false)
    const blockMeta = {
      isRollback: false,
      isEarliestBlock: true,
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

  it('retrieves indexState when processing first block', async () => {
    actionHandler.state.indexState = {
      blockNumber: 3,
      blockHash: '000f42401b5636c3c1d88f31fe0e503654091fb822b0ffe21c7d35837fc9f3d8',
    }
    const blockMeta = {
      isRollback: false,
      isEarliestBlock: true,
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

  it('seeks to the next block needed when block number doesn\'t match last processed block', async () => {
    actionHandler.setLastProcessedBlockNumber(2)
    const blockMeta = {
      isRollback: false,
      isEarliestBlock: false,
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

  it('throws error if previous block hash and last processed don\'t match up', async () => {
    actionHandler.setLastProcessedBlockNumber(3)
    actionHandler.setLastProcessedBlockHash('asdfasdfasdf')
    const blockMeta = {
      isRollback: false,
      isEarliestBlock: false,
      isNewBlock: true,
    }
    const nextBlock = {
      block: blockchain[3],
      blockMeta,
      lastIrreversibleBlockNumber: 1,
    }
    const result = actionHandler.handleBlock(nextBlock, false)
    expect(result).rejects.toThrow(MismatchedBlockHashError)
  })

  it('upgrades the action handler correctly', async () => {
    const blockMeta = {
      isRollback: false,
      isEarliestBlock: true,
      isNewBlock: true,
    }
    const nextBlock = {
      block: upgradeHandler[0],
      blockMeta,
      lastIrreversibleBlockNumber: 2,
    }
    const versionedActions = await actionHandler._applyUpdaters({}, upgradeHandler[0], {}, false)
    actionHandler._runEffects(versionedActions, {}, nextBlock)

    expect(actionHandler._handlerVersionName).toEqual('v2')
    expect(runUpdater).toHaveBeenCalledTimes(1)
    expect(runEffect).toHaveBeenCalledTimes(2)
    expect(runUpgradeUpdater).toHaveBeenCalledTimes(1)
    expect(notRunUpdater).not.toHaveBeenCalled()
    expect(notRunUpdaterAfterUpgrade).not.toHaveBeenCalled()
    expect(runUpdaterAfterUpgrade).toHaveBeenCalledTimes(1)
    expect(notRunEffectAfterUpgrade).not.toHaveBeenCalled()
    expect(runEffectAfterUpgrade).toHaveBeenCalledTimes(1)
  })

  it('defers the effects until the block is irreversible', async () => {
    const blockMeta = {
      isRollback: false,
      isEarliestBlock: true,
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
      isEarliestBlock: false,
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

  it('rolls back', async () => {
    const blockMeta1 = {
      isRollback: false,
      isEarliestBlock: true,
      isNewBlock: true,
    }
    const nextBlock1 = {
      block: blockchain[0],
      blockMeta: blockMeta1,
      lastIrreversibleBlockNumber: 1,
    }
    await actionHandler.handleBlock(nextBlock1, false)

    const blockMeta2 = {
      isRollback: false,
      isEarliestBlock: false,
      isNewBlock: true,
    }
    const nextBlock2 = {
      block: blockchain[1],
      blockMeta: blockMeta2,
      lastIrreversibleBlockNumber: 1,
    }
    await actionHandler.handleBlock(nextBlock2, false)

    const blockMeta3 = {
      isRollback: false,
      isEarliestBlock: false,
      isNewBlock: true,
    }
    const nextBlock3 = {
      block: blockchain[2],
      blockMeta: blockMeta3,
      lastIrreversibleBlockNumber: 1,
    }
    await actionHandler.handleBlock(nextBlock3, false)

    // Roll back
    const rollbackMeta = {
      isRollback: true,
      isEarliestBlock: false,
      isNewBlock: true,
    }
    const rollback2 = {
      block: blockchain[1],
      blockMeta: rollbackMeta,
      lastIrreversibleBlockNumber: 1,
    }
    await actionHandler.handleBlock(rollback2, false)

    expect(actionHandler.lastProcessedBlockNumber).toEqual(2)
  })

  it(`doesn't run effects from orphaned blocks`, async () => {
    const blockMeta1 = {
      isRollback: false,
      isEarliestBlock: true,
      isNewBlock: true,
    }
    const nextBlock1 = {
      block: blockchain[0],
      blockMeta: blockMeta1,
      lastIrreversibleBlockNumber: 1,
    }
    await actionHandler.handleBlock(nextBlock1, false)

    const blockMeta2 = {
      isRollback: false,
      isEarliestBlock: false,
      isNewBlock: true,
    }
    const nextBlock2 = {
      block: blockchain[1],
      blockMeta: blockMeta2,
      lastIrreversibleBlockNumber: 1,
    }
    await actionHandler.handleBlock(nextBlock2, false)

    const blockMeta3 = {
      isRollback: false,
      isEarliestBlock: false,
      isNewBlock: true,
    }
    const nextBlock3 = {
      block: blockchain[2],
      blockMeta: blockMeta3,
      lastIrreversibleBlockNumber: 1,
    }
    await actionHandler.handleBlock(nextBlock3, false)

    const rollbackMeta = {
      isRollback: true,
      isEarliestBlock: false,
      isNewBlock: true,
    }
    const rollback2 = {
      block: blockchain[1],
      blockMeta: rollbackMeta,
      lastIrreversibleBlockNumber: 1,
    }
    await actionHandler.handleBlock(rollback2, false)

    const incrementIrreversible3 = {
      block: upgradeHandler[1], // block number 3, no actions this time
      blockMeta: blockMeta3,
      lastIrreversibleBlockNumber: 2,
    }
    await actionHandler.handleBlock(incrementIrreversible3, false)

    expect(runEffect).toHaveBeenCalledTimes(2)
    expect(notRunEffect).not.toHaveBeenCalled()
  })

  it('continues if setup is true', async () => {
    actionHandler.state.indexState = {
      blockNumber: 3,
      blockHash: '000f42401b5636c3c1d88f31fe0e503654091fb822b0ffe21c7d35837fc9f3d8',
    }
    const blockMeta = {
      isRollback: false,
      isEarliestBlock: true,
      isNewBlock: true,
    }
    const nextBlock = {
      block: blockchain[0],
      blockMeta,
      lastIrreversibleBlockNumber: 1,
    }
    actionHandler.isInitialized = true
    const seekBlockNum = await actionHandler.handleBlock(nextBlock, false)
    expect(seekBlockNum).toBe(4)
  })

  it('throws if iniatilization fails', async () => {
    actionHandler.state.indexState = {
      blockNumber: 3,
      blockHash: '000f42401b5636c3c1d88f31fe0e503654091fb822b0ffe21c7d35837fc9f3d8',
    }
    const blockMeta = {
      isRollback: false,
      isEarliestBlock: true,
      isNewBlock: true,
    }
    const nextBlock = {
      block: blockchain[0],
      blockMeta,
      lastIrreversibleBlockNumber: 1,
    }
    actionHandler.isInitialized = false
    const result = actionHandler.handleBlock(nextBlock, false)
    expect(result).rejects.toThrow(NotInitializedError)
  })
})
