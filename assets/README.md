# assets

Images referenced by the top-level [`README.md`](../README.md). Drop the two
image files here with **exactly** these names:

| File | Used in README as | What it is |
| --- | --- | --- |
| `rave-mandala.png` | hero image (under the intro) | The 64-gate mandala wheel (I-Ching gates + zodiac) around the bodygraph |
| `hologenetic-profile.png` | "🧬 Gene Keys (the spheres)" section | The Hologenetic Profile spheres with their planetary activations |

After saving the files here, commit them so they render on GitHub:

```bash
git add assets/rave-mandala.png assets/hologenetic-profile.png
git commit -m "docs: add README diagrams"
```

> These images are intentionally **not** included in the published npm tarball
> (the `files` whitelist in `package.json` keeps the package lean). They render
> in the README on GitHub and on npmjs.com via the repository link.
