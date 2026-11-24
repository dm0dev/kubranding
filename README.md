# KuBranding

Icon + text logo compositor and Kubernetes console branding generator. Built with Svelte 5, TypeScript, and Tailwind CSS 4 (Vite).
The rendering engine is framework-free, so the **same code** runs client-side in the browser studio and headless in Node.js (CI/CD & containers).

**Live web app:** https://dm0dev.github.io/kubranding/

## Features

- **Live Logo Studio** — Combine any SVG/PNG/JPEG/WebP icon with multi-line typography, custom colours, spacing, and live layout guides. Everything renders client-side in the browser.
- **Custom Typography** — Ships with bundled Inter and JetBrains Mono, live [Fontsource](https://fontsource.org/) search, and local font file loading (`.woff`, `.woff2`, `.ttf`, `.otf`).
- **Kubernetes Branding Targets** — Ready-to-apply outputs alongside raw PNG & Base64 Data URI exports:
  - **OpenShift Web Console** — `ConfigMap` (`openshift-config`) + `operator.openshift.io/v1` `Console` YAML for both Classic (`customLogoFile`) and OpenShift 4.19+ themed light/dark `logos` modes.
  - **Rancher** — Base64 Data URI export for Rancher UI branding settings.
  - **Kubermatic KKP** — `KubermaticConfiguration` (`kubermatic.k8c.io/v1`) YAML + `kubectl create configmap` command for light & dark themes.
  - **CI/CD Export** — Copy-paste Node CLI, Podman (`ghcr.io/dm0dev/kubranding:latest`), and `logo.json` configs mirroring the active studio state.

## Architecture

```
src/
├── core/      Platform-agnostic engine (NO DOM / Svelte / Node imports)
│   ├── types.ts        LogoConfig, LogoLayout, CanvasLike / DrawContext ports
│   ├── config.ts       defaults, limits, normalizeConfig() (validation + clamping)
│   ├── layout.ts       computeLayout(): pure geometry from a text-measure function
│   ├── render.ts       renderLogo(canvas, icon, config), drawGuides()
│   ├── encode.ts       base64 / data-URI / file-name helpers
│   ├── manifests.ts    OpenShift, Kubermatic, and CI/CD command generators
│   └── defaultIcon.ts  built-in sample SVG reference
├── browser/   Browser adapters (Image, FontFace, clipboard, download)
├── node/      Node adapter on @napi-rs/canvas: generateLogo(), font registration
├── cli/       generate.ts – CLI used in pipelines (+ generate.test.ts)
└── lib/       Svelte UI (components + runes state in lib/state/studio.svelte.ts)
```

`src/core` is type-checked by `tsconfig.node.json` **without the DOM lib**, so browser-only APIs can't leak in.
Each platform only provides a canvas and a decoded image; everything else (measuring, layout, drawing) is shared.

## Web app

```bash
npm install
npm run dev      # development
npm run build    # production build → dist/
npm run check    # svelte-check + tsc (app, core, node, cli)
npm test         # core unit tests + CLI integration tests (node:test)
```

## Headless / CI

### Container Image (GHCR)

Prebuilt OCI images are published to GitHub Container Registry (see [Containerfile](Containerfile) and [WORKFLOWS.md](WORKFLOWS.md)):

```bash
podman pull ghcr.io/dm0dev/kubranding:latest
podman run --rm -v "$PWD/out:/out" ghcr.io/dm0dev/kubranding:latest \
  --text "Acme\nCloud" --color EE0000 --out /out/logo.png
```

Or build the image locally from [Containerfile](Containerfile) (includes standard OCI `org.opencontainers.image.*` labels):

```bash
podman build -f Containerfile -t kubranding .
podman run --rm -v "$PWD/out:/out" kubranding --text "Acme\nCloud" --out /out/logo.png
```

### Node.js CLI

Requires **Node ≥ 22.18** (runs the `.ts` sources directly via native type stripping – no build step).

```bash
npm ci --omit=dev
node src/cli/generate.ts \
  --text "Your Fancy\nKubernetes" \
  --icon ./assets/icon.svg \
  --color EE0000 --font-size 32 --gap 18 \
  --out dist/logo.png --base64-out dist/logo.b64
```

Run `node src/cli/generate.ts --help` for all options. Settings can also come from a JSON file
(`--config logo.json`, any `LogoConfig` fields; flags override it), Fontsource fonts via `--fontsource <id>`,
and local font files via `--font-file`. Inter and JetBrains Mono are bundled (same files as the web app).

Programmatic use:

```ts
import { generateLogo } from './src/node/index.ts'

const { png, dataUri, layout } = await generateLogo({
  config: { text: 'Acme\nCloud', textColor: '#EE0000' },
  icon: { kind: 'file', path: './icon.svg' }, // or { kind: 'default' | 'none' | 'buffer' }
})
```

Example GitLab CI job:

```yaml
logo:
  image: node:24-slim
  script:
    - npm ci --omit=dev
    - node src/cli/generate.ts --config branding/logo.json --icon branding/icon.svg --out dist/logo.png
  artifacts:
    paths: [dist/logo.png]
```

## License & Attribution

Licensed under the [MIT License](LICENSE).

The default sample icon ([`public/preset_logo.svg`](public/preset_logo.svg)) is the [Kubernetes](https://kubernetes.io/) logo (Apache-2.0; Kubernetes® is a registered trademark of The Linux Foundation / CNCF).
