import { AbstractActionHandler } from '../AbstractActionHandler'
import { NotInitializedError } from '../errors'
import { IndexState, NextBlock, VersionedAction } from '../interfaces'

export class TestActionHandler extends AbstractActionHandler {
  public isInitialized: boolean = false

  private indexState: IndexState = {
    blockNumber: 0,
    blockHash: '',
    isReplay: false,
    handlerVersionName: 'v1',
    lastIrreversibleBlockNumber: 0
  }

  public state: any = { indexState: this.indexState }

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
    this.indexState.blockHash = hash
  }

  public setLastProcessedBlockNumber(num: number) {
    this.lastProcessedBlockNumber = num
    this.indexState.blockNumber = num
  }

  public async _applyUpdaters(
    state: any,
    nextBlock: NextBlock,
    context: any,
    isReplay: boolean,
  ): Promise<VersionedAction[]> {
    return this.applyUpdaters(state, nextBlock, context, isReplay)
  }

  public async _runEffects(
    versionedActions: VersionedAction[],
    context: any,
    nextBlock: NextBlock,
  ) {
    await this.runEffects(versionedActions, context, nextBlock)
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

  protected async updateIndexState(state: any, nextBlock: NextBlock, isReplay: boolean, handlerVersionName: string) {
    const { blockNumber, blockHash } = nextBlock.block.blockInfo
    state.indexState = { blockNumber, blockHash, isReplay, handlerVersionName }
  }

  protected async setup(): Promise<void> {
    if (!this.isInitialized) {
      throw new NotInitializedError()
    }
  }
}
