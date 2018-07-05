import AbstractActionHandler from "../handlers/AbstractActionHandler"
import AbstractActionReader from "../readers/AbstractActionReader"

export default abstract class AbstractActionWatcher {
  protected actionReader: AbstractActionReader
  protected actionHandler: AbstractActionHandler
  protected pollInterval: number

  constructor(actionReader: AbstractActionReader, actionHandler: AbstractActionHandler, pollInterval: number) {
    this.actionReader = actionReader
    this.actionHandler = actionHandler
    this.pollInterval = pollInterval
  }

  /**
   * Gets the state from the stateProvider and passes it to the actionHandler handleBlock method.
   */
  public async handleBlock(): Promise<[boolean, number]> {
    throw Error("Must implement `handleBlock`; refer to documentation for details.")
  }

  public async watch() {
    // Record start time
    const startTime = new Date().getTime()

    // Process blocks until we're at the head block
    let { headBlockNumber } = this.actionReader
    while (!headBlockNumber || this.actionReader.currentBlockNumber <= headBlockNumber ) {
      const [blockData, rollback] = await this.actionReader.nextBlock()

      // Handle block (and the actions within them)
      let needToSeek = false
      let seekBlockNum = 0
      if (blockData) {
        [needToSeek, seekBlockNum] = await this.handleBlock()
      }

      // Seek to next needed block at the request of the action handler
      if (needToSeek) {
        this.actionReader.seekToBlock(seekBlockNum - 1)
      }

      // Reset headBlockNumber on rollback for safety, as it may have decreased
      if (rollback) {
        headBlockNumber = this.actionReader.headBlockNumber
      }
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
    setTimeout(this.watch.bind(this), waitTime)
  }
}
