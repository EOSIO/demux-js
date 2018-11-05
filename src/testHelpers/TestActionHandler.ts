import { AbstractActionHandler } from "../AbstractActionHandler"
import { Action, Block, IndexState } from "../interfaces"

export class TestActionHandler extends AbstractActionHandler {
  public state: any = {
    indexState: { blockNumber: 0, blockHash: "", isReplay: false, handlerVersionName: "v1" },
  }

  get _handlerVersionName() { return this.handlerVersionName }

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

  public async _applyUpdaters(
    state: any,
    block: Block,
    isReplay: boolean,
    context: any,
  ): Promise<Array<[Action, string]>> {
    return this.applyUpdaters(state, block, isReplay, context)
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

  protected async updateIndexState(state: any, block: Block, isReplay: boolean, handlerVersionName: string) {
    const { blockNumber, blockHash } = block.blockInfo
    state.indexState = { blockNumber, blockHash, isReplay, handlerVersionName }
  }
}
