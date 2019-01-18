import * as Logger from "bunyan"
import { AbstractActionHandler } from "./AbstractActionHandler"
import { AbstractActionReader } from "./AbstractActionReader"
import { DemuxInfo } from "./interfaces"

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
  private error: Error | null = null

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
   *
   * @param isReplay  Set to true to disable Effects from running until caught up with head block.
   */
  public async watch(isReplay: boolean = false) {
    if (this.shouldPause) {
      this.running = false
      this.shouldPause = false
      this.log.info("Indexing paused.")
      return
    }
    this.running = true
    this.error = null
    const startTime = Date.now()

    try {
      await this.checkForBlocks(isReplay)
    } catch (err) {
      this.running = false
      this.shouldPause = false
      this.log.error(err)
      this.error = err
      this.log.info("Indexing unexpectedly paused due to an error.")
      return
    }

    const endTime = Date.now()
    const duration = endTime - startTime
    let waitTime = this.pollInterval - duration
    if (waitTime < 0) {
      waitTime = 0
    }
    setTimeout(async () => await this.watch(false), waitTime)
  }

  /**
   * Start or resume indexing.
   */
  public start(): boolean {
    if (this.running) {
      this.log.info("Cannot start; already indexing.")
      return false
    }
    this.log.info("Starting indexing.")
    this.watch()
    return true
  }

  /**
   * Suspend indexing. Will go into effect after the currently-processing block.
   */
  public pause(): boolean {
    if (!this.running) {
      this.log.info("Cannot pause; not currently indexing.")
      return false
    }
    this.log.info("Pausing indexing.")
    this.shouldPause = true
    return true
  }

  /**
   * Information about the current state of Demux
   */
  public get info(): DemuxInfo {
    let status
    if (this.running && !this.shouldPause) {
      status = "indexing"
    } else if (this.running && this.shouldPause) {
      status = "pausing"
    } else {
      status = "paused"
    }

    const info: DemuxInfo = {
      handler: this.actionHandler.info,
      reader: this.actionReader.info,
      status,
    }
    if (this.error) {
      info.error = this.error
    }
    return info
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
