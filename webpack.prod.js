/*
 * To prevents webpack from packing node_modules.
 * Node modules are installed by npm. So, webpack doesn't need to pack them!
 */
const nodeExts = require('webpack-node-externals');
/*
const PiUglify = require('uglifyjs-webpack-plugin');
const PiOptimize = require('optimize-js-plugin');
*/

/**
 * opt:  {
 *    wsdir: string; // workspace directory
 *    out: {
 *      path: string; // output directory
 *      name: string; // file name
 *    }
 *    prod?: boolean;
 *    entry?: string;
 *    target?: 'node' | 'web' | 'electron-main' | 'electron-renderer'
 *    tsconfig?: string; // tsconfig file for ts-loader
 *    plugins?: [];
 * }
 */
function config(opt) {
    // Set default values
    console.assert(opt.wsdir && opt.out && opt.out.path && opt.out.name);
    opt.prod = !!opt.prod;
    opt.tsconfig || (opt.tsconfig = 'tsconfig.json');
    opt.target || (opt.target = 'node');
    opt.entry || (opt.entry = './src/index.ts');
    opt.plugins || (opt.plugins = []);
    let cfg = {
        entry: opt.entry,
        output: {
            filename: opt.out.name,
            sourceMapFilename: `${opt.out.name}.map`,
            path: opt.out.path
        },
        target: opt.target,
        externals: [nodeExts()],
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    loader: 'ts-loader',
                    exclude: [
                        /node_modules/,
                        /\.spec.tsx?$/
                    ],
                    options: {
                        context: opt.wsdir,
                        configFile: opt.tsconfig
                    }
                },
            ]
        },
        plugins: [
            ...opt.plugins
        ],
        resolve: {
            symlinks: false,
            extensions: [".tsx", ".ts", ".js"]
        },
        node: {
            __dirname: false,
            __filename: false
        }
    };

    if (opt.prod) {
        cfg.mode = 'production';
        cfg.plugins = [
            ...cfg.plugins,
            /*
            new PiUglify({
                sourceMap: false
            }),
            new PiOptimize({
                parallel: true,
                uglifyOptions: {
                    ie8: false,
                    ecma: 6,
                    warnings: true,
                    mangle: true, // debug false
                    output: {
                        comments: false,
                        beautify: false,  // debug true
                    }
                },
                warnings: true,
            })
            */
        ];
    } else {
        cfg.mode = 'development';
        cfg.devtool = 'inline-source-map';
    }
    return cfg;
};

const wsdir = __dirname;

module.exports = () => config({
    wsdir: wsdir,
    prod: true,
    entry: './src/index.ts',
    target: 'node',
    out: {
        path: wsdir + '/build',
        name: 'index.js'
    },
    tsconfig: 'tsconfig.prod.json'
});

