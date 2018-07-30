import { AbstractActionHandler } from "../handlers/AbstractActionHandler"
import { AbstractActionReader } from "../readers/AbstractActionReader"

/**
 * Cooredinates implementations of `AbstractActionReader`s and `AbstractActionHandler`s in
 * a polling loop.
 */
export class BaseActionWatcher {
  constructor(
    protected actionReader: AbstractActionReader,
    protected actionHandler: AbstractActionHandler,
    protected pollInterval: number) {
  }

  /**
   * Starts a polling loop running in replay mode.
   */
  public async replay() {
    await this.actionReader.seekToBlock(this.actionReader.startAtBlock)
    await this.watch()
  }

  /**
   * Uses the given actionReader and actionHandler to poll and process new blocks.
   */
  protected async watch() {
    // Record start time
    const startTime = new Date().getTime()

    // Process blocks until we're at the head block
    let headBlockNumber = 0
    while (!headBlockNumber || this.actionReader.currentBlockNumber < headBlockNumber) {
      const [blockData, isRollback] = await this.actionReader.nextBlock()

      // Handle block (and the actions within them)
      let needToSeek = false
      let seekBlockNum = 0
      if (blockData) {
        [needToSeek, seekBlockNum] = await this.actionHandler.handleBlock(
          blockData,
          isRollback,
          this.actionReader.isFirstBlock,
        )
      }

      // Seek to next needed block at the request of the action handler
      if (needToSeek) {
        await this.actionReader.seekToBlock(seekBlockNum - 1)
      }

      headBlockNumber = this.actionReader.headBlockNumber
    }

    // Record end time
    const endTime = new Date().getTime()

    // Calculate timing for next iteration
    const duration = endTime - startTime
    let waitTime = this.pollInterval - duration
    if (waitTime < 0) {
      waitTime = 0
    }

    // Schedule next iteration
    setTimeout(async () => await this.watch(), waitTime)
  }
}
