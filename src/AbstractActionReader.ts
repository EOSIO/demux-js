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
  public async nextBlock(): Promise<[Block, boolean, boolean]> {
    let blockData = null
    let isRollback = false
    let isNewBlock = false

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
        isNewBlock = true
        this.currentBlockNumber = this.currentBlockData.blockInfo.blockNumber
      } else {
        // Since the new block did not match our history, we can assume our history is wrong
        // and need to roll back
        console.info("!! FORK DETECTED !!")
        console.info(`  MISMATCH:`)
        console.info(`    ✓ NEW Block ${unvalidatedBlockData.blockInfo.blockNumber} previous: ${actualHash}`)
        console.info(`    ✕ OLD Block ${this.currentBlockNumber} id:       ${expectedHash}`)
        await this.resolveFork()
        isNewBlock = true
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

    return [this.currentBlockData, isRollback, isNewBlock]
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
  protected async resolveFork() {
    if (this.currentBlockData === null) {
      throw Error("`currentBlockData` must not be null when initiating fork resolution.")
    }

    // Pop off blocks from cached block history and compare them with freshly fetched blocks
    while (this.blockHistory.length > 0) {
      const [previousBlockData] = this.blockHistory.slice(-1)
      console.info(`Refetching Block ${this.currentBlockData.blockInfo.blockNumber}...`)
      this.currentBlockData = await this.getBlock(this.currentBlockData.blockInfo.blockNumber)
      if (this.currentBlockData !== null) {
        const { blockInfo: currentBlockInfo } = this.currentBlockData
        const { blockInfo: previousBlockInfo } = previousBlockData
        if (currentBlockInfo.previousBlockHash === previousBlockInfo.blockHash) {
          console.info("  MATCH:")
          console.info(`    ✓ NEW Block ${currentBlockInfo.blockNumber} previous: ${currentBlockInfo.previousBlockHash}`) // tslint:disable-line
          console.info(`    ✓ OLD Block ${previousBlockInfo.blockNumber} id:       ${previousBlockInfo.blockHash}`)
          console.info("!! FORK RESOLVED !!")
          break
        }
        console.info("  MISMATCH:")
        console.info(`    ✓ NEW Block ${currentBlockInfo.blockNumber} previous: ${currentBlockInfo.previousBlockHash}`)
        console.info(`    ✕ OLD Block ${previousBlockInfo.blockNumber} id:       ${previousBlockInfo.blockHash}`)
      }

      this.currentBlockData = previousBlockData
      this.blockHistory.pop()
    }
    if (this.blockHistory.length === 0) {
      await this.historyExhausted()
    }
    this.currentBlockNumber = this.blockHistory[this.blockHistory.length - 1].blockInfo.blockNumber + 1
  }

  /**
   * When history is exhausted in rollback(), this is run to handle the situation. If left unimplemented,
   * then only instantiate with `onlyIrreversible` set to true.
   */
  protected historyExhausted() {
    console.info("Rollback history has been exhausted!")
    throw Error("Rollback history has been exhausted, and no rollback exhaustion handling has been implemented.")
  }
}
