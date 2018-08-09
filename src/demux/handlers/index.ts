import { AbstractActionHandler } from "./AbstractActionHandler"
import { postgres } from "./postgres"
import { mysql } from "./mysql"

export const handlers = {
  AbstractActionHandler,
  postgres,
  mysql
}
