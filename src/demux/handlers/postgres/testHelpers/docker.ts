import { Container } from "dockerode"
import { Stream } from "stream"

export function promisifyStream(stream: Stream): Promise<string> {
  const data: Buffer[] = []
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => data.push(chunk))
    stream.on("end", () => {
      const toReturn = Buffer.concat(data).toString()
      resolve(toReturn)
    })
    stream.on("error", () => reject())
  })
}

export async function pullImage(docker: any, imageName: string) {
  const stream = await docker.pull(imageName)
  await promisifyStream(stream)
}

export async function waitForPostgres(container: Container) {
  let connectionTries = 0
  while (connectionTries < 40) {
    const exec = await container.exec({
      Cmd: ["pg_isready"],
      AttachStdin: true,
      AttachStdout: true,
    })
    const { output } = await exec.start({ hijack: true, stdin: true })
    const data = await promisifyStream(output)
    const status = data.split(" - ")[1].trim()
    if (status === "accepting connections") {
      await wait(1000)
      break
    }
    connectionTries += 1
    await wait(500)
  }
  if (connectionTries === 30) {
    throw Error("Too many tries to connect to database")
  }
}

export function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function startPostgresContainer(
  docker: any,
  imageName: string,
  containerName: string,
  dbName: string,
  dbUser: string,
  dbPass: string,
) {
  const container = await docker.createContainer({
    Image: imageName,
    name: containerName,
    Tty: false,
    PortBindings: { "5432/tcp": [{ HostPort: "5432" }] },
    Env: [
      `POSTGRES_DB=${dbName}`,
      `POSTGRES_USER=${dbUser}`,
      `POSTGRES_PASSWORD=${dbPass}`,
    ],
  })
  await container.start()
  await waitForPostgres(container)
}

export async function removePostgresContainer(docker: any, containerName: string) {
  const containers = await docker.listContainers({ all: true })
  for (const containerInfo of containers) {
    if (containerInfo.Names[0] === `/${containerName}`) {
      const container = docker.getContainer(containerInfo.Id)
      if (containerInfo.State !== "exited") {
        await container.stop()
      }
      await container.remove()
    }
  }
}
