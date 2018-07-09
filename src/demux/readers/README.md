## `AbstractActionReader`

| Parameter          | Type      | Default |
|--------------------|-----------|---------|
| `startAtBlock`     | `number`  | 1       |
| `onlyIrreversible` | `boolean` | false   |
| `maxHistoryLength` | `number`  | 600     |

Abstract methods: `getHeadBlockNumber`, `getBlock`

Implement `getBlock` to retrieve a block at the block number given, returning an implementation of the [`Block`](../interfaces.ts) interface. Implement `getHeadBlockNumber` to get the latest block from the blockchain.  
