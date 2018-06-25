class BaseActionWatcher {
  constructor({
    chainReader,
    actionHandler,
    pollInterval,
  }) {
    this.chainReader = chainReader
    this.actionHandler = actionHandler
    this.pollInterval = pollInterval
  }

  async watch() {
    // Record start time
    const startTime = new Date().getTime()

    // Get next block
    const { blockData, rollback } = await this.chainReader.nextBlock()

    // Handle actions
    let nextBlock = null
    if (blockData) {
      ({ nextBlock } = await this.actionHandler.handleActions({ blockData, rollback }))
    }

    if (nextBlock) {
      this.actionHandler.seekToBlock(nextBlock - 1)
    }

    // Record end time
    const endTime = new Date().getTime()

    // Calculate timing for next iteration
    // TODO: Set timing to be an offset of when the block is scheduled
    const duration = endTime - startTime
    let waitTime = this.pollInterval - duration
    if (waitTime < 0) {
      waitTime = 0
    }

    // Schedule next iteration
    setTimeout(this.watch, waitTime)
  }
}

export { BaseActionWatcher }
