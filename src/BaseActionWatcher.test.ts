import { BaseActionWatcher } from './BaseActionWatcher'
import { ActionWatcherOptions, Block } from './interfaces'
import blockchains from './testHelpers/blockchains'
import { TestActionHandler } from './testHelpers/TestActionHandler'
import { TestActionReader } from './testHelpers/TestActionReader'

class TestActionWatcher extends BaseActionWatcher {
  public async _checkForBlocks(isReplay: boolean = false) {
    await this.checkForBlocks(isReplay)
  }
  public setProcessIntervals(intervals: Array<[number, number]>) {
    this.processIntervals = intervals
  }
}

describe('BaseActionWatcher', () => {
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
    actionReader = new TestActionReader({ logLevel: 'error' })
    actionReader.isInitialized = true

    actionReaderStartAt3 = new TestActionReader({ startAtBlock: 3, logLevel: 'error' })
    actionReaderStartAt3.isInitialized = true

    actionReaderNegative = new TestActionReader({ startAtBlock: -1, logLevel: 'error' })
    actionReaderNegative.isInitialized = true

    blockchain = JSON.parse(JSON.stringify(blockchains.blockchain))
    actionReader.blockchain = blockchain
    actionReaderStartAt3.blockchain = blockchain
    actionReaderNegative.blockchain = blockchain

    const updaters = [{
      actionType: 'eosio.token::transfer',
      apply: async (state: any, payload: any) => {
        if (!state.totalTransferred) {
          state.totalTransferred = parseFloat(payload.data.quantity.amount)
        } else {
          state.totalTransferred += parseFloat(payload.data.quantity.amount)
        }
      },
    }]
    const effects = [{
      actionType: 'eosio.token::transfer',
      run: runEffect,
    }]

    actionHandler = new TestActionHandler([{ versionName: 'v1', updaters, effects }])
    actionHandler.isInitialized = true

    actionHandlerStartAt3 = new TestActionHandler([{ versionName: 'v1', updaters, effects }])
    actionHandlerStartAt3.isInitialized = true

    actionHandlerNegative = new TestActionHandler([{ versionName: 'v1', updaters, effects }])
    actionHandlerNegative.isInitialized = true

    const actionWatcherOptions: ActionWatcherOptions = {
      pollInterval: 500,
      velocitySampleSize: 3,
      logLevel: 'error',
    }
    actionWatcher = new TestActionWatcher(actionReader, actionHandler, actionWatcherOptions)
    actionWatcherStartAt3 = new TestActionWatcher(actionReaderStartAt3, actionHandlerStartAt3, actionWatcherOptions)
    actionWatcherNegative = new TestActionWatcher(actionReaderNegative, actionHandlerNegative, actionWatcherOptions)
  })

  it('processes blocks', async () => {
    await actionWatcher._checkForBlocks()
    expect(actionHandler.state).toEqual({
      indexState: {
        blockHash: '0000000000000000000000000000000000000000000000000000000000000003',
        blockNumber: 4,
        handlerVersionName: 'v1',
        isReplay: false,
      },
      totalTransferred: 66,
    })
    expect(actionReader.currentBlockNumber).toBe(4)
  })

  it('processes blocks starting at block 3', async () => {
    await actionWatcherStartAt3._checkForBlocks()
    expect(actionHandlerStartAt3.state).toEqual({
      indexState: {
        blockHash: '0000000000000000000000000000000000000000000000000000000000000003',
        blockNumber: 4,
        handlerVersionName: 'v1',
        isReplay: false,
      },
      totalTransferred: 24,
    })
    expect(actionReaderStartAt3.currentBlockNumber).toBe(4)
  })

  it('processes blocks starting at block 3 (negative indexed)', async () => {
    await actionWatcherNegative._checkForBlocks()
    expect(actionHandlerNegative.state).toEqual({
      indexState: {
        blockHash: '0000000000000000000000000000000000000000000000000000000000000003',
        blockNumber: 4,
        handlerVersionName: 'v1',
        isReplay: false,
      },
      totalTransferred: 24,
    })
    expect(actionReaderNegative.currentBlockNumber).toBe(4)
  })

  it('processes blocks after seeing more blocks', async () => {
    await actionWatcher._checkForBlocks()
    actionReader.blockchain.push({
      blockInfo: {
        blockHash: 'newblock',
        blockNumber: 5,
        previousBlockHash: '0000000000000000000000000000000000000000000000000000000000000003',
        timestamp: new Date('2018-06-06T11:53:39.500'),
      },
      actions: [{
        payload: {
          account: 'eosio.token',
          actionIndex: 0,
          authorization: [],
          data: {
            quantity: {
              amount: '123.00000',
              symbol: 'EOS',
            },
          },
          name: 'transfer',
          transactionId: '1',
        },
        type: 'eosio.token::transfer',
      }],
    })
    await actionWatcher._checkForBlocks()
    expect(actionHandler.state).toEqual({
      indexState: {
        blockHash: 'newblock',
        blockNumber: 5,
        handlerVersionName: 'v1',
        isReplay: false,
      },
      totalTransferred: 189,
    })
  })

  it('continues indexing where action handler left off', async () => {
    actionHandler.state.indexState = {
      blockNumber: blockchain[2].blockInfo.blockNumber,
      blockHash: blockchain[2].blockInfo.blockHash,
      handlerVersionName: 'v1',
    }
    await actionWatcher._checkForBlocks()
    expect(actionHandler.state.indexState.blockNumber).toEqual(4)
    expect(actionReader.currentBlockNumber).toBe(4)
    expect(actionReader.headBlockNumber).toBe(4)
  })

  it('resolves fork', async () => {
    actionReader._testLastIrreversible = 1
    actionReader.blockchain = blockchain.slice(0, 4)
    await actionWatcher._checkForBlocks()
    actionReader.blockchain = blockchains.forked
    await actionWatcher._checkForBlocks()
    expect(actionHandler.state.indexState.blockNumber).toEqual(5)
    expect(actionReader.currentBlockNumber).toBe(5)
    expect(actionReader.headBlockNumber).toBe(5)
  })

  it('gives the correct block velocity', () => {
    actionWatcher.setProcessIntervals([
      [0, 1000],
      [2000, 3000],
      [4000, 5000],
    ])
    const { currentBlockVelocity, currentBlockInterval, maxBlockVelocity } = actionWatcher.info.watcher
    expect(currentBlockVelocity).toEqual(0.5)
    expect(currentBlockInterval).toEqual(2)
    expect(maxBlockVelocity).toEqual(1)
  })

  it('gives no block velocity', () => {
    actionWatcher.setProcessIntervals([
      [0, 1000],
    ])
    const { currentBlockVelocity, currentBlockInterval, maxBlockVelocity } = actionWatcher.info.watcher
    expect(currentBlockVelocity).toEqual(0)
    expect(currentBlockInterval).toEqual(0)
    expect(maxBlockVelocity).toEqual(1)
  })

  it('gives no max block velocity', () => {
    const { currentBlockVelocity, currentBlockInterval, maxBlockVelocity } = actionWatcher.info.watcher
    expect(currentBlockVelocity).toEqual(0)
    expect(currentBlockInterval).toEqual(0)
    expect(maxBlockVelocity).toEqual(0)
  })
})
