import * as Logger from "bunyan"
import { AbstractActionHandler } from "./AbstractActionHandler"
import { AbstractActionReader } from "./AbstractActionReader"
import { DemuxStatus } from "./interfaces"

/**
 * Coordinates implementations of `AbstractActionReader`s and `AbstractActionHandler`s in
 * a polling loop.
 */
export class BaseActionWatcher {
  /**
   * @param actionReader    An instance of an implemented `AbstractActionReader`
   * @param actionHandler   An instance of an implemented `AbstractActionHandler`
   * @param pollInterval    Number of milliseconds between each polling loop iteration
   */

  protected log: Logger
  private running: boolean = false
  private shouldPause: boolean = false

  constructor(
    protected actionReader: AbstractActionReader,
    protected actionHandler: AbstractActionHandler,
    protected pollInterval: number,
  ) {
    this.log = Logger.createLogger({ name: "demux" })
  }

  /**
   * Starts a polling loop running in replay mode.
   */
  public async replay() {
    await this.watch(true)
  }

  /**
   * Start a polling loop
   */
  public async watch(isReplay: boolean = false) {
    try {
      this.running = true
      const startTime = new Date().getTime()

      await this.checkForBlocks(isReplay)
      if (this.shouldPause) {
        this.running = false
        this.shouldPause = false
        this.log.info("Demux paused.")
        return
      }

      const endTime = new Date().getTime()
      const duration = endTime - startTime
      let waitTime = this.pollInterval - duration
      if (waitTime < 0) {
        waitTime = 0
      }

      setTimeout(async () => await this.watch(false), waitTime)
    } catch (err) {
      this.running = false
      this.shouldPause = false
      this.log.error(err)
      this.log.info("Demux stopped due to error.")
    }
  }

  public start() {
    if (this.running) {
      return false
    }
    this.log.info("Demux starting...")
    this.watch()
    return true
  }

  public pause() {
    if (!this.running) {
      return false
    }
    this.log.info("Demux stopping...")
    this.shouldPause = true
    return true
  }

  public get status(): DemuxStatus {
    return {
      running: this.running,
      lastProcessedBlockNumber: this.actionHandler.lastProcessedBlockNumber,
      lastProcessedBlockHash: this.actionHandler.lastProcessedBlockHash,
      handlerVersionName: this.actionHandler.handlerVersionName,
    }
  }

  /**
   * Use the actionReader and actionHandler to process new blocks.
   */
  protected async checkForBlocks(isReplay: boolean = false) {
    let headBlockNumber = 0
    if (this.shouldPause) {
      return
    }
    while (!headBlockNumber || this.actionReader.currentBlockNumber < headBlockNumber) {
      if (this.shouldPause) {
        return
      }

      const nextBlock = await this.actionReader.getNextBlock()
      if (!nextBlock.blockMeta.isNewBlock) { break }

      const nextBlockNumberNeeded = await this.actionHandler.handleBlock(
        nextBlock,
        isReplay,
      )

      if (nextBlockNumberNeeded) {
        await this.actionReader.seekToBlock(nextBlockNumberNeeded - 1)
      }

      headBlockNumber = this.actionReader.headBlockNumber
    }
  }
}
