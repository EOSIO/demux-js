import { AbstractActionReader } from "../AbstractActionReader"
import { NodeosBlock } from "./NodeosBlock"

import request from "request-promise-native"

/**
 * Reads from an EOSIO nodeos node to get blocks of actions.
 * It is important to note that deferred transactions will not be included,
 * as these are currently not accessible without the use of plugins.
 */
export class NodeosActionReader extends AbstractActionReader {
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

  /**
   * Returns a promise for the head block number.
   */
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

  /**
   * Returns a promise for a `NodeosBlock`.
   */
  public async getBlock(blockNumber: number): Promise<NodeosBlock> {
    const rawBlock = await this.httpRequest("post", {
      url: `${this.nodeosEndpoint}/v1/chain/get_block`,
      json: { block_num_or_id: blockNumber },
    })
    const block = new NodeosBlock(rawBlock)
    return block
  }

  protected async httpRequest(method: string, requestParams: any): Promise<any> {
    if (method === "get") {
      return await this.requestInstance.get(requestParams)
    } else if (method === "post") {
      return await this.requestInstance.post(requestParams)
    }
  }
}
