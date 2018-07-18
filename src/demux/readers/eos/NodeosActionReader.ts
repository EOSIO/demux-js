/**
 * Reads an EOSIO nodeos node to get actions.
 * It is important to note that deferred transactions will not be included, as these are not accessible without plugins.
 */

import AbstractActionReader from "../AbstractActionReader"
import NodeosBlock from "./NodeosBlock"

import request from "request-promise-native"

/**
 * Implementation of an ActionReader that polls a node using `get_block`.
 */
export default class NodeosActionReader extends AbstractActionReader {
  protected nodeosEndpoint: string
  constructor(
    nodeosEndpoint: string = "http://localhost:8888",
    public startAtBlock: number = 1,
    protected onlyIrreversible: boolean = false,
    protected maxHistoryLength: number = 600,
    protected requestInstance: any = request,
  ) {
    super(startAtBlock, onlyIrreversible, maxHistoryLength)
    // Remove trailing slashes
    this.nodeosEndpoint = nodeosEndpoint.replace(/\/+$/g, "")
  }

  public async getHeadBlockNumber(): Promise<number> {
    const blockInfo = await this.httpRequest("get", {
      url: `${this.nodeosEndpoint}/v1/chain/get_info`,
      json: true,
    })
    if (this.onlyIrreversible) {
      return blockInfo.last_irreversible_block_num
    }
    return blockInfo.head_block_num
  }

  public async getBlock(blockNumber: number): Promise<Block> {
    const rawBlock = await this.httpRequest("post", {
      url: `${this.nodeosEndpoint}/v1/chain/get_block`,
      json: { block_num_or_id: blockNumber },
    })
    return new NodeosBlock(rawBlock)
  }

  protected async httpRequest(method: string, requestParams: any): Promise<any> {
    if (method === "get") {
      return await this.requestInstance.get(requestParams)
    } else if (method === "post") {
      return await this.requestInstance.post(requestParams)
    }
  }
}
