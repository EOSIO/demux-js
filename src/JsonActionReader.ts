import { AbstractActionReader } from './AbstractActionReader'
import { Block, JsonActionReaderOptions } from './interfaces'
import { JsonBlockIndicatesWrongPosition } from './errors'

/**
 * Reads from an array of `Block` objects, useful for testing.
 */
export class JsonActionReader extends AbstractActionReader {
  public blockchain: Block[]
  constructor(options: JsonActionReaderOptions) {
    super(options)
    this.blockchain = options.blockchain
  }

  public async getHeadBlockNumber(): Promise<number> {
    const block = this.blockchain.slice(-1)[0]
    const { blockInfo: { blockNumber } } = block
    if (this.blockchain.length !== blockNumber) {
      throw JsonBlockIndicatesWrongPosition
    }
    return blockNumber
  }

  public async getBlock(blockNumber: number): Promise<Block> {
    const block = this.blockchain[blockNumber - 1]
    if (!block) {
      throw Error(`Block at position ${blockNumber} does not exist.`)
    }
    if (block.blockInfo.blockNumber !== blockNumber) {
      throw JsonBlockIndicatesWrongPosition
    }
    return block
  }

  public async getLastIrreversibleBlockNumber(): Promise<number> {
    return this.lastIrreversibleBlockNumber
  }

  protected setup(): Promise<void> {
    return new Promise<void>((resolve) => resolve())
  }
}
