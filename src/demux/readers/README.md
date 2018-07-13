## `AbstractActionReader`

| Parameter          | Type      | Default | Description |
|--------------------|-----------|---------|-------------|
| `startAtBlock`     | `number`  | 1       | The block number the reader will start at. If you want to start at the current block you can enter `0`. To start 300 blocks before the current block enter `-299` |
| `onlyIrreversible` | `boolean` | false   | If true, `getHeadBlockNumber` will only return the `last_irreversible_block_num` |
| `maxHistoryLength` | `number`  | 600     | The amount of recent blocks to store in history  |


Abstract methods: `getHeadBlockNumber`, `getBlock`

Implement `getBlock` to retrieve a block at the block number given, returning an implementation of the [`Block`](../interfaces.ts) interface. Implement `getHeadBlockNumber` to get the latest block from the blockchain.  
