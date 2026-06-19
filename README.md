# catalyx-widgets

This project was generated with [`@osdk/create-widget`](https://www.npmjs.com/package/@osdk/create-widget) and demonstrates developing custom widgets to be embedded within Foundry UIs such as Workshop. It uses the Ontology SDK package @custom-widget/sdk with React on top of Vite. Check out the [Vite](https://vitejs.dev/guide/) docs for further configuration. The Vite plugin [`@osdk/widget.vite-plugin`](https://www.npmjs.com/package/@osdk/widget.vite-plugin) automatically generates a `widgets.config.json` manifest file containing metadata about widgets inside this project during the build command.

## Developing locally

A `FOUNDRY_TOKEN` environment variable is required to authenticate with the NPM registry and to start developer mode for the custom widget set. When developing locally you may use the token provided by the [Palantir VS Code extension](https://www.palantir.com/docs/foundry/palantir-extension-for-visual-studio-code/overview), or generate a longer lived token [inside Foundry](https://www.palantir.com/docs/foundry/platform-security-third-party/user-generated-tokens/#generation).

Install project dependencies:

```sh
npm install
```

> **Note:** Custom widget npm library versions are not automatically updated in this repository due to the lockfile dependency versions in `package-lock.json`. This ensures builds are reproducible across developers and Foundry CI. To receive the latest features and bug fixes, periodically update library versions manually by running:
> ```sh
> npm install @osdk/widget.client-react@latest @osdk/widget.client@latest @osdk/widget.vite-plugin@latest
> ```

Run the following command from the project root to start a local development server:

```sh
npm run dev
```

Follow the instructions printed to the console to set up developer mode in Foundry. This will allow you to test your widgets in Workshop or other Foundry applications while developing.

## Developing with Code Workspaces

Run the following command in a VS Code workspace terminal from the project root to start a development server on the workspace:

```sh
npm run dev:remote
```

Follow the instructions printed to the console to set up developer mode in Foundry. Use the preview panel in Code Workspaces and select your widget to preview your changes.

## Deploying

> **Note:** An initial version of your widget set has already been deployed when this repository was created. You only need to follow these steps when deploying updates.

This project uses Foundry CI to automatically deploy production builds whenever git tags are pushed.

### Automatic deployment via git tags

Simply create and push a git tag to trigger a deployment:

```sh
git tag <x.y.z>
git push origin tag <x.y.z>
```