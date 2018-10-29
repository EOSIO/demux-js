import { AbstractActionHandler } from "../AbstractActionHandler"
import { Action, Block, IndexState } from "../interfaces"

export class TestActionHandler extends AbstractActionHandler {
  public state: any = {
    indexState: { blockNumber: 0, blockHash: "", isReplay: false, handlerVersion: "v1" },
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

  public async _applyUpdaters(state: any, block: Block, context: any): Promise<Array<[Action, string]>> {
    return this.applyUpdaters(state, block, context)
  }

  public _runEffects(
    versionedActions: Array<[Action, string]>,
    block: Block,
    context: any,
  ) {
    this.runEffects(versionedActions, block, context)
  }

  protected async loadIndexState(): Promise<IndexState> {
    return this.state.indexState
  }

  protected async updateIndexState(state: any, block: Block) {
    const { blockNumber, blockHash } = block.blockInfo
    state.indexState = { blockNumber, blockHash }
  }

  protected async loadHandlerVersionState(): Promise<string> {
    return this.state.indexState.handlerVersion
  }

  protected async updateHandlerVersionState(handlerVersionName: string) {
    this.state.indexState.handlerVersion = handlerVersionName
  }
}
