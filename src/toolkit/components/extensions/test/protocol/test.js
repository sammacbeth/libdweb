// @noflow

const { test } = browser.test

test("protocol", async test => {
  const { protocol } = browser
  test.equal(typeof protocol, "object", "protocol API available")
  test.equal(
    typeof protocol.registerProtocol,
    "function",
    "has protocol.registerProtocol"
  )

  protocol.registerProtocol("test", req => {
    return new Response("hello world")
  })

  await new Promise(resolve => setTimeout(resolve, 500))
  const req = await fetch("test://something")
  const resp = await req
  test.ok(resp.ok, "Can fetch protocol URL")
  const text = await resp.text()
  test.equal(text, "hello world", "Content matches")
})
