import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: "class",
    content: [
        "./index.html",
        "./src/**/*.{ts,tsx}",
    ],
    theme: {
        extend: {
            screens: {
                '3xl': '1921px',
            },
        },
    },
    plugins: [],
};

export default config;
