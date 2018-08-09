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

export async function waitForMysql(_container: Container, _dbPass: String) {
  await wait(20000);
}

export function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function startMysqlContainer(
  docker: any,
  imageName: string,
  containerName: string,
  _dbName: string,
  _dbUser: string,
  dbPass: string,
) {
  const container = await docker.createContainer({
    Image: imageName,
    name: containerName,
    Tty: false,
    PortBindings: { "3306/tcp": [{ HostPort: "3306" }] },
    Env: [
      `MYSQL_ROOT_PASSWORD=${dbPass}`,
    ],
  })
  await container.start()
  await waitForMysql(container, dbPass)
}

export async function removeMysqlContainer(docker: any, containerName: string) {
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
