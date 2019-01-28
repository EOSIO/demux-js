import { AbstractActionReader } from '../AbstractActionReader'
import { NotInitializedError } from '../errors'
import { Block } from '../interfaces'

export class TestActionReader extends AbstractActionReader {
  public isInitialized: boolean = false

  public blockchain: Block[] = []
  // tslint:disable-next-line:variable-name
  public _testLastIrreversible: number = 0

  public get _blockHistory() {
    return this.blockHistory
  }

  public get _lastIrreversibleBlockNumber() {
    return this.lastIrreversibleBlockNumber
  }

  public async getHeadBlockNumber(): Promise<number> {
    return this.blockchain[this.blockchain.length - 1].blockInfo.blockNumber
  }

  public async getLastIrreversibleBlockNumber(): Promise<number> {
    if (this._testLastIrreversible) {
      return this._testLastIrreversible
    }
    return this.getHeadBlockNumber()
  }

  public async getBlock(blockNumber: number): Promise<Block> {
    return this.blockchain[blockNumber - 1]
  }

  protected async setup(): Promise<void> {
    if (!this.isInitialized) {
      throw new NotInitializedError()
    }
  }
}
