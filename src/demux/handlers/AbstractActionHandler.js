class AbstractActionHandler {
  constructor({ updaters = [], effects = [] }) {
    this.updaters = updaters
    this.effects = effects
    this._lastProcessedBlockNumber = 0
    this._lastProcessedBlockHash = null
  }

  /**
   * From the object passed to handleActions, retrieve an array of actions
   * @param data
   * @returns {*}
   */
  getActions(blockData) {
    return blockData.actions
  }

  /**
   * From the object passed to handleActions, retrieve an object of block info
   * @param data
   * @returns {{blockNumber: *, blockHash: *, previousBlockHash: *}}
   */
  getBlockInfo(blockData) {
    return {
      blockNumber: blockData.blockNumber,
      blockHash: blockData.blockHash,
      previousBlockHash: blockData.previousBlockHash,
    }
  }

  /**
   * Process actions against deterministically accumulating updater functions.
   * @param state
   * @param actions
   * @param blockInfo
   * @param context
   * @returns {Promise<void>}
   */
  async runUpdaters({ state, actions, blockInfo, context }) {
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
   * @param state
   * @param actions
   * @param blockInfo
   * @param context
   */
  runEffects({ state, actions, blockInfo, context }) {
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
   * @param blockNumber
   * @returns {Promise<void>}
   */
  async rollbackTo(blockNumber) {
    throw Error("rollbackTo not implemented.")
  }

  /**
   * Receive block, validate, and handle actions with updaters and effects
   * @param data
   * @returns {Promise<*>}
   */
  async handleBlock({ state, blockData, rollback, firstBlock }) {
    const blockInfo = this.getBlockInfo(blockData)
    const actions = this.getActions(blockData)
    if (rollback) {
      await this.rollbackTo(blockInfo.blockNumber - 1)
    }

    const nextBlockNeeded = this._lastProcessedBlockNumber + 1
    // If it's the first block but we've already processed blocks, seek to next block
    if (firstBlock && this._lastProcessedBlockHash) {
      return { nextBlockNeeded }
    }
    // Only check if this is the block we need if it's not the first block
    if (!firstBlock) {
      if (blockInfo.blockNumber !== nextBlockNeeded) {
        return { nextBlockNeeded }
      }
      // Block sequence consistency should be handled by the ActionReader instance
      if (blockInfo.previousBlockHash !== this._lastProcessedBlockHash) {
        throw Error("Block hashes do not match; block not part of current chain.")
      }
    }

    const handleWithArgs = async state => this.handleActions({ actions, blockInfo }, state)
    await this.handleWithState(handleWithArgs)
    return {}
  }

  async handleActions({ actions, blockInfo }, state) {
    const context = {}
    await this.runUpdaters({ state, actions, blockInfo, context })
    this.runEffects({ state, actions, blockInfo, context })
    this._lastProcessedBlockNumber = blockInfo.blockNumber
    this._lastProcessedBlockHash = blockInfo.blockHash
  }

  async handleWithState(handle) {
    throw Error("Must implement `handleWithState`; refer to documentation for details.")
  }
}

module.exports = AbstractActionHandler
