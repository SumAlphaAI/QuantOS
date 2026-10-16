"""Run with python -m unittest discover -s tests -p test_event_bus_replay_handoff.py."""
import asyncio
import importlib.util
from pathlib import Path
import sys
import unittest

spec = importlib.util.spec_from_file_location("event_bus_under_test", Path(__file__).resolve().parents[1] / "agent/src/session/events.py")
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
EventBus, SSEEvent = module.EventBus, module.SSEEvent


class PublishAtUnlock:
    """Deterministically emulate publish in the registration/replay gap."""
    def __init__(self, bus):
        self.bus, self.original, self.injected = bus, bus._lock, False
    def __enter__(self):
        self.original.acquire()
        return self
    def __exit__(self, *args):
        self.original.release()
        if self.bus._subscribers.get("session") and not self.injected:
            self.injected = True
            self.bus.publish(SSEEvent(event_id="handoff", session_id="session"))


class ReplayHandoffTests(unittest.IsolatedAsyncioTestCase):
    async def check_handoff(self, last_event_id=None, replay_all=False):
        bus = EventBus()
        bus.publish(SSEEvent(event_id="old", session_id="session"))
        bus._lock = PublishAtUnlock(bus)
        stream = bus.subscribe("session", last_event_id, replay_all=replay_all)
        try:
            if replay_all and last_event_id is None:
                self.assertEqual((await anext(stream)).event_id, "old")
            self.assertEqual((await asyncio.wait_for(anext(stream), 1)).event_id, "handoff")
            bus.publish(SSEEvent(event_id="next", session_id="session"))
            self.assertEqual((await asyncio.wait_for(anext(stream), 1)).event_id, "next")
        finally:
            await stream.aclose()
        self.assertFalse(bus._subscribers["session"])

    async def test_reconnect_has_no_duplicate_at_handoff(self):
        await self.check_handoff(last_event_id="old")

    async def test_replay_all_has_no_duplicate_at_handoff(self):
        await self.check_handoff(replay_all=True)

    async def test_first_connect_without_replay_delivers_live_event_once(self):
        await self.check_handoff()

    def test_replay_cursor_semantics_unchanged(self):
        bus = EventBus()
        for name in ["one", "two", "three"]:
            bus.publish(SSEEvent(event_id=name, session_id="session"))
        ids = lambda **kw: [e.event_id for e in bus.replay("session", **kw)]
        self.assertEqual(ids(), [])
        self.assertEqual(ids(last_event_id="two"), ["three"])
        self.assertEqual(ids(last_event_id="missing"), [])
        self.assertEqual(ids(last_event_id="missing", replay_all=True), ["one", "two", "three"])
        self.assertEqual(bus.replay("other", replay_all=True), [])
