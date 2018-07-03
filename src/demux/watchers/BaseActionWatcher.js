class BaseActionWatcher {
  constructor({
    actionReader,
    actionHandler,
    pollInterval,
    stateProvider,
  }) {
    this.actionReader = actionReader
    this.actionHandler = actionHandler
    this.pollInterval = pollInterval
    this.stateProvider = stateProvider
  }

  /**
   * Gets the state from the stateProvider and passes it to the actionHandler handleBlock method.
   */
  async handleBlock() {
    throw Error("Must implement `handleBlock`; refer to documentation for details.")
  }

  async watch() {
    // Record start time
    const startTime = new Date().getTime()

    // Process blocks until we're at the head block
    let { headBlockNumber } = this.actionReader
    while (this.actionReader.currentBlockNumber <= headBlockNumber || !headBlockNumber) {
      const { blockData, rollback, firstBlock } = await this.actionReader.nextBlock()

      // Handle block (and the actions within them)
      let nextBlockNeeded = null
      if (blockData) {
        // Dot notation to avoid https://github.com/eslint/eslint/issues/8579#issuecomment-300850889
        nextBlockNeeded = await this.handleBlock().nextBlockNeeded
      }

      // Seek to next needed block at the request of the action handler
      if (nextBlockNeeded) {
        this.actionReader.seekToBlock(nextBlockNeeded - 1)
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
    setTimeout(this.watch.bind(this), waitTime)
  }
}

module.exports = BaseActionWatcher
