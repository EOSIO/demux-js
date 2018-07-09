## `AbstractActionReader`

| Parameter          | Type      | Default |
|--------------------|-----------|---------|
| `startAtBlock`     | `number`  | 1       |
| `onlyIrreversible` | `boolean` | false   |
| `maxHistoryLength` | `number`  | 600     |

Abstract methods: `getHeadBlockNumber`, `getBlock`

Implement `getBlock` to retrieve a block at the block number given, returning a subclass of `AbstractBlock`. Implement `getHeadBlockNumber` to get the latest block from the blockchain.  


## `AbstractBlock`

| Parameter   | Type   |
|-------------|--------|
| `rawBlock`  | `any`  |

Abstract methods: `parseRawBlock`

Implement `parseRawBlock` to take raw block data from a given blockchain and return a normalized [Block](../interfaces.ts) object, to be used in an implementation of `AbstractActionReader`.
