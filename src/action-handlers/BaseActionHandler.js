class BaseActionHandler {
  constructor({ state, updaters = [], effects = [] }) {
    this.state = state
    this.updaters = updaters
    this.effects = effects
    this.lastProcessedBlockNumber = 0
    this.lastProcessedBlockHash = "0000000000000000000000000000000000000000000000000000000000000000"
  }

  /**
   * From the object passed to handleActions, retrieve an array of actions
   * @param data
   * @returns {*}
   */
  getActions(data) {
    return data.blockData.actions
  }

  /**
   * From the object passed to handleActions, retrieve an object of block info
   * @param data
   * @returns {{blockNumber: *, blockHash: *, previousBlockHashdata: *}}
   */
  getBlockInfo(data) {
    return {
      blockNumber: data.blockNumber,
      blockHash: data.blockHash,
      previousBlockHashdata: data.previousBlockHash,
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
        if (action.name === updater.name) {
          await updater.update({ state, action, blockInfo, context })
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
        if (action.name === effect.name) {
          effect.effect({ state, action, blockInfo, context })
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
  async handleBlock(data) {
    const blockInfo = this.getBlockInfo(data)
    const actions = this.getActions(data)
    const { rollback } = data
    if (rollback) {
      this.rollbackTo(blockInfo.blockNumber - 1)
    }
    const nextBlockNeeded = this.lastProcessedBlockNumber + 1
    if (blockInfo.blockNumber !== nextBlockNeeded) {
      return { nextBlock: nextBlockNeeded + 1 }
    }
    // Block sequence consistency should be handled by the ChainReader instance
    if (blockInfo.previousBlockHashdata !== this.lastProcessedBlockHash) {
      throw Error("Block hashes do not match; block not part of current chain.")
    }
    this.handleActions({ state: this.state, actions, blockInfo })
    return null
  }

  async handleActions({ state, actions, blockInfo }) {
    const context = {}
    await this.runUpdaters({ state: this.state, actions, blockInfo, context })
    this.runEffects({ state: this.state, actions, blockInfo, context })
    this.lastProcessedBlockNumber = blockInfo.blockNumber
    this.lastProcessedBlockHash = blockInfo.blockHash
  }
}

export { BaseActionHandler }
