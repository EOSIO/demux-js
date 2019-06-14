import { AbstractActionHandler } from './AbstractActionHandler'
import { AbstractActionReader } from './AbstractActionReader'
import { BunyanProvider, Logger } from './BunyanProvider'
import { ActionWatcherOptions, DemuxInfo, IndexingStatus, WatcherInfo } from './interfaces'

/**
 * Coordinates implementations of `AbstractActionReader`s and `AbstractActionHandler`s in
 * a polling loop.
 */
export class BaseActionWatcher {
  /**
   * @param actionReader    An instance of an implemented `AbstractActionReader`
   * @param actionHandler   An instance of an implemented `AbstractActionHandler`
   * @param options
   */

  protected log: Logger
  protected pollInterval: number
  protected velocitySampleSize: number
  protected processIntervals: Array<[number, number]> = []
  private running: boolean = false
  private shouldPause: boolean = false
  private error: Error | null = null
  private clean: boolean = true

  constructor(
    protected actionReader: AbstractActionReader,
    protected actionHandler: AbstractActionHandler,
    options: ActionWatcherOptions,
  ) {
    const optionsWithDefault = {
      pollInterval: 250,
      velocitySampleSize: 20,
      ...options,
    }
    this.pollInterval = optionsWithDefault.pollInterval
    this.velocitySampleSize = optionsWithDefault.velocitySampleSize
    this.log = BunyanProvider.getLogger()
  }

  /**
   * Starts a polling loop running in replay mode.
   */
  public async replay() {
    await this.watch(true)
  }

  /**
   * Start a polling loop
   *
   * @param isReplay  Set to true to disable Effects from running until caught up with head block.
   */
  public async watch(isReplay: boolean = false) {
    if (this.shouldPause) {
      this.running = false
      this.shouldPause = false
      this.log.info('Indexing paused.')
      return
    }
    this.clean = false
    this.running = true
    this.error = null
    const startTime = Date.now()

    this.log.debug('Checking for blocks')
    try {
      await this.checkForBlocks(isReplay)
    } catch (err) {
      this.running = false
      this.shouldPause = false
      this.processIntervals = []
      this.log.error(err)
      this.error = err
      this.log.info('Indexing unexpectedly stopped due to an error.')
      return
    }

    const endTime = Date.now()
    const duration = endTime - startTime
    let waitTime = this.pollInterval - duration
    if (waitTime < 0) {
      waitTime = 0
    }
    this.log.debug(`Block check took ${duration}ms; waiting ${waitTime}ms before next check`)
    setTimeout(async () => await this.watch(false), waitTime)
  }

  /**
   * Start or resume indexing.
   */
  public start(): boolean {
    if (this.running) {
      this.log.info('Cannot start; already indexing.')
      return false
    }
    this.log.info('Starting indexing.')

    // tslint:disable-next-line:no-floating-promises
    this.watch()
    return true
  }

  /**
   * Suspend indexing. Will go into effect after the currently-processing block.
   */
  public pause(): boolean {
    if (!this.running) {
      this.log.info('Cannot pause; not currently indexing.')
      return false
    }
    this.log.info('Pausing indexing.')
    this.shouldPause = true
    return true
  }

  /**
   * Information about the current state of this Action Watcher
   */
  public get info(): DemuxInfo {
    const currentBlockVelocity = this.getCurrentBlockVelocity()

    const watcherInfo: WatcherInfo = {
      indexingStatus: this.getIndexingStatus(),
      currentBlockVelocity,
      currentBlockInterval: currentBlockVelocity ? 1 / currentBlockVelocity : 0,
      maxBlockVelocity: this.getMaxBlockVelocity()
    }
    if (this.error) {
      watcherInfo.error = this.error
    }
    return {
      handler: this.actionHandler.info,
      reader: this.actionReader.info,
      watcher: watcherInfo,
    }
  }

  /**
   * Use the actionReader and actionHandler to process new blocks.
   *
   * @param isReplay  Set to true to disable Effects from running until caught up with head block.
   */
  protected async checkForBlocks(isReplay: boolean = false) {
    let headBlockNumber = 0
    while (!headBlockNumber || this.actionReader.currentBlockNumber < headBlockNumber) {
      if (this.shouldPause) {
        this.processIntervals = []
        return
      }
      const readStartTime = Date.now()
      const nextBlock = await this.actionReader.getNextBlock()
      const readDuration = readStartTime - Date.now()
      if (!nextBlock.blockMeta.isNewBlock) { break }

      const handleStartTime = Date.now()
      const nextBlockNumberNeeded = await this.actionHandler.handleBlock(
        nextBlock,
        isReplay,
      )
      const handleEndTime = Date.now()
      const handleDuration = handleStartTime - handleEndTime
      this.log.info(`Processed block ${nextBlock.block.blockInfo.blockNumber}`)
      this.log.debug(`${readDuration}ms read + ${handleDuration}ms handle = ${readDuration + handleDuration}ms`)
      this.addProcessInterval(readStartTime, handleEndTime)

      if (nextBlockNumberNeeded) {
        const seekStartTime = Date.now()
        await this.actionReader.seekToBlock(nextBlockNumberNeeded)
        const seekDuration = seekStartTime - Date.now()
        this.log.info(`Seeked to block ${nextBlockNumberNeeded}`)
        this.log.debug(`Seek time: ${seekDuration}ms`)
      }

      headBlockNumber = this.actionReader.headBlockNumber
    }
  }

  private addProcessInterval(start: number, end: number) {
    this.processIntervals.push([start, end])
    if (this.processIntervals.length > this.velocitySampleSize) {
      this.processIntervals.splice(0, this.processIntervals.length - this.velocitySampleSize)
    }
  }

  private getCurrentBlockVelocity(): number {
    if (this.processIntervals.length < 2) { return 0 }
    const start = this.processIntervals[0][0]
    const end = this.processIntervals[this.processIntervals.length - 1][0]
    const interval = end - start
    return  (this.processIntervals.length - 1) / (interval / 1000)
  }

  private getMaxBlockVelocity(): number {
    if (this.processIntervals.length === 0) { return 0 }
    const processTimes = this.processIntervals.map(([start, end]) => end - start)
    const totalTime = processTimes.reduce(
      (prev: number, curr: number) => (prev + curr)
    )
    const averageTime = totalTime / processTimes.length
    if (averageTime === 0) { return 0 }
    return 1000 / averageTime
  }

  private getIndexingStatus(): IndexingStatus {
    if (this.clean) { return IndexingStatus.Initial }
    if (this.running && !this.shouldPause) { return IndexingStatus.Indexing }
    if (this.running && this.shouldPause) { return IndexingStatus.Pausing }
    if (this.error) { return IndexingStatus.Stopped }
    return IndexingStatus.Paused
  }
}
