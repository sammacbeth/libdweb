// @noflow

const { test } = browser.test
const { DNS } = browser

test("API", test => {
  test.equal(typeof DNS, "object", "DNS API available")
  test.equal(typeof DNS.lookup, "function", "dns.lookup is a function")
})
