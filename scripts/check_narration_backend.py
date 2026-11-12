"""Check narration API business logic without SQL Server or HTTP services."""
import asyncio
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from services.common.schemas import Place
from services.narration_service.application import NarrationReader, SPEECH_LOCALES, bundled_scripts


class MemoryPlaces:
    def __init__(self, places):
        self.places = {place.id: place for place in places}

    async def get_place(self, place_id):
        return self.places.get(place_id)


class NarrationTests(unittest.TestCase):
    def setUp(self):
        seed = json.loads((ROOT / "server/services/poi_service/data/places.json").read_text(encoding="utf-8"))
        self.places = [Place.model_validate(item) for item in seed]
        self.reader = NarrationReader(MemoryPlaces(self.places))

    def test_all_98_locales_use_full_script(self):
        async def check():
            count = 0
            for place in self.places:
                for locale in SPEECH_LOCALES:
                    narration = await self.reader.get_narration(place.id, locale)
                    self.assertEqual(narration.text, bundled_scripts()[place.id][locale]["text"])
                    self.assertEqual(narration.speech_locale, SPEECH_LOCALES[locale])
                    self.assertGreater(len(narration.text), len(place.localized_copy[locale].narration))
                    count += 1
            self.assertEqual(count, 98)
        asyncio.run(check())

    def test_admin_narration_is_preserved(self):
        place = self.places[0]
        place.localized_copy["en"].narration = "Administrator's replacement narration."
        result = asyncio.run(self.reader.get_narration(place.id, "en"))
        self.assertEqual(result.text, place.localized_copy["en"].narration)

    def test_unknown_place_still_raises(self):
        with self.assertRaises(KeyError):
            asyncio.run(self.reader.get_narration("unknown-place", "vi"))

    def test_unavailable_locale_still_raises(self):
        place = self.places[0]
        del place.localized_copy["en"]
        with self.assertRaises(KeyError):
            asyncio.run(self.reader.get_narration(place.id, "en"))


if __name__ == "__main__":
    unittest.main()
