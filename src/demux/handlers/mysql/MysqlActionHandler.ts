import { AbstractActionHandler } from "../AbstractActionHandler"
import { Block, Effect, IndexState, Updater } from "../../../../index"

/**
 * Connects to a Mysql database using the NPM [mysql](https://github.com/mysqljs/mysql) package. This expects that
 * the database is already migrated, including an `_index_state` table. Refer to the tests for more information.
 */
export class MysqlActionHandler extends AbstractActionHandler {
  constructor(
    protected updaters: Updater[],
    protected effects: Effect[],
    protected mysqlInstance: any,
  ) {
    super(updaters, effects)
  }

  protected async handleWithState(handle: (state: any, context?: any) => void): Promise<void> {
    await handle(null, { conn: this.mysqlInstance });
  }

  protected async updateIndexState(_state: any, block: Block, isReplay: boolean) {
    this.mysqlInstance.query(`REPLACE INTO _index_state VALUES (0, ${block.blockNumber}, "${block.blockHash}", ${isReplay} )`);
  }

  protected async loadIndexState(): Promise<IndexState> {
    const rows = await this.mysqlInstance.query(`SELECT * FROM _index_state WHERE id=0`)
    if (rows.length == 0)
      return { blockNumber: 0, blockHash: "" }
    const blockNumber = rows[0].block_number;
    const blockHash = rows[0].block_hash;
    return { blockNumber, blockHash }
  }

  protected async rollbackTo(blockNumber: number) {
    throw Error(`Cannot roll back to ${blockNumber}; \`rollbackTo\` not implemented.`)
  }
}
