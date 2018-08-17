const { watchers } = require("demux-js")
const { NodeosActionReader } = require("demux-eos") // eslint-disable-line
const ObjectActionHandler = require("./ObjectActionHandler")
const updaters = require("./updaters")
const effects = require("./effects")

const { BaseActionWatcher } = watchers

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
