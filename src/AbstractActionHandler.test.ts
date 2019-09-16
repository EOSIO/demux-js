import { MismatchedBlockHashError, NotInitializedError } from './errors'
import { ActionCallback, EffectRunMode, StatelessActionCallback } from './interfaces'
import blockchains from './testHelpers/blockchains'
import { TestActionHandler } from './testHelpers/TestActionHandler'
import { wait } from './testHelpers/wait'
import Mock = jest.Mock

const { blockchain, upgradeHandler } = blockchains

describe('Action Handler', () => {
  let actionHandler: TestActionHandler
  let noHashValidationActionHandler: TestActionHandler
  let noEffectActionHandler: TestActionHandler
  let deferredEffectActionHandler: TestActionHandler
  let immediateEffectActionHandler: TestActionHandler

  let runUpdater: ActionCallback
  let runEffect: StatelessActionCallback

  let notRunUpdater: ActionCallback
  let notRunEffect: StatelessActionCallback

  let startSlowEffect: Mock
  let finishSlowEffect: Mock
  let startThrownEffect: Mock

  let runUpgradeUpdater: ActionCallback

  let runUpdaterAfterUpgrade: ActionCallback
  let runEffectAfterUpgrade: StatelessActionCallback

  let notRunUpdaterAfterUpgrade: ActionCallback
  let notRunEffectAfterUpgrade: StatelessActionCallback

  beforeEach(() => {
    runUpdater = jest.fn()
    runEffect = jest.fn().mockResolvedValue(undefined)

    notRunUpdater = jest.fn()
    notRunEffect = jest.fn().mockResolvedValue(undefined)

    startSlowEffect = jest.fn().mockResolvedValue(undefined)
    finishSlowEffect = jest.fn()
    startThrownEffect = jest.fn().mockResolvedValue(undefined)

    runUpgradeUpdater = jest.fn().mockReturnValue('v2')

    runUpdaterAfterUpgrade = jest.fn()
    runEffectAfterUpgrade = jest.fn()

    notRunUpdaterAfterUpgrade = jest.fn()
    notRunEffectAfterUpgrade = jest.fn()

    const handlerVersions = [
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
          {
            actionType: 'testing::action',
            run: async () => {
              await startSlowEffect()
              await wait(100, finishSlowEffect)
            },
            deferUntilIrreversible: false,
          },
          {
            actionType: 'eosio.system::regproducer',
            run: async () => {
              await startThrownEffect()
              throw Error('Thrown effect')
            }
          }
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
    ]

    actionHandler = new TestActionHandler(
      handlerVersions,
      { logLevel: 'error' }
    )
    noHashValidationActionHandler = new TestActionHandler(
      handlerVersions,
      { logLevel: 'error', validateBlocks: false }
    )
    noEffectActionHandler = new TestActionHandler(
      handlerVersions,
      { logLevel: 'error', effectRunMode: EffectRunMode.None}
    )
    deferredEffectActionHandler = new TestActionHandler(
      handlerVersions,
      { logLevel: 'error', effectRunMode: EffectRunMode.OnlyDeferred}
    )
    immediateEffectActionHandler = new TestActionHandler(
      handlerVersions,
      { logLevel: 'error', effectRunMode: EffectRunMode.OnlyImmediate}
    )

    actionHandler.isInitialized = true
    noHashValidationActionHandler.isInitialized = true
    noEffectActionHandler.isInitialized = true
    deferredEffectActionHandler.isInitialized = true
    immediateEffectActionHandler.isInitialized = true
  })

  it('runs the correct updater based on action type', async () => {
    const blockMeta = {
      isRollback: false,
      isEarliestBlock: true,
      isNewBlock: true
    }
    const nextBlock = {
      block:  blockchain[1],
      blockMeta,
      lastIrreversibleBlockNumber: 2,
    }
    await actionHandler._applyUpdaters({}, nextBlock, {}, false)
    expect(runUpdater).toHaveBeenCalledTimes(1)
    expect(notRunUpdater).not.toHaveBeenCalled()
  })

  it('runs the correct effect based on action type', async () => {
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
    const versionedActions = await actionHandler._applyUpdaters({}, nextBlock, {},  false)
    await actionHandler._runEffects(versionedActions, {}, nextBlock)
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
    actionHandler.setLastProcessedBlockNumber(blockchain[1].blockInfo.blockNumber)
    actionHandler.setLastProcessedBlockHash(blockchain[1].blockInfo.blockHash)
    actionHandler.state.indexState = {
      ...actionHandler.state.indexState,
      blockNumber: blockchain[1].blockInfo.blockNumber,
      blockHash: blockchain[1].blockInfo.blockHash,
    }
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
    await actionHandler.initialize()
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
    await expect(result).rejects.toThrow(MismatchedBlockHashError)
  })

  it(`doesn't throw error if validateBlocks is false`, async () => {
    await noHashValidationActionHandler.initialize()
    noHashValidationActionHandler.setLastProcessedBlockNumber(3)
    noHashValidationActionHandler.setLastProcessedBlockHash('asdfasdfasdf')
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

    const result = noHashValidationActionHandler.handleBlock(nextBlock, false)
    await expect(result).resolves.toBeNull()
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
    const versionedActions = await actionHandler._applyUpdaters({}, nextBlock, {}, false)
    await actionHandler._runEffects(versionedActions, {}, nextBlock)

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
    const versionedActions = await actionHandler._applyUpdaters({}, nextBlock, {}, false)
    await actionHandler._runEffects(versionedActions, {}, nextBlock)

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
    const versionedActions2 = await actionHandler._applyUpdaters({}, nextBlock2, {}, false)
    await actionHandler._runEffects(versionedActions2, {}, nextBlock2)

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

    expect(actionHandler.info.lastProcessedBlockNumber).toEqual(2)
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

  it('continues if initialization succeeds', async () => {
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
    await expect(result).rejects.toThrow(NotInitializedError)
  })

  it(`doesn't run effect when effect mode is none`, async () => {
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
    const versionedActions = await noEffectActionHandler._applyUpdaters({}, nextBlock, {},  false)
    await noEffectActionHandler._runEffects(versionedActions, {}, nextBlock)
    expect(runEffect).not.toHaveBeenCalled()
  })

  it(`runs effect when effect mode is OnlyDeferred`, async () => {
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
    const versionedActions = await deferredEffectActionHandler._applyUpdaters({}, nextBlock, {},  false)
    await deferredEffectActionHandler._runEffects(versionedActions, {}, nextBlock)
    expect(runEffect).toHaveBeenCalled()
  })

  it(`doesn't run effect when effect mode is OnlyImmediate`, async () => {
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
    const versionedActions = await immediateEffectActionHandler._applyUpdaters({}, nextBlock, {},  false)
    await immediateEffectActionHandler._runEffects(versionedActions, {}, nextBlock)
    expect(runEffect).not.toHaveBeenCalled()
  })

  it('keeps track of running effects', async () => {
    const blockMeta = {
      isRollback: false,
      isEarliestBlock: true,
      isNewBlock: true,
    }
    const nextBlock = {
      block: blockchain[0],
      blockMeta,
      lastIrreversibleBlockNumber: 2,
    }
    const versionedActions = await actionHandler._applyUpdaters({}, nextBlock, {},  false)
    await actionHandler._runEffects(versionedActions, {}, nextBlock)
    expect(startSlowEffect).toHaveBeenCalled()
    expect(finishSlowEffect).not.toHaveBeenCalled()
    expect(actionHandler.info.numberOfRunningEffects).toEqual(1)
    await wait(200)
    expect(finishSlowEffect).toHaveBeenCalled()
    expect(actionHandler.info.numberOfRunningEffects).toEqual(0)
  })

  it('keeps track of thrown effects', async () => {
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
    const versionedActions = await actionHandler._applyUpdaters({}, nextBlock, {},  false)
    await actionHandler._runEffects(versionedActions, {}, nextBlock)
    expect(startThrownEffect).toHaveBeenCalled()
    expect(actionHandler.info.numberOfRunningEffects).toEqual(0)
    expect(actionHandler.info.effectErrors).toHaveLength(1)
    expect(actionHandler.info.effectErrors![0].startsWith('Error: Thrown effect')).toBeTruthy()
  })
})
