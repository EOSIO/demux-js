class AbstractChainReader {
  constructor({ chainInterface, startAtBlock = 1, onlyIrreversible = false, maxHistoryLength = 600 }) {
    this.chainInterface = chainInterface
    this.headBlockNumber = null
    this.currentBlockNumber = startAtBlock - 1 || null
    this.currentBlockData = null
    this.onlyIrreversible = onlyIrreversible
    this.blockHistory = []
    this.maxHistoryLength = maxHistoryLength
  }

  /**
   * Loads the head block number info with chainInterface, returning an int.
   * If onlyIrreversible is true, return the most recent irreversible block number
   */
  getHeadBlockNumber() {
    throw Error("Must implement `getHeadBlockNumber`; refer to documentation for details.")
  }

  /**
   * Loads the block with chainInterface, returning an object with block data
   * normalized with normalizeBlockData
   * @param {number} blockNumber - Number of the block to retrieve
   */
  getBlock(blockNumber) {
    throw Error("Must implement `getBlock`; refer to documentation for details.")
  }

  /**
   * Given a blockData object, retrieve and return an object containing
   * actions, blockNumber, blockHash, previousBlockHash, and lastIrreversibleBlock.
   * @param blockData
   */
  normalizeBlockData(blockData) {
    throw Error("Must implement `normalizeBlockData`; refer to documentation for details.")
  }

  /**
   * Loads the next block with chainInterface after validating, updating all relevant state.
   * If block fails validation, rollback will be called, and will update state to last block unseen.
   */
  async nextBlock() {
    let blockData = null
    let rollback = false

    // If we're on the head block, refresh current head block
    if (this.currentBlockNumber === this.headBlockNumber || !this.headBlockNumber) {
      this.headBlockNumber = await this.getHeadBlockNumber()
    }

    // If we're now behind one or more new blocks, process them
    if (this.currentBlockNumber < this.headBlockNumber) {
      const unvalidatedBlockData = await this.getBlock(this.currentBlockNumber + 1)
      const { blockHash: expectedHash } = this.blockHistory[this.blockHistory.length - 1] || {}
      const { previousBlockHash: actualHash } = unvalidatedBlockData

      // Continue if the new block is on the same chain as our history, or if we've just started
      if (expectedHash === actualHash || this.blockHistory.length === 0) {
        blockData = unvalidatedBlockData // Block now validated
        this.blockHistory.push(this.currentBlockData) // No longer current
        this.blockHistory.splice(0, this.blockHistory.length - this.maxHistoryLength) // Trim history
        this.currentBlockData = blockData // Replaced with the real current
        this.currentBlockNumber = this.currentBlockData.blockNumber
      } else {
        // Since the new block did not match our history, we can assume our history is wrong
        // and need to roll back
        this.rollback()
        blockData = this.currentBlockData
        rollback = true
      }
    }
    return { blockData, rollback }
  }

  /**
   * Incrementally rolls back reader state one block at a time, comparing the blockHistory with
   * newly fetched blocks. Rollback is finished when either the current block's previous hash
   * matches the previous block's hash, or when history is exhausted.
   *
   * @returns {Promise<void>}
   */
  async rollback() {
    console.info("!! Fork detected !!")

    // Rewind at least 1 block back
    this.currentBlockData = await this.getBlock(this.blockHistory.pop())
    let blocksToRewind = 1

    // Pop off blocks from cached block history and compare them with freshly fetched blocks
    while (this.blockHistory.length > 0) {
      const [cachedPreviousBlockData] = this.blockHistory.slice(-1)
      const previousBlockData = await this.getBlock(cachedPreviousBlockData.blockNumber)
      if (this.currentBlockData.previousBlockHash === previousBlockData.blockHash) {
        console.info(`✓ BLOCK ${this.currentBlockData.blockNumber} MATCH:`)
        console.info(`  expected: ${this.currentBlockData.previousBlockHash}`)
        console.info(`  received: ${previousBlockData.blockHash}`)
        console.info(`Rewinding ${blocksToRewind} blocks to block (${this.currentBlockData.blockNumber})...`)
        break
      }
      console.info(`✕ BLOCK ${this.currentBlockData.blockNumber} MISMATCH:`)
      console.info(`  expected: ${this.currentBlockData.previousBlockHash}`)
      console.info(`  received: ${previousBlockData.blockHash}`)
      console.info("Rollback history has been exhausted!")

      this.currentBlockData = previousBlockData
      this.blockHistory.pop()
      blocksToRewind += 1
    }
    if (this.blockHistory.length === 0) {
      await this.rollbackExhausted()
    }
  }

  /**
   * When history is exhausted in rollback(), this is run to handle the situation.
   */
  rollbackExhausted() {
    throw Error("Rollback history has been exhausted, and no rollback exhaustion handling has been implemented.")
  }

  seekToBlock(blockNumber) {
    // Clear current block data
    this.currentBlockData = null

    // Check if block exists in history
    let toDelete = -1
    for (const cachedBlockData of this.blockHistory) {
      if (cachedBlockData.blockNumber === blockNumber) {
        break
      } else {
        toDelete += 1
      }
    }
    if (toDelete >= 0) {
      this.blockHistory.splice(this.blockHistory.length - toDelete)
      this.currentBlockData = this.blockHistory.pop() || null
    }

    // Load current block
    this.currentBlockNumber = blockNumber - 1
    if (!this.currentBlockData) {
      this.currentBlockData = this.getBlock(this.currentBlockNumber)
    }
  }
}

export { AbstractChainReader }
