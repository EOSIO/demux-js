const { AbstractActionHandler } = require("demux")

let state = { volumeBySymbol: {}, totalTransfers: 0, indexState: { blockNumber: 0, blockHash: "" } } // Initial state
const stateHistory = {}
const stateHistoryMaxLength = 300

class ObjectActionHandler extends AbstractActionHandler {
  async handleWithState(handle) {
    await handle(state)
    const { blockNumber } = state.indexState
    stateHistory[blockNumber] = JSON.parse(JSON.stringify(state))
    if (blockNumber > stateHistoryMaxLength && stateHistory[blockNumber - stateHistoryMaxLength]) {
      delete stateHistory[blockNumber - stateHistoryMaxLength]
    }
  }

  async loadIndexState() {
    return state.indexState
  }

  async updateIndexState(stateObj, block) {
    stateObj.indexState.blockNumber = block.blockInfo.blockNumber
    stateObj.indexState.blockHash = block.blockInfo.blockHash
  }

  async rollbackTo(blockNumber) {
    const latestBlockNumber = state.indexState.blockNumber
    const toDelete = [...Array(latestBlockNumber - (blockNumber)).keys()].map(n => n + blockNumber + 1)
    for (const n of toDelete) {
      delete stateHistory[n]
    }
    state = stateHistory[blockNumber]
  }
}

module.exports = ObjectActionHandler
