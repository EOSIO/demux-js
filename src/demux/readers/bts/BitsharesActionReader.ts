import { AbstractActionReader } from "../AbstractActionReader"
import { BitsharesBlock } from "./BitsharesBlock"

import request from "request-promise-native"

/**
 * Reads from an Bitshares node to get blocks of actions.
 * It is important to note that virtual transactions will not be included,
 * as these not accessible in get_blocks API.
 */
export class BitsharesActionReader extends AbstractActionReader {
  protected bitsharesEndpoint: string
  protected requestId = 1;
  constructor(
    bitsharesEndpoint: string = "http://localhost:8888",
    public startAtBlock: number = 1,
    protected onlyIrreversible: boolean = false,
    protected maxHistoryLength: number = 600,
    protected requestInstance: any = request,
  ) {
    super(startAtBlock, onlyIrreversible, maxHistoryLength)
    // Remove trailing slashes
    this.bitsharesEndpoint = bitsharesEndpoint.replace(/\/+$/g, "")
  }

  /**
   * Returns a promise for the head block number.
   */
  public async getHeadBlockNumber(): Promise<number> {
    const globalProperties = await this.jsonRpcRequest("get_dynamic_global_properties", [])
    if (this.onlyIrreversible) {
      return globalProperties.last_irreversible_block_num
    }
    return globalProperties.head_block_number
  }

  /**
   * Returns a promise for a `BitsharesBlock`.
   */
  public async getBlock(blockNumber: number): Promise<BitsharesBlock> {
    const rawBlock = await this.jsonRpcRequest("get_block", [ blockNumber ])
    const block = new BitsharesBlock(blockNumber, rawBlock)
    return block
  }

  protected async jsonRpcRequest(method: string, params: any[]): Promise<any> {
    const requestParams = {
      url:  this.bitsharesEndpoint,
      json: {
        "jsonrpc": "2.0", 
        "id": this.requestId++, 
        "method": method, 
        "params": params 
      }
    }
    const response = await this.requestInstance.post(requestParams)
    return response.result
  }
}
