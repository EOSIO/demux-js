## `BaseActionWatcher`

| Parameter       | Type                    |
|-----------------|-------------------------|
| `actionReader`  | `AbstractActionReader`  |
| `actionHandler` | `AbstractActionHandler` |
| `pollInterval`  | `number`                |

After instantiating an Action Reader and Action Handler, instantiate this class with them along with a poll interval. Calling `watch()` will then initiate a polling cycle that utilizes the Reader to send action information to the Handler.

This class is ready to use, no methods require implementing.
