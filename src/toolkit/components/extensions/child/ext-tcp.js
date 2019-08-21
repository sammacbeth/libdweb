const { ExtensionError } = ExtensionUtils

const exportClass = /*::<b, a:Class<b>>*/ (
  scope /*:Object*/,
  constructor /*:a*/
) /*:a*/ => {
  const clone = Cu.exportFunction(constructor, scope)
  const unwrapped = Cu.waiveXrays(clone)
  const prototype = Cu.waiveXrays(Cu.createObjectIn(scope))

  const source = constructor.prototype
  for (const key of Reflect.ownKeys(constructor.prototype)) {
    if (key !== "constructor") {
      const descriptor = Reflect.getOwnPropertyDescriptor(source, key)
      Reflect.defineProperty(
        prototype,
        key,
        Cu.waiveXrays(
          Cu.cloneInto(descriptor, scope, {
            cloneFunctions: true
          })
        )
      )
    }
  }

  Reflect.defineProperty(unwrapped, "prototype", {
    value: prototype
  })
  Reflect.defineProperty(prototype, "constructor", {
    value: unwrapped
  })

  return clone
}

const exportInstance = /*::<a:Object, b:a>*/ (
  scope,
  constructor /*:Class<b>*/,
  properties /*::?:a*/
) /*:b*/ => {
  const instance /*:any*/ = properties
    ? Cu.cloneInto(properties, scope)
    : Cu.cloneInto({}, scope)
  Reflect.setPrototypeOf(
    Cu.waiveXrays(instance),
    Cu.waiveXrays(constructor).prototype
  )
  return instance
}

global.TCPSocket = class extends ExtensionAPI /*::<Host>*/ {
  getAPI(context) {
    const connections = new Map()
    const connectionInternal = new Map()

    const derefSocket = client => {
      return connections.get(client.__id)
    }

    const TCPClient = exportClass(
      context.cloneScope,
      class TCPClient {
        /*::
        opened:Promise<void>
        closed:Promise<void>
        */
        constructor() {
          throw TypeError("Illegal constructor")
        }
        get host() {
          return derefSocket(this).host
        }
        get port() {
          return derefSocket(this).port
        }
        get ssl() {
          return derefSocket(this).ssl
        }
        get readyState() {
          return derefSocket(this).readyState
        }
        get bufferedAmount() {
          return derefSocket(this).bufferedAmount
        }
        get opened() {
          return derefSocket(this).opened
        }
        get closed() {
          return derefSocket(this).closed
        }
        write(buffer, byteOffset, byteLength) {
          return new context.cloneScope.Promise(async (resolve, reject) => {
            try {
              const result = await context.childManager.callParentAsyncFunction(
                "TCPSocket.write",
                [this.__id, buffer, byteOffset, byteLength]
              )
              resolve()
            } catch (e) {
              reject(e.toString())
            }
          })
        }
        read() {
          return new context.cloneScope.Promise(async (resolve, reject) => {
            const internal = connectionInternal.get(this.__id)
            if (internal.buffer.length > 0) {
              resolve(internal.buffer.shift())
            } else {
              internal.ondata = () => {
                resolve(internal.buffer.shift())
              }
            }
          })
        }
        suspend() {
          derefSocket(this).suspend()
        }
        resume() {
          derefSocket(this).resume()
        }
        close() {
          derefSocket(this).close()
          return voidPromise
        }
        closeImmediately() {
          derefSocket(this).closeImmediately()
          return voidPromise
        }
        upgradeToSecure() {
          return derefSocket(this).upgradeToSecure()
        }
      }
    )

    const pollEvents = async () => {
      const events = await context.childManager.callParentAsyncFunction(
        "TCPSocket.pollEventQueue",
        []
      )
      console.log("xxx events", events)
      events.forEach(event => {
        const type = event[0]
        const socket = Object.assign(connections.get(event[1].id), event[1])
        const internal = connectionInternal.get(event[1].id)
        connections.set(socket.id, socket)
        switch (type) {
          case "open":
            internal.onOpened()
            break
          case "close":
            internal.onClosed()
            break
          case "data":
            internal.buffer.push(event[2])
            if (internal.ondata) {
              internal.ondata()
              internal.ondata = null
            }
            break
        }
      })
      pollEvents()
    }
    pollEvents()

    return {
      TCPSocket: {
        listen: options =>
          new Promise(async (resolve, reject) => {
            try {
              const parentServer = await context.childManager.callParentAsyncFunction(
                "TCPSocket.listen",
                [options]
              )
              // const server = exportInstance(context.cloneScope, TCPServer)
              // console.log(server);
              resolve(createTCPServer(parentServer))
            } catch (e) {
              reject(new ExtensionError(e.toString()))
            }
          }),
        connect: options =>
          new context.cloneScope.Promise(async (resolve, reject) => {
            try {
              const socket = await context.childManager.callParentAsyncFunction(
                "TCPSocket.connect",
                [options]
              )
              console.log("xxx", socket)
              const internals = {
                buffer: []
              }
              socket.opened = new context.cloneScope.Promise(resolve => {
                internals.onOpened = resolve
              })
              socket.closed = new context.cloneScope.Promise(resolve => {
                internals.onClosed = resolve
              })
              connections.set(socket.id, socket)
              connectionInternal.set(socket.id, internals)

              const client = exportInstance(context.cloneScope, TCPClient)
              client.__id = socket.id

              resolve(client)
            } catch (e) {
              reject(new ExtensionError(e))
            }
          })
      }
    }
  }
}
