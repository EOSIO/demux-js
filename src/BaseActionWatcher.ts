import { AbstractActionHandler } from "./AbstractActionHandler"
import { AbstractActionReader } from "./AbstractActionReader"

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
  constructor(
    protected actionReader: AbstractActionReader,
    protected actionHandler: AbstractActionHandler,
    protected pollInterval: number) {
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
    const startTime = new Date().getTime()

    await this.checkForBlocks(isReplay)

    const endTime = new Date().getTime()
    const duration = endTime - startTime
    let waitTime = this.pollInterval - duration
    if (waitTime < 0) {
      waitTime = 0
    }

    setTimeout(async () => await this.watch(false), waitTime)
  }

  /**
   * Use the actionReader and actionHandler to process new blocks.
   */
  protected async checkForBlocks(isReplay: boolean = false) {
    let headBlockNumber = 0
    while (!headBlockNumber || this.actionReader.currentBlockNumber < headBlockNumber) {
      const [blockData, blockMeta] = await this.actionReader.nextBlock()
      if (!blockMeta.isNewBlock) { break }

      let seekBlockNum = null
      if (blockData) {
        seekBlockNum = await this.actionHandler.handleBlock(
          blockData,
          blockMeta,
          isReplay,
        )
      }

      if (seekBlockNum) {
        await this.actionReader.seekToBlock(seekBlockNum - 1)
      }

      headBlockNumber = this.actionReader.headBlockNumber
    }
  }
}
