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
        write(buffer, byteOffset, byteLength) {
          const socket = derefSocket(this)
          if (socket.send(buffer, byteOffset, byteLength)) {
            return voidPromise
          } else {
            return new context.cloneScope.Promise((resolve, reject) => {
              socket.ondrain = () => resolve()
              socket.onerror = ({ name, message }) =>
                reject(new IOError(`${name}: ${message}`))
            })
          }
        }
        read() {
          return context.wrapPromise(
            new Promise((resolve, reject) => {
              derefSocket(this).ondata = event => resolve(event.data)
            })
          )
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
              const parentServer = await context.childManager.callParentAsyncFunction(
                "TCPSocket.connect",
                [options]
              )
              console.log("xxx", parentServer)
              connections.set(parentServer.id, parentServer)

              const client = exportInstance(context.cloneScope, TCPClient)
              client.__id = parentServer.id

              resolve(client)
            } catch (e) {
              reject(new ExtensionError(e))
            }
          })
      }
    }
  }
}
