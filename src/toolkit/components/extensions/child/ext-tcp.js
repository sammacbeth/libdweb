const { ExtensionError } = ExtensionUtils

global.TCPSocket = class extends ExtensionAPI /*::<Host>*/ {
  getAPI(context) {
    class TCPClient {
      /*::
      opened:Promise<void>
      closed:Promise<void>
      */
      constructor({ host, port, ssl, readyState }) {
        this.host = host
        this.port = port
        this.ssl = ssl
        this.readyState = readyState
        // this.opened = new Promise((resolve) => {
        //   if (this.readyState === "open") {
        //     resolve();
        //   } else {
        //     this._onOpened = resolve;
        //   }
        // });
        // this.closed = new Promise((resolve) => {
        //   this._onClosed = resolve;
        // });
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

    class TCPServer {
      /*::
      connections:AsyncIterator<ClientSocket>
      */
      constructor({ localPort, id }) {
        this.id = id
        this.localPort = localPort
      }
      close() {
        this.server.close()
      }
      // get closed() {
      //   return this.server.closed
      // }
      // get localPort() {
      //   return this.server.localPort
      // }
    }
    const createTCPServer = server => {
      const tcpServer = Cu.waiveXrays(Reflect.construct(TCPServer, [server]))
      // Reflect.defineProperty(tcpServer, 'localPort', {
      //   value() {
      //     return server.localPort
      //   }
      // })
      Reflect.defineProperty(tcpServer, "closed", {
        get() {
          return Promise.reject()
        }
      })
      return tcpServer
    }

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
          new Promise(async (resolve, reject) => {
            try {
              console.log("xxx", Object.keys(context))
              const parentServer = await context.childManager.callParentAsyncFunction(
                "TCPSocket.connect",
                [options]
              )
              // console.log('xxx', parentServer);
              resolve(new TCPClient(parentServer))
            } catch (e) {
              reject(new ExtensionError(e))
            }
          })
      }
    }
  }
}
