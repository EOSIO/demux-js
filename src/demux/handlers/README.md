## `AbstractActionHandler`

| Parameter  | Type        | 
|------------|-------------|
| `updaters` | `Updater[]` |
| `effects`  | `Effect[]`  |

Abstract methods: `handleWithState`, `rollbackTo`

Output from an Action Reader's `getBlock` is passed to `handleBlock` so that the Block's actions can be processed by the Action Handler. Implement `handleWithState` to pass a state object to be used from within the functions of `updaters` (reads + writes) and `effects` (read-only). Implement `rollbackTo` for when a rollback is required by `handleBlock`, so that the state can revert to the given block number.
