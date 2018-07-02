/**
 * Reads an EOSIO nodeos node to get actions.
 * It is important to note that deferred transactions will not be included, as these are not accessible without plugins.
 */

const request = require("request-promise-native")

const AbstractActionReader = require("./AbstractActionReader")

/**
 * Implementation of an ActionReader that polls a node using `get_block`.
 */
class NodeosActionReader extends AbstractActionReader {
  constructor({
    nodeosEndpoint = "http://localhost:8888",
    startAtBlock = 1,
    onlyIrreversible = false,
    maxHistoryLength = 600,
  }) {
    super({ startAtBlock, onlyIrreversible, maxHistoryLength })
    this.nodeosEndpoint = nodeosEndpoint.replace(/\/+$/g, "") // Remove trailing slashes
  }

  async getHeadBlockNumber() {
    const blockInfo = await request.get({
      url: `${this.nodeosEndpoint}/v1/chain/get_info`,
      json: true,
    })
    if (this.onlyIrreversible) {
      return blockInfo.last_irreversible_block_num
    }
    return blockInfo.head_block_num
  }

  async getBlock(blockNumber) {
    const rawBlock = await request.post({
      url: `${this.nodeosEndpoint}/v1/chain/get_block`,
      json: { block_num_or_id: blockNumber },
    })
    const actions = this.collectActionsFromBlock(rawBlock)
    return {
      actions,
      blockNumber: rawBlock.block_num,
      blockHash: rawBlock.id,
      previousBlockHash: rawBlock.previous,
    }
  }

  flattenArray(arr) {
    return arr.reduce((flat, toFlatten) =>
      flat.concat(Array.isArray(toFlatten) ? this.flattenArray(toFlatten) : toFlatten), [])
  }

  collectActionsFromBlock(rawBlock) {
    return this.flattenArray(rawBlock.transactions.map((transaction) => {
      if (!transaction.trx.transaction) {
        return [] // Deferred transaction, cannot decode
      }
      return transaction.trx.transaction.actions.map((action, actionIndex) => {
        // Delete unneeded hex data if we have deserialized data
        if (action.data) {
          delete action.hex_data // eslint-disable-line
        }
        return {
          type: `${action.account}::${action.name}`,
          payload: {
            transactionId: transaction.trx.id,
            actionIndex,
            ...action,
          },
        }
      })
    }))
  }
}

module.exports = NodeosActionReader
