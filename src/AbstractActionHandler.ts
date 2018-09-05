import { Block, Effect, IndexState, Updater } from "./interfaces"

/**
 * Takes `block`s output from implementations of `AbstractActionReader` and processes their actions through
 * `Updater`s and `Effect`s. Pass an object exposing a persistence API as `state` in the `handleWithState`
 * method. Persist and retrieve information about the last block processed with `updateIndexState` and
 * `loadIndexState`.
 */
export abstract class AbstractActionHandler {
  protected lastProcessedBlockNumber: number = 0
  protected lastProcessedBlockHash: string = ""

  constructor(
    protected updaters: Updater[],
    protected effects: Effect[],
  ) {
  }

  /**
   * Receive block, validate, and handle actions with updaters and effects
   */
  public async handleBlock(
    block: Block,
    isRollback: boolean,
    isFirstBlock: boolean,
    isReplay: boolean = false,
  ): Promise<[boolean, number]> {
    const { blockInfo } = block

    if (isRollback || (isReplay && isFirstBlock)) {
      const rollbackBlockNumber = blockInfo.blockNumber - 1
      const rollbackCount = this.lastProcessedBlockNumber - rollbackBlockNumber
      console.info(`Rolling back ${rollbackCount} blocks to block ${rollbackBlockNumber}...`)
      await this.rollbackTo(rollbackBlockNumber)
      await this.refreshIndexState()
    } else if (!this.lastProcessedBlockHash && this.lastProcessedBlockNumber === 0) {
      await this.refreshIndexState()
    }

    const nextBlockNeeded = this.lastProcessedBlockNumber + 1

    // Just processed this block; skip
    if (blockInfo.blockNumber === this.lastProcessedBlockNumber
        && blockInfo.blockHash === this.lastProcessedBlockHash) {
      return [false, 0]
    }

    // If it's the first block but we've already processed blocks, seek to next block
    if (isFirstBlock && this.lastProcessedBlockHash) {
      return [true, nextBlockNeeded]
    }
    // Only check if this is the block we need if it's not the first block
    if (!isFirstBlock) {
      if (blockInfo.blockNumber !== nextBlockNeeded) {
        return [true, nextBlockNeeded]
      }
      // Block sequence consistency should be handled by the ActionReader instance
      if (blockInfo.previousBlockHash !== this.lastProcessedBlockHash) {
        throw Error("Block hashes do not match; block not part of current chain.")
      }
    }

    const handleWithArgs: (state: any, context?: any) => Promise<void> = async (state: any, context: any = {}) => {
      await this.handleActions(state, block, context, isReplay)
    }
    await this.handleWithState(handleWithArgs)
    return [false, 0]
  }

  /**
   * Updates the `lastProcessedBlockNumber` and `lastProcessedBlockHash` meta state, coinciding with the block
   * that has just been processed. These are the same values read by `updateIndexState()`.
   */
  protected abstract async updateIndexState(state: any, block: Block, isReplay: boolean, context?: any): Promise<void>

  /**
   * Returns a promise for the `lastProcessedBlockNumber` and `lastProcessedBlockHash` meta state,
   * coinciding with the block that has just been processed.
   * These are the same values written by `updateIndexState()`.
   * @returns A promise that resolves to an `IndexState`
   */
  protected abstract async loadIndexState(): Promise<IndexState>

  /**
   * Calls handleActions with the appropriate state passed by calling the `handle` parameter function.
   * Optionally, pass in a `context` object as a second parameter.
   */
  protected abstract async handleWithState(handle: (state: any, context?: any) => void): Promise<void>

  /**
   * Process actions against deterministically accumulating updater functions.
   */
  protected async runUpdaters(
    state: any,
    block: Block,
    context: any,
  ): Promise<void> {
    const { actions, blockInfo } = block
    for (const action of actions) {
      for (const updater of this.updaters) {
        if (action.type === updater.actionType) {
          const { payload } = action
          await updater.updater(state, payload, blockInfo, context)
        }
      }
    }
  }

  /**
   * Process actions against asynchronous side effects.
   */
  protected runEffects(
    state: any,
    block: Block,
    context: any,
  ): void {
    const { actions, blockInfo } = block
    for (const action of actions) {
      for (const effect of this.effects) {
        if (action.type === effect.actionType) {
          const { payload } = action
          effect.effect(state, payload, blockInfo, context)
        }
      }
    }
  }

  /**
   * Will run when a rollback block number is passed to handleActions. Implement this method to
   * handle reversing actions full blocks at a time, until the last applied block is the block
   * number passed to this method.
   */
  protected abstract async rollbackTo(blockNumber: number): Promise<void>

  /**
   * Calls `runUpdaters` and `runEffects` on the given actions
   */
  protected async handleActions(
    state: any,
    block: Block,
    context: any,
    isReplay: boolean,
  ): Promise<void> {
    const { blockInfo } = block

    await this.runUpdaters(state, block, context)
    if (!isReplay) {
      this.runEffects(state, block, context)
    }

    await this.updateIndexState(state, block, isReplay, context)
    this.lastProcessedBlockNumber = blockInfo.blockNumber
    this.lastProcessedBlockHash = blockInfo.blockHash
  }

  private async refreshIndexState() {
    const { blockNumber, blockHash } = await this.loadIndexState()
    this.lastProcessedBlockNumber = blockNumber
    this.lastProcessedBlockHash = blockHash
  }
}
