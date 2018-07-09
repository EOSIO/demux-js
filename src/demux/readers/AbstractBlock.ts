export default abstract class AbstractBlock implements Block {
  public actions: Action[]
  public blockHash: string
  public blockNumber: number
  public previousBlockHash: string

  constructor(rawBlock: any) {
    const block = this.parseRawBlock(rawBlock)
    this.actions = block.actions
    this.blockHash = block.blockHash
    this.blockNumber = block.blockNumber
    this.previousBlockHash = block.previousBlockHash
  }

  /**
   * Implement to take raw block data from a given blockchain and return a normalized Block object
   * @param rawBlock
   * @returns {Block}
   */
  protected abstract parseRawBlock(rawBlock: any): Block
}
