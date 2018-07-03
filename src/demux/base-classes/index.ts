interface Block {
    actions: Action[]
    blockHash: string
    blockNumber: number
    previousBlockHash: string
}

interface BlockInfo {
    blockHash: string
    blockNumber: number
    previousBlockHash: string
}

interface Action {
    type: string
    payload: Payload
}

interface Payload {
    account: string
    actionIndex: number
    authorization: Authorization[]
    data: any
    name: string
    transactionId: string
}

interface Authorization {
    actor: string;
    permission: string;
}

interface Updater {
    actionType: string
    updater: Function
}

interface Effect {
    actionType: string
    effect: Function
}