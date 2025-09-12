# Chat Popup Delta5 Client

A popup that is intended to be embedded within a website to provide answers to questions with links to the sources based on provided documents. To see it in action, visit [delta5](https://app.delta5.tech).

## Usage

To start using chat on the website, insert `<script>` with params in `<head>` at the root of the website. You can pass configuration parameters with query URL. List of available parameters and their default values available in `defaultConfiguration` variable in [configuration.ts](./src/configuration.ts). The only mandatory parameter is `token`.

Example insertion of the widget (the same script is used on [delta5](https://app.delta5.tech) website):

```html
<iframe
  src="https://app.delta5.tech?token=token&macroName=name"
  style="position:fixed; top:0; left:0; bottom:0; right:0; width:100%; height:100%; border:none; margin:0; padding:0; overflow:hidden; z-index:999999;"
>
```

## Development

```bash
npm run dev
```

## Deployment

Bundle project into single `.js` and `.css` using vite:

```bash
npm run build
```

It will result in `./dist/` folder which can be served via any webserver (we are using nginx).
