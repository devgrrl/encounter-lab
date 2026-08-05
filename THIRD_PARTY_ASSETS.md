# Third-party assets

## KayKit Character Pack: Adventurers

Encounter Lab uses one character model from the KayKit Character Pack: Adventurers:

- `Knight.glb` for Briv (its `1H_Sword` mesh is also grafted onto the Ash Warden's hand socket — see below)

Source repository: `KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0`

Pinned revision: `672074b73ba276876a19e8816ecdc5241817ab47`

License: **CC0 1.0 Universal**. The asset author permits personal and commercial use without attribution. The GLB files are vendored in `src/EncounterLab.Web/public/models/` and served by the application itself — no external CDN or internet access is required at runtime, including behind a corporate firewall.

## KayKit Character Pack: Skeletons

Encounter Lab uses one character model from the KayKit Character Pack: Skeletons:

- `SkeletonWarrior.glb` for the Ash Warden training target (its built-in helmet mesh is used as-is; it ships unarmed, so a sword mesh is borrowed at runtime from the Knight model above via the shared `handslot.r` attachment bone both packs use)

Source repository: `KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0`

Pinned revision: `15b62b9bad122f72926c10fb14d622c73819fa54`

License: **CC0 1.0 Universal**. The asset author permits personal and commercial use without attribution. The GLB file is vendored in `src/EncounterLab.Web/public/models/` and served by the application itself — no external CDN or internet access is required at runtime, including behind a corporate firewall.

## KayKit Halloween Bits

Encounter Lab uses two props from the KayKit Halloween Bits pack for the
death/resurrection sequence:

- `gravestone.gltf` / `gravestone.bin`
- `skull.gltf` / `skull.bin` / `halloweenbits_texture.png`

Source repository: `KayKit-Game-Assets/KayKit-Halloween-Bits-1.0`

Pinned revision: `6dc69bf6b2fa766a985754f35ec6a0324090e6c6`

License: **CC0 1.0 Universal**. The asset author permits personal and commercial use without attribution. The files are vendored in `src/EncounterLab.Web/public/models/halloween/` and served by the application itself — no external CDN or internet access is required at runtime, including behind a corporate firewall.

The application code remains covered by Encounter Lab's own license.
