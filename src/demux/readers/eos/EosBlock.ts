import AbstractBlock from "../AbstractBlock"

export default class EosBlock extends AbstractBlock {
  protected parseRawBlock(rawBlock: any): Block {
    return {
      actions: this.collectActionsFromBlock(rawBlock),
      blockNumber: rawBlock.block_num,
      blockHash: rawBlock.id,
      previousBlockHash: rawBlock.previous,
    }
  }

  public flattenArray(arr: any[]): any[] {
    return arr.reduce((flat, toFlatten) =>
      flat.concat(Array.isArray(toFlatten) ? this.flattenArray(toFlatten) : toFlatten), [])
  }

  protected collectActionsFromBlock(rawBlock: any): EosAction[] {
    return this.flattenArray(rawBlock.transactions.map((transaction: any) => {
      if (!transaction.trx.transaction) {
        return [] // Deferred transaction, cannot decode
      }
      return transaction.trx.transaction.actions.map((action: any, actionIndex: number) => {
        // Delete unneeded hex data if we have deserialized data
        if (action.data) {
          delete action.hex_data // eslint-disable-line
        }
        return {
          type: `${action.account}::${action.name}`,
          payload: {
            transactionId: transaction.trx.id,
            actionIndex,
            ...action,
          },
        }
      })
    }))
  }
}
