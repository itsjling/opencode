import { describe, expect, test } from "bun:test"
import path from "path"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { Session } from "../../src/session"
import { Log } from "../../src/util/log"

const projectRoot = path.join(__dirname, "../..")
Log.init({ print: false })

describe("session.pin", () => {
  test("should pin a session via PATCH endpoint", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const app = Server.App()
        const session = await Session.create({})

        const response = await app.request(`/session/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: true }),
        })

        expect(response.status).toBe(200)
        const updated = (await response.json()) as Session.Info
        expect(updated.time?.pinned).toBeGreaterThan(0)

        await Session.remove(session.id)
      },
    })
  })

  test("should unpin a session via PATCH endpoint", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const app = Server.App()
        const session = await Session.create({})

        await Session.update(session.id, (draft) => {
          draft.time.pinned = Date.now()
        })

        const response = await app.request(`/session/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: false }),
        })

        expect(response.status).toBe(200)
        const updated = (await response.json()) as Session.Info
        expect(updated.time?.pinned).toBeUndefined()

        await Session.remove(session.id)
      },
    })
  })

  test("should sort pinned sessions first in list", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const app = Server.App()

        const unpinned = await Session.create({})
        await new Promise((resolve) => setTimeout(resolve, 10))

        const pinned = await Session.create({})
        await Session.update(pinned.id, (draft) => {
          draft.time.pinned = Date.now()
        })

        const response = await app.request("/session")
        expect(response.status).toBe(200)

        const body = (await response.json()) as Session.Info[]
        const ids = body.map((s) => s.id)

        const pinnedIndex = ids.indexOf(pinned.id)
        const unpinnedIndex = ids.indexOf(unpinned.id)

        expect(pinnedIndex).toBeLessThan(unpinnedIndex)

        await Session.remove(unpinned.id)
        await Session.remove(pinned.id)
      },
    })
  })

  test("should sort pinned sessions by pin time (newer first)", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const app = Server.App()

        const olderPinned = await Session.create({})
        await Session.update(olderPinned.id, (draft) => {
          draft.time.pinned = Date.now() - 1000
        })
        await new Promise((resolve) => setTimeout(resolve, 10))

        const newerPinned = await Session.create({})
        await Session.update(newerPinned.id, (draft) => {
          draft.time.pinned = Date.now()
        })

        const response = await app.request("/session")
        expect(response.status).toBe(200)

        const body = (await response.json()) as Session.Info[]
        const ids = body.map((s) => s.id)

        const newerIndex = ids.indexOf(newerPinned.id)
        const olderIndex = ids.indexOf(olderPinned.id)

        expect(newerIndex).toBeLessThan(olderIndex)

        await Session.remove(olderPinned.id)
        await Session.remove(newerPinned.id)
      },
    })
  })

  test("should sort unpinned sessions by updated time when no pins exist", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const app = Server.App()

        const older = await Session.create({})
        await new Promise((resolve) => setTimeout(resolve, 50))

        const newer = await Session.create({})
        await new Promise((resolve) => setTimeout(resolve, 50))

        await Session.touch(newer.id)

        const response = await app.request("/session")
        expect(response.status).toBe(200)

        const body = (await response.json()) as Session.Info[]
        const ids = body.map((s) => s.id)

        const newerIndex = ids.indexOf(newer.id)
        const olderIndex = ids.indexOf(older.id)

        expect(newerIndex).toBeLessThan(olderIndex)

        await Session.remove(older.id)
        await Session.remove(newer.id)
      },
    })
  })

  test("should include pinned field in session schema", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})

        expect(session.time.pinned).toBeUndefined()

        const now = Date.now()
        await Session.update(session.id, (draft) => {
          draft.time.pinned = now
        })

        const retrieved = await Session.get(session.id)
        expect(retrieved.time?.pinned).toBe(now)

        await Session.remove(session.id)
      },
    })
  })
})
