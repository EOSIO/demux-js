import * as Logger from "bunyan"
import { Block, BlockInfo } from "./interfaces"

/**
 * Reads blocks from a blockchain, outputting normalized `Block` objects.
 */
export abstract class AbstractActionReader {
  public headBlockNumber: number = 0
  public currentBlockNumber: number
  public isFirstBlock: boolean = true
  protected currentBlockData: Block | null = null
  protected lastIrreversibleBlockNumber: number = 0
  protected blockHistory: Block[] = []
  protected log: Logger
  private isFirstRun: boolean = true

 /**
  * @param startAtBlock      For positive values, this sets the first block that this will start at. For negative
  *                          values, this will start at (most recent block + startAtBlock), effectively tailing the
  *                          chain. Be careful when using this feature, as this will make your starting block dynamic.
  *
  * @param onlyIrreversible  When false (default), `getHeadBlockNumber` will load the most recent block number. When
  *                          true, `getHeadBlockNumber` will return the block number of the most recent irreversible
  *                          block. Keep in mind that `getHeadBlockNumber` is an abstract method and this functionality
  *                          is the responsibility of the implementing class.
  *
  * @param maxHistoryLength  This determines how many blocks in the past are cached. This is used for determining
  *                          block validity during both normal operation and when rolling back.
  */
  constructor(
    public startAtBlock: number = 1,
    protected onlyIrreversible: boolean = false,
    protected maxHistoryLength: number = 600,
  ) {
    this.currentBlockNumber = startAtBlock - 1
    this.log = Logger.createLogger({ name: "demux" })
  }

  /**
   * Loads the number of the latest block.
   */
  public abstract async getHeadBlockNumber(): Promise<number>

  /**
   * Loads the number of the most recent irreversible block.
   */
  public abstract async getLastIrreversibleBlockNumber(): Promise<number>

  /**
   * Loads a block with the given block number, returning a promise for a `Block`.
   *
   * @param blockNumber  The number of the block to load
   */
  public abstract async getBlock(blockNumber: number): Promise<Block>

  /**
   * Loads, processes, and returns the next block, updating all relevant state. Return value at index 0 is the `Block`
   * instance; return value at index 1 boolean `isRollback` determines if the implemented `AbstractActionHandler` needs
   * to potentially reverse processed blocks (in the event of a fork); return value at index 2 boolean `isNewBlock`
   * indicates if the `Block` instance returned is the same one that was just returned from the last call of
   * `nextBlock`.
   */
  public async nextBlock(): Promise<[Block, boolean, boolean]> {
    let blockData = null
    let isRollback = false
    let isNewBlock = false

    // If we're on the head block, refresh current head block
    if (this.currentBlockNumber === this.headBlockNumber || !this.headBlockNumber) {
      this.headBlockNumber = await this.getLatestNeededBlockNumber()
    }

    // If currentBlockNumber is negative, it means we wrap to the end of the chain (most recent blocks)
    if (this.currentBlockNumber < 0 && this.isFirstRun) {
      this.currentBlockNumber = this.headBlockNumber + this.currentBlockNumber
      this.startAtBlock = this.currentBlockNumber + 1
    } else if (this.isFirstRun) {
      this.isFirstRun = false
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
        this.logForkDetected(unvalidatedBlockData, expectedHash, actualHash)
        await this.resolveFork()
        isNewBlock = true
        isRollback = true // Signal action handler that we must roll back
        // Reset for safety, as new fork could have less blocks than the previous fork
        this.headBlockNumber = await this.getLatestNeededBlockNumber()
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
   * Changes the state of the `AbstractActionReader` instance to have just processed the block at the given block
   * number. If the block exists in its temporary block history, it will use this, otherwise it will fetch the block
   * using `getBlock`.
   *
   * The next time `nextBlock()` is called, it will load the block after this input block number.
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

    // Fetch block if there is no history
    if (this.blockHistory.length === 0) {
      await this.addPreviousBlockToHistory(false)
    }
  }

  /**
   * Incrementally rolls back reader state one block at a time, comparing the blockHistory with
   * newly fetched blocks. Fork resolution is finished when either the current block's previous hash
   * matches the previous block's hash, or when history is exhausted.
   */
  protected async resolveFork() {
    if (this.currentBlockData === null) {
      throw Error("`currentBlockData` must not be null when initiating fork resolution.")
    }

    if (this.blockHistory.length === 0) {
      await this.addPreviousBlockToHistory()
    }

    // Pop off blocks from cached block history and compare them with freshly fetched blocks
    while (this.blockHistory.length > 0) {
      if (this.blockHistory.length === 0) {
        await this.addPreviousBlockToHistory()
      }
      const [previousBlockData] = this.blockHistory.slice(-1)
      this.log.info(`Refetching Block ${this.currentBlockData.blockInfo.blockNumber}...`)
      this.currentBlockData = await this.getBlock(this.currentBlockData.blockInfo.blockNumber)
      if (this.currentBlockData !== null) {
        const { blockInfo: currentBlockInfo } = this.currentBlockData
        const { blockInfo: previousBlockInfo } = previousBlockData
        if (currentBlockInfo.previousBlockHash === previousBlockInfo.blockHash) {
          this.logForkResolved(currentBlockInfo, previousBlockInfo)
          break
        }
        this.logForkMismatch(currentBlockInfo, previousBlockInfo)
      }

      this.currentBlockData = previousBlockData
      this.blockHistory.pop()
    }

    this.currentBlockNumber = this.blockHistory[this.blockHistory.length - 1].blockInfo.blockNumber + 1
  }

  private async getLatestNeededBlockNumber() {
    this.lastIrreversibleBlockNumber = await this.getLastIrreversibleBlockNumber()
    if (this.onlyIrreversible) {
      return this.lastIrreversibleBlockNumber
    } else {
      return this.getHeadBlockNumber()
    }
  }

  private async addPreviousBlockToHistory(checkIrreversiblility: boolean = true) {
    if (!this.currentBlockData) {
      throw Error("`currentBlockData` must not be null when initiating fork resolution.")
    }

    if (this.currentBlockData.blockInfo.blockNumber <= this.lastIrreversibleBlockNumber && checkIrreversiblility) {
      throw new Error("Last irreversible block has been passed without resolving fork")
    }
    this.blockHistory.push(await this.getBlock(this.currentBlockData.blockInfo.blockNumber - 1))
  }

  private logForkDetected(unvalidatedBlockData: Block, expectedHash: string, actualHash: string) {
    this.log.info("!! FORK DETECTED !!")
    this.log.info(`  MISMATCH:`)
    this.log.info(`    ✓ NEW Block ${unvalidatedBlockData.blockInfo.blockNumber} previous: ${actualHash}`)
    this.log.info(`    ✕ OLD Block ${this.currentBlockNumber} id:       ${expectedHash}`)
  }

  private logForkResolved(currentBlockInfo: BlockInfo, previousBlockInfo: BlockInfo) {
    this.log.info("  MATCH:")
    this.log.info(`    ✓ NEW Block ${currentBlockInfo.blockNumber} previous: ${currentBlockInfo.previousBlockHash}`) // tslint:disable-line
    this.log.info(`    ✓ OLD Block ${previousBlockInfo.blockNumber} id:       ${previousBlockInfo.blockHash}`)
    this.log.info("!! FORK RESOLVED !!")
  }

  private logForkMismatch(currentBlockInfo: BlockInfo, previousBlockInfo: BlockInfo) {
    this.log.info("  MISMATCH:")
    this.log.info(`    ✓ NEW Block ${currentBlockInfo.blockNumber} previous: ${currentBlockInfo.previousBlockHash}`)
    this.log.info(`    ✕ OLD Block ${previousBlockInfo.blockNumber} id:       ${previousBlockInfo.blockHash}`)
  }
}
