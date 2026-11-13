# Source-reviewed article classification corrections

The 2026-11-13 review of `all-article-ids-checked.csv` (snapshot `7fe6de9`)
identified 110 article-type corrections, 32 original-branch/group corrections,
and four identifier corrections. The other 214 reviewed rows retain their
classification. The 360 source observations and expected results are retained
in `test/fixtures/reviewed-article-classifications.json`.

Rules shared by official-index merging and mobile-v3 generation:

- German numbered `-T` translations and `archiviert` pages belong to the archive.
  The publisher's archive index also covers old translations missing that tag.
- Translations of Russian `SCP-…-RU-V` articles retain their archived status.
- Spanish `suplemento` and Russian `структура:дополнение` identify supplements.
  `тип:формат_фонда` stories remain Tales; `тип:001` proposals remain SCPs.
- Joke and Explained families and original branches are determined independently.
  RU Explained tags do not override an explicit supplement classification.
- IS, FI and TL are original-language branches; IE is Interlingue. The I-57
  regional rewrite retains its ES origin. AE in `SCP-50-AE-J` is not a branch.
- Raw article tags are classified before public-tag localization hides branch
  and structural tags. Retained canonical tag IDs resolve through the dictionary.
- Confirmed JP contest and IT translation URL aliases use their published numbers.
  The fractional `7.3` Joke identifier retains its decimal in the string ID;
  `numericItemId` remains an integer for the existing reader schema.

Only identical source URLs or the two explicitly audited canonical aliases can
merge after an ID correction. Different works that collide fail validation.
An unchanged source crawl timestamp does not suppress classification updates:
mobile-v3 advances its delivery timestamp when classifications change and
keeps that version stable on repeated builds. Mobile-v1/v2 remain unchanged.

No one-off edits to published JSON are required. Normal crawler publication
and the STG rebuild both run the common classification code. Rebuild/refetch
workflows and publication are separate from this source change.

Validation:

```sh
node --test
```

The regular GitHub Actions publisher runs the 360-case regression before
merging indexes. It checks both freshly indexed identities and retained rows,
including normalized/hashed tags, repeat builds, duplicate aliases and
delivery-version changes.
