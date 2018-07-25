import { EosAction } from "./interfaces"
import { Block } from "../../../../index"

export class MongoBlock implements Block {
  public actions: EosAction[]
  public blockHash: string
  public blockNumber: number
  public previousBlockHash: string
  constructor(rawBlock: any, blockState: any) {
    this.actions = this.collectActionsFromBlock(rawBlock)
    this.blockNumber = rawBlock.transaction_header.ref_block_num
    this.blockHash = blockState.block_id
    this.previousBlockHash = blockState.block_header_state.header.previous
  }

  protected collectActionsFromBlock(rawBlock: any): EosAction[] {
    return rawBlock.actions.map((action: any, actionIndex: number) => {
      // Delete unneeded hex data if we have deserialized data
      if (action.data) {
        delete action.hex_data // eslint-disable-line
      }

      return {
        type: `${action.account}::${action.name}`,
        payload: {
          transactionId: rawBlock.trx_id,
          actionIndex,
          ...action,
        },
      }
    })
  }
}
