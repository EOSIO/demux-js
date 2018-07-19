import { Action } from "../../../../index"

interface EosAuthorization {
  actor: string
  permission: string
}

interface EosPayload {
  account: string
  actionIndex: number
  authorization: EosAuthorization[]
  data: any
  name: string
  transactionId: string
}

export interface EosAction extends Action {
  payload: EosPayload
}
