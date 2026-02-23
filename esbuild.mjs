import * as esbuild from 'esbuild';

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const extensionConfig = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: !isProduction,
    minify: isProduction,
    metafile: true,
};

async function main() {
    if (isWatch) {
        const ctx = await esbuild.context(extensionConfig);
        await ctx.watch();
        console.log('[esbuild] Watching for changes...');
    } else {
        const result = await esbuild.build(extensionConfig);
        if (isProduction) {
            const text = await esbuild.analyzeMetafile(result.metafile);
            console.log(text);
        }
        console.log('[esbuild] Build complete.');
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
