import { AbstractActionHandler } from '../AbstractActionHandler'
import { NotInitializedError } from '../errors'
import { Block, IndexState, NextBlock, VersionedAction } from '../interfaces'

export class TestActionHandler extends AbstractActionHandler {
  public isInitialized: boolean = false

  public state: any = {
    indexState: { blockNumber: 0, blockHash: '', isReplay: false, handlerVersionName: 'v1' },
  }

  private hashHistory: { [key: number]: string } = { 0: '' }

  get _handlerVersionName() { return this.handlerVersionName }

  // tslint:disable-next-line
  public async handleWithState(handle: (state: any) => void) {
    await handle(this.state)
  }

  public async rollbackTo(blockNumber: number) {
    this.setLastProcessedBlockNumber(blockNumber)
    this.setLastProcessedBlockHash(this.hashHistory[blockNumber])
    this.state.indexState = {
      ...this.state.indexState,
      blockNumber,
      blockHash: this.hashHistory[blockNumber],
    }
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
    context: any,
    isReplay: boolean,
  ): Promise<VersionedAction[]> {
    return this.applyUpdaters(state, block, context, isReplay)
  }

  public _runEffects(
    versionedActions: VersionedAction[],
    context: any,
    nextBlock: NextBlock,
  ) {
    this.runEffects(versionedActions, context, nextBlock)
  }

  protected async loadIndexState(): Promise<IndexState> {
    return this.state.indexState
  }

  public async handleBlock(
    nextBlock: NextBlock,
    isReplay: boolean,
  ): Promise<number | null> {
    const { blockNumber, blockHash } = nextBlock.block.blockInfo
    this.hashHistory[blockNumber] = blockHash
    return super.handleBlock(nextBlock, isReplay)
  }

  protected async updateIndexState(state: any, block: Block, isReplay: boolean, handlerVersionName: string) {
    const { blockNumber, blockHash } = block.blockInfo
    state.indexState = { blockNumber, blockHash, isReplay, handlerVersionName }
  }

  protected async setup(): Promise<void> {
    if (!this.isInitialized) {
      throw new NotInitializedError()
    }
  }
}
