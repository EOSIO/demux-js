import { AbstractActionHandler } from "../AbstractActionHandler"
import { Block, IndexState } from "../interfaces"

export class TestActionHandler extends AbstractActionHandler {
  public state: any = {
    indexState: { blockNumber: 0, blockHash: "" },
  }

  // tslint:disable-next-line
  public async handleWithState(handle: (state: any) => void) {
    await handle(this.state)
  }

  public async rollbackTo(blockNumber: number) {
    this.setLastProcessedBlockNumber(blockNumber)
    this.setLastProcessedBlockHash("")
  }

  public setLastProcessedBlockHash(hash: string) {
    this.lastProcessedBlockHash = hash
  }

  public setLastProcessedBlockNumber(num: number) {
    this.lastProcessedBlockNumber = num
  }

  public async _runUpdaters(state: any, block: Block, context: any) {
    await this.runUpdaters(state, block, context)
  }

  public _runEffects(state: any, block: Block, context: any) {
    this.runEffects(state, block, context)
  }

  protected async loadIndexState(): Promise<IndexState> {
    return this.state.indexState
  }

  protected async updateIndexState(state: any, block: Block) {
    const { blockNumber, blockHash } = block.blockInfo
    state.indexState = { blockNumber, blockHash }
  }
}
