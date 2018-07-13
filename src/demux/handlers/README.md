## `AbstractActionHandler`

| Parameter  | Type        | Signature | Description |
|------------|-------------|-----------|-------------|
| `updaters` | `Updater[]` | `[{ 
  actionType: "contract:actionName",
  updater: ({ state, payload, blockInfo, context }) => {} }]` | Array of objects, each object must contain an `actionType` and `updater`. |

| `effects`  | `Effect[]`  | `[{
  actionType: "contract:actionName",
  updater: ({ effect, payload, blockInfo, context }) => {} }]` | Array of objects, each object must contain an `actionType` and `effect`. |

Abstract methods: `handleWithState`, `rollbackTo`

Output from an Action Reader's `getBlock` is passed to `handleBlock` so that the Block's actions can be processed by the Action Handler. Implement `handleWithState` to pass a state object to be used from within the functions of `updaters` (reads + writes) and `effects` (read-only). Implement `rollbackTo` for when a rollback is required by `handleBlock`, so that the state can revert to the given block number.
