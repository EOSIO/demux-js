import { AbstractActionReader } from "../AbstractActionReader"
import { Block } from "../interfaces"

export class TestActionReader extends AbstractActionReader {
  public blockchain: Block[] = []

  public async getHeadBlockNumber(): Promise<number> {
    return this.blockchain[this.blockchain.length - 1].blockInfo.blockNumber
  }

  public async getBlock(blockNumber: number): Promise<Block> {
    return this.blockchain[blockNumber - 1]
  }
}
