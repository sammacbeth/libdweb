this.DNS = class extends ExtensionAPI {
  getAPI() {
    const dnsService = Components.classes[
      "@mozilla.org/network/dns-service;1"
    ].createInstance(Components.interfaces.nsIDNSService)

    return {
      DNS: {
        resolve(hostname, family = 6, all = false) {
          return new Promise((resolve, reject) => {
            let flags = 0
            if (family === 4) {
              flags &= dnsService.RESOLVE_DISABLE_IPV6
            }
            dnsService.asyncResolve(
              hostname,
              flags,
              {
                onLookupComplete(request, record, status) {
                  if (!Components.isSuccessCode(status)) {
                    return reject()
                  }
                  if (!record) {
                    return reject()
                  }

                  if (all) {
                    const addresses = []
                    while (record.hasMore()) {
                      addresses.push(record.getNextAddrAsString())
                    }
                    resolve(addresses)
                  } else {
                    const address = record.getNextAddrAsString()
                    resolve(address)
                  }
                }
              },
              null
            )
          })
        }
      }
    }
  }
}
