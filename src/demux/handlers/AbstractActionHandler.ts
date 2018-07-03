export default abstract class AbstractActionHandler {
    updaters: Updater[]
    effects: Effect[]
    _lastProcessedBlockNumber: number
    _lastProcessedBlockHash: string

    constructor(updaters: Updater[], effects: Effect[]) {
        this.updaters = updaters
        this.effects = effects
        this._lastProcessedBlockNumber = 0
        this._lastProcessedBlockHash = ""
    }

    /**
   * From the object passed to handleActions, retrieve an array of actions
   * @param {Block} blockData
   * @returns {Action[]}
   */
  getActions(blockData: Block): Action[] {
    return blockData.actions
  }

  /**
   * From the object passed to handleActions, retrieve an object of block info
   * @param {Block} blockData
   * @returns {BlockInfo}
   */
  getBlockInfo(blockData: Block): BlockInfo {
    return {
      blockNumber: blockData.blockNumber,
      blockHash: blockData.blockHash,
      previousBlockHash: blockData.previousBlockHash,
    }
  }

  /**
   * Process actions against deterministically accumulating updater functions.
   * @param {any} state
   * @param {Action[]} actions
   * @param {BlockInfo} blockInfo
   * @param {any} context
   * @returns {Promise<void>}
   */
  async runUpdaters(state: any, actions: Action[], blockInfo: BlockInfo, context: any): Promise<void> {
    for (const action of actions) {
      for (const updater of this.updaters) {
        if (action.type === updater.actionType) {
          const { payload } = action
          await updater.updater({ state, payload, blockInfo, context })
        }
      }
    }
  }

  /**
   * Process actions against asynchronous side effects.
   * @param {any} state
   * @param {Action[]} actions
   * @param {BlockInfo} blockInfo
   * @param {any} context
   */
  runEffects(state: any, actions: Action[], blockInfo: BlockInfo, context: any): void {
    for (const action of actions) {
      for (const effect of this.effects) {
        if (action.type === effect.actionType) {
          const { payload } = action
          effect.effect({ state, payload, blockInfo, context })
        }
      }
    }
  }

  /**
   * Will run when a rollback block number is passed to handleActions. Implement this method to
   * handle reversing actions full blocks at a time, until the last applied block is the block
   * number passed to this method.
   *
   * @param {number} blockNumber
   * @returns {Promise<void>}
   */
  abstract async rollbackTo(blockNumber: number): Promise<void>

  /**
   * Receive block, validate, and handle actions with updaters and effects
   * @param {Block} blockData
   * @param {boolean} rollback
   * @param {boolean} firstBlock
   * @returns {Promise<[boolean, number]>}
   */
  async handleBlock(blockData: Block, rollback: boolean, firstBlock: boolean): Promise<[boolean, number]> {
    const blockInfo = this.getBlockInfo(blockData)
    const actions = this.getActions(blockData)
    if (rollback) {
      await this.rollbackTo(blockInfo.blockNumber - 1)
    }

    const nextBlockNeeded = this._lastProcessedBlockNumber + 1
    // If it's the first block but we've already processed blocks, seek to next block
    if (firstBlock && this._lastProcessedBlockHash) {
      return [true, nextBlockNeeded]
    }
    // Only check if this is the block we need if it's not the first block
    if (!firstBlock) {
      if (blockInfo.blockNumber !== nextBlockNeeded) {
        return [true, nextBlockNeeded]
      }
      // Block sequence consistency should be handled by the ActionReader instance
      if (blockInfo.previousBlockHash !== this._lastProcessedBlockHash) {
        throw Error("Block hashes do not match; block not part of current chain.")
      }
    }

    const handleWithArgs: (state: any) => void = async (state: any) => this.handleActions(state, actions, blockInfo)
    await this.handleWithState(handleWithArgs)
    return [false, 0]
  }

  /**
   * Calls runUpdaters and runEffects on the given actions
   * @param {any} state
   * @param {Action[]} actions
   * @param {BlockInfo} blockInfo
   */
  async handleActions(state: any, actions: Action[], blockInfo: BlockInfo): Promise<void> {
    const context = {}
    await this.runUpdaters(state, actions, blockInfo, context)
    this.runEffects(state, actions, blockInfo, context)
    this._lastProcessedBlockNumber = blockInfo.blockNumber
    this._lastProcessedBlockHash = blockInfo.blockHash
  }

  /**
   * Calls handleActions with the appropriate state using the passed in handle function
   * @param {(state: any) => void} handle 
   */
  abstract async handleWithState(handle: (state: any) => void): Promise<void>
}