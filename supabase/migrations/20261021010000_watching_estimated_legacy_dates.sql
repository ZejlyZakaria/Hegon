-- Owner-approved synthetic estimates, NOT recovered personal history.
-- Four review cases and all other media remain untouched. No canonical history is created.
-- Local full backup: scripts/.shots/estimated-dates-before.json (intentionally untracked).
BEGIN;
DO $repair$
DECLARE
 approved jsonb := $approved_dates$[
  {
    "id": "54ccdc0b-1fc9-466d-81fa-2ca15f7c254e",
    "type": "film",
    "old_date": "2014-12-31T12:00:00",
    "new_date": "2014-04-01",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "73386be2-66c7-4a6f-aae7-0c0607d6de82",
    "type": "film",
    "old_date": "2014-12-31T12:00:00",
    "new_date": "2014-03-31",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "7ece3b04-08f9-4a89-a658-5a97c40b25ce",
    "type": "film",
    "old_date": "2014-12-31T12:00:00",
    "new_date": "2014-11-04",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "8b39c977-3cd7-4a59-95e6-97a84ccd31c6",
    "type": "film",
    "old_date": "2014-12-31T12:00:00",
    "new_date": "2014-04-29",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "8e5ac35d-9853-4112-9a78-b02227204194",
    "type": "film",
    "old_date": "2014-12-31T12:00:00",
    "new_date": "2014-03-30",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "f92b6e4f-fc72-4112-9426-69416f9ca7b0",
    "type": "anime",
    "old_date": "2014-12-31T12:00:00",
    "new_date": "2014-12-01",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "01d9ec24-0889-4dc2-8399-f0f4f55e2274",
    "type": "film",
    "old_date": "2015-12-31T12:00:00",
    "new_date": "2015-03-29",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "75ecb650-7990-4c71-9e16-87eff0b6cbee",
    "type": "anime",
    "old_date": "2015-12-31T12:00:00",
    "new_date": "2015-04-19",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "f685e11d-4c66-439f-9cda-2b11664ae8c8",
    "type": "film",
    "old_date": "2015-12-31T12:00:00",
    "new_date": "2015-09-21",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "4ffa8e4a-33c6-4002-8f13-7ac8c24484ea",
    "type": "anime",
    "old_date": "2016-12-31T12:00:00",
    "new_date": "2016-07-15",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "785a14f7-7097-47f4-9f8e-452f93a2cb7e",
    "type": "film",
    "old_date": "2016-12-31T12:00:00",
    "new_date": "2016-01-03",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "b54e3838-ea0b-4c99-8559-38b12141692c",
    "type": "anime",
    "old_date": "2016-12-31T12:00:00",
    "new_date": "2016-06-03",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "2350a1c0-b676-464a-ba24-544dce95c5ad",
    "type": "film",
    "old_date": "2017-12-31T12:00:00",
    "new_date": "2017-06-25",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "60f505d5-120c-42ca-acf3-41714f9a730d",
    "type": "film",
    "old_date": "2017-12-31T12:00:00",
    "new_date": "2017-01-08",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "75802d7e-fa47-49e9-86f5-e3f0e905d6d2",
    "type": "film",
    "old_date": "2017-12-31T12:00:00",
    "new_date": "2017-12-09",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "a6003e58-caac-46ba-87d7-752fe1f24374",
    "type": "anime",
    "old_date": "2017-12-31T12:00:00",
    "new_date": "2017-02-26",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "d3f65182-8398-4b33-860e-065a9f4dc38f",
    "type": "anime",
    "old_date": "2017-12-31T12:00:00",
    "new_date": "2017-02-11",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "eb23174f-c9fe-4f46-8024-e81ffcd2c8de",
    "type": "film",
    "old_date": "2017-12-31T12:00:00",
    "new_date": "2017-02-23",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "f9399c76-c95b-4e44-b8dc-119bc7c55f47",
    "type": "anime",
    "old_date": "2017-12-31T12:00:00",
    "new_date": "2017-10-28",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "33156919-a450-4e0d-ab05-697612705f82",
    "type": "film",
    "old_date": "2018-12-31T12:00:00",
    "new_date": "2018-04-15",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "5f39669f-9ffe-4450-8b05-083e641edab5",
    "type": "anime",
    "old_date": "2018-12-31T12:00:00",
    "new_date": "2018-04-21",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "78d368a1-a455-4522-8900-a5d9abb80504",
    "type": "film",
    "old_date": "2018-12-31T12:00:00",
    "new_date": "2018-03-14",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "81521ce9-9114-4838-9605-c19af4d0dda2",
    "type": "film",
    "old_date": "2018-12-31T12:00:00",
    "new_date": "2018-06-11",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "8b7f0ca3-3d2f-4fa9-ba53-65d08efd0053",
    "type": "film",
    "old_date": "2018-12-31T12:00:00",
    "new_date": "2018-09-18",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "a3785a20-99c8-4593-b3e4-d19a69bb7cca",
    "type": "film",
    "old_date": "2018-12-31T12:00:00",
    "new_date": "2018-06-17",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "b954916a-f591-4e97-bea9-3af8c1d964b9",
    "type": "film",
    "old_date": "2018-12-31T12:00:00",
    "new_date": "2018-01-26",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "ba3123a9-ee47-4f56-bcc1-73974f4e9767",
    "type": "film",
    "old_date": "2018-12-31T12:00:00",
    "new_date": "2018-03-28",
    "revision": 1,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "d30d40aa-ef13-4fb8-aca8-85b1f95c810e",
    "type": "film",
    "old_date": "2018-12-31T12:00:00",
    "new_date": "2018-06-05",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "31ea0e4e-5d42-477f-86a2-9c63b984a75a",
    "type": "film",
    "old_date": "2019-12-31T12:00:00",
    "new_date": "2019-01-08",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "366d56ea-a8b2-4258-aa10-cbfeaf3992b8",
    "type": "film",
    "old_date": "2019-12-31T12:00:00",
    "new_date": "2019-03-30",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "3c53b3ac-10bf-4c2d-aa38-cb3b457986c8",
    "type": "film",
    "old_date": "2019-12-31T12:00:00",
    "new_date": "2019-04-20",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "4f01fbee-c5d7-4614-a597-cdcd8ea47506",
    "type": "film",
    "old_date": "2019-12-31T12:00:00",
    "new_date": "2019-07-05",
    "revision": 1,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "58fb79d2-2c95-435c-a25c-14444b08a7b4",
    "type": "serie",
    "old_date": "2019-12-31T12:00:00",
    "new_date": "2019-09-11",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "5f8c5ed4-0a9c-4e3f-bac3-85feb0cc28a2",
    "type": "film",
    "old_date": "2019-12-31T12:00:00",
    "new_date": "2019-08-03",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "64c4df0c-db06-43a6-a833-b03005988a7b",
    "type": "serie",
    "old_date": "2019-12-31T12:00:00",
    "new_date": "2019-12-02",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "cdbc6448-57e9-4d95-8625-7d7d3c171730",
    "type": "film",
    "old_date": "2019-12-31T12:00:00",
    "new_date": "2019-11-25",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "e012c4f5-fba2-44c9-8c48-df82ccdc0e71",
    "type": "anime",
    "old_date": "2019-12-31T12:00:00",
    "new_date": "2019-05-15",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "f91ae1b6-c376-4aff-a2a7-10d7e15324b1",
    "type": "anime",
    "old_date": "2019-12-31T12:00:00",
    "new_date": "2019-09-12",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "fa840ecd-e216-4ac8-888d-be9843780c93",
    "type": "film",
    "old_date": "2019-12-31T12:00:00",
    "new_date": "2019-08-25",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "734cc2a0-bff8-46d1-b43c-e986c5a4fca2",
    "type": "serie",
    "old_date": "2020-12-31T12:00:00",
    "new_date": "2020-07-09",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "aba11151-acb9-4a34-bba6-c6e4642272db",
    "type": "serie",
    "old_date": "2020-12-31T12:00:00",
    "new_date": "2020-07-12",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "cc8af22f-48ec-48ef-9b22-c1f96fd8e872",
    "type": "anime",
    "old_date": "2020-12-31T12:00:00",
    "new_date": "2020-03-16",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "fe56e239-fab8-4185-9d56-8819a5db338c",
    "type": "film",
    "old_date": "2020-12-31T12:00:00",
    "new_date": "2020-03-08",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "634755ac-2626-4ea7-b446-a78babc1c448",
    "type": "anime",
    "old_date": "2021-12-31T12:00:00",
    "new_date": "2021-08-09",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "70804d82-16fd-470e-bb2b-506d837c528c",
    "type": "film",
    "old_date": "2021-12-31T12:00:00",
    "new_date": "2021-09-14",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "9b9a6c02-ccc7-4e23-a210-acda6c6c5683",
    "type": "anime",
    "old_date": "2021-12-31T12:00:00",
    "new_date": "2021-12-21",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "afb8b365-0beb-48d5-a3ce-59b757a0640d",
    "type": "anime",
    "old_date": "2021-12-31T12:00:00",
    "new_date": "2021-12-14",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "cd5a8719-5014-4d02-8bbd-9c8f7cad180e",
    "type": "anime",
    "old_date": "2021-12-31T12:00:00",
    "new_date": "2021-01-02",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "131ed6a3-95ae-49d1-b4df-6c9c4899fcd9",
    "type": "anime",
    "old_date": "2022-12-31T12:00:00",
    "new_date": "2022-01-06",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "13a5ae3e-4218-4aaa-b250-3ae20266e804",
    "type": "film",
    "old_date": "2022-12-31T12:00:00",
    "new_date": "2022-04-06",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "45e651f9-6005-4684-8523-123cefd5bd56",
    "type": "serie",
    "old_date": "2022-12-31T12:00:00",
    "new_date": "2022-05-06",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "54a39882-0da2-4178-b5db-14da5b0e20a1",
    "type": "serie",
    "old_date": "2022-12-31T12:00:00",
    "new_date": "2022-11-21",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "57be948b-b116-4b77-9835-4b80ab36a5b8",
    "type": "film",
    "old_date": "2022-12-31T12:00:00",
    "new_date": "2022-01-19",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "71d996d2-60c6-4400-b502-08ce229b2166",
    "type": "anime",
    "old_date": "2022-12-31T12:00:00",
    "new_date": "2022-01-07",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "7f397f0c-0b22-4747-9f48-56662e39c501",
    "type": "serie",
    "old_date": "2022-12-31T12:00:00",
    "new_date": "2022-12-22",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "8d6621c8-6c99-479f-956d-1fd99bc914a7",
    "type": "film",
    "old_date": "2022-12-31T12:00:00",
    "new_date": "2022-07-31",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "96cf7548-8a29-4968-a0ed-ff9e4a9a61e6",
    "type": "anime",
    "old_date": "2022-12-31T12:00:00",
    "new_date": "2022-12-28",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "9d58e845-60fd-407c-a64a-3bb02db7817d",
    "type": "film",
    "old_date": "2022-12-31T12:00:00",
    "new_date": "2022-11-08",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "c44b17a3-916a-4ee0-a545-6dda422d370b",
    "type": "anime",
    "old_date": "2022-12-31T12:00:00",
    "new_date": "2022-05-23",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "32f6cae3-4c71-4576-9674-78ab10f2f97f",
    "type": "film",
    "old_date": "2023-12-31T12:00:00",
    "new_date": "2023-06-09",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "392b645b-7d0f-44f7-81a7-555f1b171033",
    "type": "serie",
    "old_date": "2023-12-31T12:00:00",
    "new_date": "2023-07-12",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "55aa3938-5530-42ef-9aca-b19f939bb703",
    "type": "anime",
    "old_date": "2023-12-31T12:00:00",
    "new_date": "2023-10-14",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "6a4d43ee-90f3-4f5b-b892-ef047f97822d",
    "type": "film",
    "old_date": "2023-12-31T12:00:00",
    "new_date": "2023-08-02",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "6f9ec69e-10fe-4292-a009-e2691b53fb0e",
    "type": "film",
    "old_date": "2023-12-31T12:00:00",
    "new_date": "2023-05-13",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "88e11128-92cc-4acf-bbbf-f7cd766323a4",
    "type": "serie",
    "old_date": "2023-12-31T12:00:00",
    "new_date": "2023-09-27",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "8b1c68aa-3b4f-4548-8cad-3f2c4f5d20b0",
    "type": "serie",
    "old_date": "2023-12-31T12:00:00",
    "new_date": "2023-02-09",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "9d0a9383-36b8-421f-94e5-fac75eb3a273",
    "type": "film",
    "old_date": "2023-12-31T12:00:00",
    "new_date": "2023-04-08",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "eccd3204-346c-4c58-920a-ab700b67939d",
    "type": "film",
    "old_date": "2023-12-31T12:00:00",
    "new_date": "2023-11-11",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "ed0d1244-03a0-436d-a0c9-2ef206e737f7",
    "type": "anime",
    "old_date": "2023-12-31T12:00:00",
    "new_date": "2023-08-27",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "f113dc29-35b8-45d0-b501-f007f486a958",
    "type": "anime",
    "old_date": "2023-12-31T12:00:00",
    "new_date": "2023-05-16",
    "revision": 1,
    "history_version": 1,
    "viewing_date": {
      "day": 20,
      "year": 2026,
      "month": 10
    }
  },
  {
    "id": "0dc6f658-a1f4-4d55-8cbc-222bcb0388fd",
    "type": "film",
    "old_date": "2024-12-31T12:00:00",
    "new_date": "2024-02-11",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "0df3124b-d28f-4cbf-aabd-1497bbec4c8a",
    "type": "anime",
    "old_date": "2024-12-31T12:00:00",
    "new_date": "2024-12-29",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "11a9ff8c-320d-4dc2-8cc8-fa57dc46a166",
    "type": "film",
    "old_date": "2024-12-31T12:00:00",
    "new_date": "2024-05-23",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "128ec42f-d5ac-41ee-919c-25614da987e2",
    "type": "film",
    "old_date": "2024-12-31T12:00:00",
    "new_date": "2024-08-19",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "358ec21a-60ad-47a0-950a-1bdc1bc8b71f",
    "type": "film",
    "old_date": "2024-12-31T12:00:00",
    "new_date": "2024-06-29",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "4ce351aa-3d16-4459-a0cc-e431c54cc666",
    "type": "film",
    "old_date": "2024-12-31T12:00:00",
    "new_date": "2024-02-06",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "55781b3f-fc4f-4900-9fb6-3273bc86cb5d",
    "type": "serie",
    "old_date": "2024-12-31T12:00:00",
    "new_date": "2024-01-17",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "76f534c4-4423-4ee3-9dc2-775a118c0d7f",
    "type": "film",
    "old_date": "2024-12-31T12:00:00",
    "new_date": "2024-08-20",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "7886a2ef-dc9c-4cc8-bff0-fd159e6acfde",
    "type": "film",
    "old_date": "2024-12-31T12:00:00",
    "new_date": "2024-12-07",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "8c55eced-07a0-4c4e-b3f6-d5c045368c8e",
    "type": "film",
    "old_date": "2024-12-31T12:00:00",
    "new_date": "2024-03-21",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "ba68d00c-922e-40c3-b012-f599ae1dfc94",
    "type": "film",
    "old_date": "2024-12-31T12:00:00",
    "new_date": "2024-12-26",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "ba7e71dd-b542-4324-8905-14df24a2b3ac",
    "type": "film",
    "old_date": "2024-12-31T12:00:00",
    "new_date": "2024-11-02",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "bb03d5a6-2b79-4f36-acd2-15ffe3732f44",
    "type": "anime",
    "old_date": "2024-12-31T12:00:00",
    "new_date": "2024-09-24",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "d5da10e3-8bde-4090-a1b3-f423ee086249",
    "type": "serie",
    "old_date": "2024-12-31T12:00:00",
    "new_date": "2024-12-04",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  },
  {
    "id": "eecdf23d-47dc-4926-b8b1-9eb813b3ce36",
    "type": "film",
    "old_date": "2024-12-31T12:00:00",
    "new_date": "2024-01-12",
    "revision": 0,
    "history_version": 0,
    "viewing_date": null
  }
]$approved_dates$::jsonb;
 snapshots jsonb := '{}'::jsonb;
 target_before jsonb;
 relation_name text;
 fingerprint text;
 affected integer;
BEGIN
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Owner migration connection required'; END IF;
 IF jsonb_array_length(approved)<>85 OR (SELECT count(DISTINCT r->>'id') FROM jsonb_array_elements(approved) r)<>85
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(approved) r WHERE
 extract(year FROM (r->>'old_date')::timestamp)<>extract(year FROM (r->>'new_date')::date)
 OR to_char((r->>'old_date')::timestamp,'MM-DD HH24:MI:SS')<>'12-31 12:00:00'
 OR (r->>'new_date')::date>date '2024-12-30') THEN RAISE EXCEPTION 'Invalid mapping'; END IF;
 PERFORM m.id FROM watching.media_items m JOIN jsonb_array_elements(approved) r ON m.id=(r->>'id')::uuid ORDER BY m.id FOR UPDATE OF m;
 SELECT count(*) INTO affected FROM watching.media_items m JOIN jsonb_array_elements(approved) r ON m.id=(r->>'id')::uuid
 WHERE m.user_id='de7f45de-8e7d-4b85-ab7e-a03b4bf8eb64' AND m.org_id='26f017a1-c27f-4690-9032-317e3193373d' AND NOT m.is_reference
 AND m.type=r->>'type' AND m.watched_at=(r->>'old_date')::timestamp
 AND m.personal_revision=(r->>'revision')::bigint AND m.history_version=(r->>'history_version')::bigint
 AND m.viewing_date IS NOT DISTINCT FROM nullif(r->'viewing_date','null'::jsonb);
 IF affected<>85 THEN RAISE EXCEPTION 'Stale approved mapping: %/85 match; batch aborted',affected USING ERRCODE='40001'; END IF;
 SELECT jsonb_object_agg(m.id,to_jsonb(m)) INTO target_before FROM watching.media_items m JOIN jsonb_array_elements(approved) r ON m.id=(r->>'id')::uuid;
 FOREACH relation_name IN ARRAY ARRAY['watching.media_items','watching.viewing_records','watching.viewing_ranges','watching.scope_ratings','watching.rewatches','watching.achievement_unlocks','public.goals','public.goal_completion_receipts'] LOOP
   IF relation_name='watching.media_items' THEN
     SELECT md5(coalesce(string_agg(to_jsonb(m)::text,',' ORDER BY m.id),'')) INTO fingerprint FROM watching.media_items m WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(approved) r WHERE m.id=(r->>'id')::uuid);
   ELSE
     EXECUTE format('SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'','' ORDER BY to_jsonb(t)::text),'''')) FROM %s t',relation_name) INTO fingerprint;
   END IF;
   snapshots:=snapshots||jsonb_build_object(relation_name,fingerprint);
 END LOOP;
 UPDATE watching.media_items m SET watched_at=(r->>'new_date')::date+time '12:00',
 viewing_date=coalesce(m.viewing_date,jsonb_build_object('year',extract(year FROM (r->>'new_date')::date)::int,'month',extract(month FROM (r->>'new_date')::date)::int,'day',extract(day FROM (r->>'new_date')::date)::int))
 ||jsonb_build_object('legacy_date_estimate',jsonb_build_object('batch','20261021010000','date',r->>'new_date','date_confidence','INFERRED','origin','EXPLICIT_REPAIR','method','USER_REQUESTED_ESTIMATE_V1','personal_evidence','NONE','original_watched_at',r->>'old_date','original_viewing_date',m.viewing_date,'proposal_sha256','058deb656e766918436be17ac0ff6fdcbca942e224be11a2c9d2f070c239b59c'))
 FROM jsonb_array_elements(approved) r WHERE m.id=(r->>'id')::uuid;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>85 THEN RAISE EXCEPTION 'Unexpected update count %',affected; END IF;
 IF EXISTS(SELECT 1 FROM watching.media_items m JOIN jsonb_array_elements(approved) r ON m.id=(r->>'id')::uuid WHERE
 (to_jsonb(m)-ARRAY['watched_at','viewing_date','personal_revision']) IS DISTINCT FROM ((target_before->m.id::text)-ARRAY['watched_at','viewing_date','personal_revision'])
 OR m.personal_revision<>(r->>'revision')::bigint+1
 OR m.watched_at IS DISTINCT FROM ((r->>'new_date')::date+time '12:00')
 OR m.viewing_date->'legacy_date_estimate'->>'date_confidence' IS DISTINCT FROM 'INFERRED'
 OR (r->'viewing_date'<>'null'::jsonb AND (m.viewing_date-'legacy_date_estimate') IS DISTINCT FROM r->'viewing_date')) THEN RAISE EXCEPTION 'Unexpected target changes'; END IF;
 FOREACH relation_name IN ARRAY ARRAY['watching.media_items','watching.viewing_records','watching.viewing_ranges','watching.scope_ratings','watching.rewatches','watching.achievement_unlocks','public.goals','public.goal_completion_receipts'] LOOP
   IF relation_name='watching.media_items' THEN
     SELECT md5(coalesce(string_agg(to_jsonb(m)::text,',' ORDER BY m.id),'')) INTO fingerprint FROM watching.media_items m WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(approved) r WHERE m.id=(r->>'id')::uuid);
   ELSE
     EXECUTE format('SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'','' ORDER BY to_jsonb(t)::text),'''')) FROM %s t',relation_name) INTO fingerprint;
   END IF;
   IF fingerprint IS DISTINCT FROM snapshots->>relation_name THEN RAISE EXCEPTION 'Unexpected changes in %',relation_name; END IF;
 END LOOP;
 RAISE NOTICE '85 inferred date estimates applied; years and canonical history preserved';
END
$repair$;
COMMIT;
