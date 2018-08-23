const { AbstractActionHandler } = require("demux")

const state = { volumeBySymbol: {}, totalTransfers: 0, indexState: { blockNumber: 0, blockHash: "" } } // Initial state

class ObjectActionHandler extends AbstractActionHandler {
  async handleWithState(handle) {
    await handle(state)
  }

  async loadIndexState() {
    return state.indexState
  }

  async updateIndexState(stateObj, block) {
    stateObj.indexState.blockNumber = block.blockInfo.blockNumber
    stateObj.indexState.blockHash = block.blockInfo.blockHash
  }
}

module.exports = ObjectActionHandler
