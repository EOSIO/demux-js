import { AbstractActionReader } from './AbstractActionReader'
import { Block, JsonActionReaderOptions } from './interfaces'
import { JsonBlockDoesNotExist, JsonBlockIndicatesWrongPosition } from './errors'

/**
 * Reads from an array of `Block` objects, useful for testing.
 */
export class JsonActionReader extends AbstractActionReader {
  public blockchain: Block[]
  constructor(options: JsonActionReaderOptions) {
    super(options)
    this.blockchain = options.blockchain
  }

  protected async setup(): Promise<void> { return }

  public async getHeadBlockNumber(): Promise<number> {
    const block = this.blockchain.slice(-1)[0]
    const { blockInfo: { blockNumber } } = block
    if (this.blockchain.length !== blockNumber) {
      throw new JsonBlockIndicatesWrongPosition(blockNumber, this.blockchain.length)
    }
    return blockNumber
  }

  public async getLastIrreversibleBlockNumber(): Promise<number> {
    return this.getHeadBlockNumber()
  }

  public async getBlock(blockNumber: number): Promise<Block> {
    const block = this.blockchain[blockNumber - 1]
    if (!block) {
      throw new JsonBlockDoesNotExist(blockNumber)
    }
    if (block.blockInfo.blockNumber !== blockNumber) {
      throw new JsonBlockIndicatesWrongPosition(blockNumber, this.blockchain.length)
    }
    return block
  }
}
