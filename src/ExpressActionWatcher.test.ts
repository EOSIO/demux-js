import request from 'supertest'
import { ExpressActionWatcher } from './ExpressActionWatcher'
import { Block } from './interfaces'
import blockchains from './testHelpers/blockchains'
import { TestActionHandler } from './testHelpers/TestActionHandler'
import { TestActionReader } from './testHelpers/TestActionReader'

const wait = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('ExpressActionWatcher', () => {
  let actionReader: TestActionReader
  let actionHandler: TestActionHandler
  let expressActionWatcher: ExpressActionWatcher
  let blockchain: Block[]

  beforeEach(() => {
    actionReader = new TestActionReader()
    actionReader.isInitialized = true
    blockchain = JSON.parse(JSON.stringify(blockchains.blockchain))
    actionReader.blockchain = blockchain

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
    actionHandler = new TestActionHandler([{ versionName: 'v1', updaters, effects: [] }])
    actionHandler.isInitialized = true

    expressActionWatcher = new ExpressActionWatcher(
      actionReader,
      actionHandler,
      {
        pollInterval: 500,
        port: 56544,
        logLevel: 'error',
      }
    )
  })

  afterEach(() => {
    // tslint:disable-next-line:no-floating-promises
    expressActionWatcher.close()
  })

  it('defaults to initial indexing status', async () => {
    await expressActionWatcher.listen()
    const server = request(expressActionWatcher.express)

    const status = await server.get('/info')
    expect(JSON.parse(status.text)).toEqual({
      handler: {
        lastProcessedBlockHash: '',
        lastProcessedBlockNumber: 0,
        isReplay: false,
        lastIrreversibleBlockNumber: 0,
        handlerVersionName: 'v1',
        effectRunMode: 'all',
        effectErrors: [],
        numberOfRunningEffects: 0,
      },
      reader: {
        currentBlockNumber: 0,
        headBlockNumber: 0,
        lastIrreversibleBlockNumber: 0,
        onlyIrreversible: false,
        startAtBlock: 1,
      },
      watcher: {
        currentBlockInterval: 0,
        currentBlockVelocity: 0,
        indexingStatus: 'initial',
        maxBlockVelocity: 0,
      },
    })
  })

  it('starts indexing', async () => {
    await expressActionWatcher.listen()
    const server = request(expressActionWatcher.express)

    const started = await server.post('/start')
    expect(JSON.parse(started.text)).toEqual({
      success: true,
    })
    const statusText = await server.get('/info')
    const status = JSON.parse(statusText.text)
    expect(status.handler).toEqual({
      lastProcessedBlockHash: '0000000000000000000000000000000000000000000000000000000000000003',
      lastProcessedBlockNumber: 4,
      isReplay: false,
      handlerVersionName: 'v1',
      effectRunMode: 'all',
      effectErrors: [],
      numberOfRunningEffects: 0,
    })
    expect(status.reader).toEqual({
      currentBlockNumber: 4,
      headBlockNumber: 4,
      lastIrreversibleBlockNumber: 4,
      onlyIrreversible: false,
      startAtBlock: 1,
    })
    expect(status.watcher.indexingStatus).toEqual('indexing')
  })

  it('pauses indexing', async () => {
    await expressActionWatcher.listen()
    const server = request(expressActionWatcher.express)

    await server.post('/start')
    const paused = await server.post('/pause')
    expect(JSON.parse(paused.text)).toEqual({
      success: true,
    })
    const statusText1 = await server.get('/info')
    const status1 = JSON.parse(statusText1.text)
    expect(status1.handler).toEqual({
      lastProcessedBlockHash: '0000000000000000000000000000000000000000000000000000000000000003',
      lastProcessedBlockNumber: 4,
      isReplay: false,
      handlerVersionName: 'v1',
      effectRunMode: 'all',
      effectErrors: [],
      numberOfRunningEffects: 0,
    })
    expect(status1.reader).toEqual({
      currentBlockNumber: 4,
      headBlockNumber: 4,
      lastIrreversibleBlockNumber: 4,
      onlyIrreversible: false,
      startAtBlock: 1,
    })
    expect(status1.watcher.indexingStatus).toEqual('pausing')
    await wait(500)
    const status2Text = await server.get('/info')
    const status2 = JSON.parse(status2Text.text)
    expect(status2.handler).toEqual({
      lastProcessedBlockHash: '0000000000000000000000000000000000000000000000000000000000000003',
      lastProcessedBlockNumber: 4,
      isReplay: false,
      handlerVersionName: 'v1',
      effectRunMode: 'all',
      effectErrors: [],
      numberOfRunningEffects: 0,
    })
    expect(status2.reader).toEqual({
      currentBlockNumber: 4,
      headBlockNumber: 4,
      lastIrreversibleBlockNumber: 4,
      onlyIrreversible: false,
      startAtBlock: 1,
    })
    expect(status2.watcher.indexingStatus).toEqual('paused')
  })
})
