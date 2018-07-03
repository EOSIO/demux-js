/**
 * Reads an EOSIO nodeos node to get actions.
 * It is important to note that deferred transactions will not be included, as these are not accessible without plugins.
 */

import AbstractActionReader from "./AbstractActionReader"

/**
 * Implementation of an ActionReader that polls a node using `get_block`.
 */
export default class NodeosActionReader extends AbstractActionReader {
  nodeosEndpoint: string
  requestInstance: any
  constructor(
    nodeosEndpoint = "http://localhost:8888",
    startAtBlock = 1,
    onlyIrreversible = false,
    maxHistoryLength = 600,
    requestInstance: any
  ) {
    super(startAtBlock, onlyIrreversible, maxHistoryLength)
    this.nodeosEndpoint = nodeosEndpoint.replace(/\/+$/g, "") // Remove trailing slashes
    this.requestInstance = requestInstance
  }

  async httpRequest(method: string, requestParams: any): Promise<any> {
    if (method === "get") {
      return await this.requestInstance.get(requestParams)
    } else if (method === "post") {
      return await this.requestInstance.post(requestParams)
    }
  }

  async getHeadBlockNumber(): Promise<number> {
    const blockInfo = await this.httpRequest("get", {
      url: `${this.nodeosEndpoint}/v1/chain/get_info`,
      json: true,
    })
    if (this.onlyIrreversible) {
      return blockInfo.last_irreversible_block_num
    }
    return blockInfo.head_block_num
  }

  async getBlock(blockNumber: number): Promise<Block> {
    const rawBlock = await this.httpRequest("post", {
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

  flattenArray(arr: any[]): any[] {
    return arr.reduce((flat, toFlatten) =>
      flat.concat(Array.isArray(toFlatten) ? this.flattenArray(toFlatten) : toFlatten), [])
  }

  collectActionsFromBlock(rawBlock: any): Action[] {
    return this.flattenArray(rawBlock.transactions.map((transaction: any) => {
      if (!transaction.trx.transaction) {
        return [] // Deferred transaction, cannot decode
      }
      return transaction.trx.transaction.actions.map((action: any, actionIndex: number) => {
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
