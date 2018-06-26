class BaseActionWatcher {
  constructor({
    actionReader,
    actionHandler,
    pollInterval,
  }) {
    this.actionReader = actionReader
    this.actionHandler = actionHandler
    this.pollInterval = pollInterval
  }

  async watch() {
    // Record start time
    const startTime = new Date().getTime()

    // Process blocks until we're at the head block
    let { headBlockNumber } = this.actionReader
    while (this.actionReader.currentBlockNumber <= headBlockNumber) {
      const { blockData, rollback } = await this.actionReader.nextBlock()

      // Handle actions
      let nextBlock = null
      if (blockData) {
        ({ nextBlock } = await this.actionHandler.handleActions({ blockData, rollback }))
      }

      // Seek to next needed block at the request of the action handler
      if (nextBlock) {
        this.actionReader.seekToBlock(nextBlock - 1)
      }

      // Reset headBlockNumber on rollback for safety, as it may have decreased
      if (rollback) {
        ({ headBlockNumber } = this.actionReader)
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
    setTimeout(this.watch, waitTime)
  }
}

export { BaseActionWatcher }
