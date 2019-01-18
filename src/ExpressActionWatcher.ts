import { BaseActionWatcher } from "./BaseActionWatcher"
import express from "express"
import { AbstractActionReader } from "./AbstractActionReader"
import { AbstractActionHandler } from "./AbstractActionHandler"
import * as http from "http"

export class ExpressActionWatcher extends BaseActionWatcher {
  public express = express()
  public server: http.Server | null = null
  constructor(
    actionReader: AbstractActionReader,
    actionHandler: AbstractActionHandler,
    pollInterval: number,
    private port: number,
  ) {
    super(actionReader, actionHandler, pollInterval)

    this.express.get("/status", (_, res: express.Response) => {
      res.json(this.status)
    })

    this.express.post("/start", (_, res: express.Response) => {
      res.json({ success: this.start() })
    })

    this.express.post("/pause", (_, res: express.Response) => {
      res.json({ success: this.pause() })
    })
  }

  public async listen(): Promise<boolean> {
    if (this.server) {
      this.log.warn(`Demux already listening on port ${this.port}.`)
      return false
    }
    this.server = await this.express.listen(this.port)
    this.log.info(`Demux listening on port ${this.port}.`)
    return true
  }

  public async close(): Promise<boolean> {
    if (!this.server) {
      this.log.warn(`Demux server cannot close because it is not listening.`)
      return false
    }
    await this.server.close()
    this.server = null
    return true
  }
}
