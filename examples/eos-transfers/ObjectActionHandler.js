const { handlers: { AbstractActionHandler } } = require("../../dist/")

const state = { volumeBySymbol: {}, totalTransfers: 0, indexState: { blockNumber: 0, blockHash: "" } } // Initial state

class ObjectActionHandler extends AbstractActionHandler {
  async handleWithState(handle) {
    await handle(state)
  }

  async loadIndexState() {
    return state.indexState
  }

  async updateIndexState(stateObj, block) {
    stateObj.indexState.blockNumber = block.blockNumber
    stateObj.indexState.blockHash = block.blockHash
  }
}

module.exports = ObjectActionHandler
