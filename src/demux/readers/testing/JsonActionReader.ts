import { AbstractActionReader } from "../AbstractActionReader"
import request from "request-promise-native"
import { Block } from "../../../../index"

/**
 * Reads from an array of `Block` objects, useful for testing.
 */
export class JsonActionReader extends AbstractActionReader {
  constructor(
    protected blockchain: Block[],
    public startAtBlock: number = 1,
    protected onlyIrreversible: boolean = false,
    protected maxHistoryLength: number = 600,
    protected requestInstance: any = request,
  ) {
    super(startAtBlock, onlyIrreversible, maxHistoryLength)
  }

  public async getHeadBlockNumber(): Promise<number> {
    const block = this.blockchain.slice(-1)[0]
    if (this.blockchain.length !== block.blockNumber) {
      throw Error(`Block at position ${this.blockchain.length} indicates position ${block.blockNumber} incorrectly.`)
    }
    return block.blockNumber
  }

  public async getBlock(blockNumber: number): Promise<Block> {
    const block = this.blockchain[blockNumber - 1]
    if (!block) {
      throw Error(`Block at position ${blockNumber} does not exist.`)
    }
    if (block.blockNumber !== blockNumber) {
      throw Error(`Block at position ${blockNumber} indicates position ${block.blockNumber} incorrectly.`)
    }
    return block
  }
}
