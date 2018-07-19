import AbstractActionHandler from "./AbstractActionHandler"
import MassiveActionHandler from "./postgres/MassiveActionHandler"

module.exports = {
  AbstractActionHandler,
  postgres: {
    MassiveActionHandler,
  },
}
