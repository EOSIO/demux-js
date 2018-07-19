const {
  readers: { eos: { NodeosActionReader } },
  watchers: { BaseActionWatcher },
} = require("../../dist/")
const ObjectActionHandler = require("./ObjectActionHandler")
const updaters = require("./updaters")
const effects = require("./effects")


const actionHandler = new ObjectActionHandler(
  updaters,
  effects,
)

const actionReader = new NodeosActionReader(
  "http://mainnet.eoscalgary.io", // Thanks EOS Calgary!
  0, // Start at most recent blocks
)

const actionWatcher = new BaseActionWatcher(
  actionReader,
  actionHandler,
  500,
)

actionWatcher.watch()
