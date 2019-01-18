import express from "express"
import * as http from "http"
import { AbstractActionHandler } from "./AbstractActionHandler"
import { AbstractActionReader } from "./AbstractActionReader"
import { BaseActionWatcher } from "./BaseActionWatcher"

export class ExpressActionWatcher extends BaseActionWatcher {
  public express = express()
  private server: http.Server | null = null
  constructor(
    protected actionReader: AbstractActionReader,
    protected actionHandler: AbstractActionHandler,
    protected pollInterval: number,
    protected port: number,
  ) {
    super(actionReader, actionHandler, pollInterval)

    this.express.get("/info", (_, res: express.Response) => {
      res.json(this.info)
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
      this.log.warn(`API server already listening on port ${this.port}.`)
      return false
    }
    this.server = await this.express.listen(this.port)
    this.log.info(`API server listening on port ${this.port}.`)
    return true
  }

  public async close(): Promise<boolean> {
    if (!this.server) {
      this.log.warn(`API server cannot close because it is not listening.`)
      return false
    }
    this.log.info(`API server closing down. (NOTE: This does not shut down Demux itself!)`)
    await this.server.close()
    this.server = null
    return true
  }
}
