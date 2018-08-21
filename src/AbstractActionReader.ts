import { Block } from "./interfaces"

/**
 * Reads blocks from a blockchain, outputting normalized `Block` objects.
 */
export abstract class AbstractActionReader {
  public headBlockNumber: number = 0
  public currentBlockNumber: number
  public isFirstBlock: boolean = true
  protected currentBlockData: Block | null = null
  protected blockHistory: Block[] = []

  constructor(
    public startAtBlock: number = 1,
    protected onlyIrreversible: boolean = false,
    protected maxHistoryLength: number = 600,
  ) {
    this.currentBlockNumber = startAtBlock - 1
  }

  /**
   * Loads the head block number, returning an int.
   * If onlyIrreversible is true, return the most recent irreversible block number
   * @return {Promise<number>}
   */
  public abstract async getHeadBlockNumber(): Promise<number>

  /**
   * Loads a block with the given block number
   * @param {number} blockNumber - Number of the block to retrieve
   * @returns {Block}
   */
  public abstract async getBlock(blockNumber: number): Promise<Block>

  /**
   * Loads the next block with chainInterface after validating, updating all relevant state.
   * If block fails validation, rollback will be called, and will update state to last block unseen.
   */
  public async nextBlock(): Promise<[Block, boolean]> {
    let blockData = null
    let isRollback = false

    // If we're on the head block, refresh current head block
    if (this.currentBlockNumber === this.headBlockNumber || !this.headBlockNumber) {
      this.headBlockNumber = await this.getHeadBlockNumber()
    }

    // If currentBlockNumber is negative, it means we wrap to the end of the chain (most recent blocks)
    // This should only ever happen when we first start, so we check that there's no block history
    if (this.currentBlockNumber < 0 && this.blockHistory.length === 0) {
      this.currentBlockNumber = this.headBlockNumber + this.currentBlockNumber
      this.startAtBlock = this.currentBlockNumber + 1
    }

    // If we're now behind one or more new blocks, process them
    if (this.currentBlockNumber < this.headBlockNumber) {
      const unvalidatedBlockData = await this.getBlock(this.currentBlockNumber + 1)

      const expectedHash = this.currentBlockData !== null ? this.currentBlockData.blockInfo.blockHash : "INVALID"
      const actualHash = unvalidatedBlockData.blockInfo.previousBlockHash

      // Continue if the new block is on the same chain as our history, or if we've just started
      if (expectedHash === actualHash || this.blockHistory.length === 0) {
        blockData = unvalidatedBlockData // Block is now validated
        if (this.currentBlockData) {
          this.blockHistory.push(this.currentBlockData) // No longer current, belongs on history
        }
        this.blockHistory.splice(0, this.blockHistory.length - this.maxHistoryLength) // Trim history
        this.currentBlockData = blockData // Replaced with the real current block
        this.currentBlockNumber = this.currentBlockData.blockInfo.blockNumber
      } else {
        // Since the new block did not match our history, we can assume our history is wrong
        // and need to roll back
        console.info("!! Fork detected !!")
        console.info(`  expected: ${expectedHash}`)
        console.info(`  received: ${actualHash}`)
        await this.rollback()
        isRollback = true // Signal action handler that we must roll back
        // Reset for safety, as new fork could have less blocks than the previous fork
        this.headBlockNumber = await this.getHeadBlockNumber()
      }
    }

    // Let handler know if this is the earliest block we'll send
    this.isFirstBlock = this.currentBlockNumber === this.startAtBlock

    if (this.currentBlockData === null) {
      throw Error("currentBlockData must not be null.")
    }

    return [this.currentBlockData, isRollback]
  }

  /**
   * Move to the specified block.
   */
  public async seekToBlock(blockNumber: number): Promise<void> {
    // Clear current block data
    this.currentBlockData = null
    this.headBlockNumber = 0

    if (blockNumber < this.startAtBlock) {
      throw Error("Cannot seek to block before configured startAtBlock.")
    }

    // If we're going back to the first block, we don't want to get the preceding block
    if (blockNumber === 1) {
      this.blockHistory = []
      this.currentBlockNumber = 0
      return
    }

    // Check if block exists in history
    let toDelete = -1
    for (let i = this.blockHistory.length - 1; i >= 0; i--) {
      if (this.blockHistory[i].blockInfo.blockNumber === blockNumber) {
        break
      } else {
        toDelete += 1
      }
    }
    if (toDelete >= 0) {
      this.blockHistory.splice(toDelete)
      this.currentBlockData = this.blockHistory.pop() || null
    }

    // Load current block
    this.currentBlockNumber = blockNumber - 1
    if (!this.currentBlockData) {
      this.currentBlockData = await this.getBlock(this.currentBlockNumber)
    }
  }

  /**
   * Incrementally rolls back reader state one block at a time, comparing the blockHistory with
   * newly fetched blocks. Rollback is finished when either the current block's previous hash
   * matches the previous block's hash, or when history is exhausted.
   *
   * @return {Promise<void>}
   */
  protected async rollback() {
    let blocksToRewind: number
    // Rewind at least 1 block back
    if (this.blockHistory.length > 0) {
      // TODO:
      // check and throw error if undefined
      const block = this.blockHistory.pop()
      if (block === undefined) {
        throw Error ("block history should not have undefined entries.")
      }
      this.currentBlockData = await this.getBlock(block.blockInfo.blockNumber)
      blocksToRewind = 1
    }

    // Pop off blocks from cached block history and compare them with freshly fetched blocks
    while (this.blockHistory.length > 0) {
      const [cachedPreviousBlockData] = this.blockHistory.slice(-1)
      const previousBlockData = await this.getBlock(cachedPreviousBlockData.blockInfo.blockNumber)
      const currentBlock = this.currentBlockData
      if (currentBlock !== null) {
        const { blockInfo: currentBlockInfo } = currentBlock
        const { blockInfo: previousBlockInfo } = previousBlockData
        if (currentBlockInfo.previousBlockHash === previousBlockInfo.blockHash) {
          console.info(`✓ BLOCK ${currentBlockInfo.blockNumber} MATCH:`)
          console.info(`  expected: ${currentBlockInfo.previousBlockHash}`)
          console.info(`  received: ${previousBlockInfo.blockHash}`)
          console.info(`Rewinding ${blocksToRewind!} blocks to block (${currentBlockInfo.blockNumber})...`)
          break
        }
        console.info(`✕ BLOCK ${currentBlockInfo.blockNumber} MISMATCH:`)
        console.info(`  expected: ${currentBlockInfo.previousBlockHash}`)
        console.info(`  received: ${previousBlockInfo.blockHash}`)
        console.info("Rollback history has been exhausted!")
      }

      this.currentBlockData = previousBlockData
      this.blockHistory.pop()
      blocksToRewind! += 1
    }
    if (this.blockHistory.length === 0) {
      await this.rollbackExhausted()
    }
    this.currentBlockNumber = this.blockHistory[this.blockHistory.length - 1].blockInfo.blockNumber + 1
  }

  /**
   * When history is exhausted in rollback(), this is run to handle the situation. If left unimplemented,
   * then only instantiate with `onlyIrreversible` set to true.
   */
  protected rollbackExhausted() {
    throw Error("Rollback history has been exhausted, and no rollback exhaustion handling has been implemented.")
  }
}
