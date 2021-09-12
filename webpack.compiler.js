const webpack = require('webpack');
const path = require('path');
const utils = require('./lib/utils');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = (
	{
		entry,
		externals,
		commonConfig,
		babelSettings,
		staticDirectory,
		webappName,
		srcPrefix,
		deployPrefix,
		tplKey
	}
) => {
	return new Promise((resolve, reject) => {
		const staticJSSrcDirectory = path.join(staticDirectory, srcPrefix, 'js');
		const staticFilesSourceDir = path.join(staticDirectory, srcPrefix);
		const config = {
			context: staticJSSrcDirectory,
			entry: entry,
			plugins: [new NodePolyfillPlugin()],
			output: {
				chunkLoadingGlobal: utils.uniqueVal(),
				path: path.join(
					staticDirectory,
					deployPrefix,
					'js'
				),
				filename: '[name].js',
				assetModuleFilename: webappName + '.assetmodule.[name][ext]',
				chunkFilename: webappName + '.[name].chunk.bundle.js',
				publicPath: 'auto'
			},
			optimization: {
				chunkIds: 'named',
				moduleIds: 'named'
			},
			target: ['web', 'es5']
		};

		config.externals = externals;
		config.module = { rules: utils.getRules() };

		utils.extendConfig(config, commonConfig);

		const jsRules = {
			test: /\.(js|jsx)$/,
			use: [{ loader: 'babel-loader', options: babelSettings }],
			exclude: [
				path.join(__dirname, 'node_modules'),
			],//针对模板工程需要引用工程下前端公用私有npm包
			include: [
				path.join(staticDirectory, '../node_modules/@ares'),
				staticFilesSourceDir,
				/clientLib/
			]
		};

		const tsRules = {
			test: /\.tsx?$/,
			use: [
				// tsc编译后，再用babel处理
				{ loader: 'babel-loader', options: babelSettings },
				{
					loader: 'ts-loader',
					options: {
						transpileOnly: true, // discard semantic checker & faster builds
						configFile: path.resolve(
							staticDirectory,
							'../tsconfig.json'
						) // 各个项目独立配置   用于 ts server 代码检查
					}
				}
			],
			exclude: /node_modules/
		};

		config.module.rules.push(jsRules);
		config.module.rules.push(tsRules);

		let rebuildCompile = false;
		const compiler = webpack(config);

		compiler.watch(
			{
				poll: 200
			},
			(err, stats) => {
				if (err) {
					reject(err);
				} else {
					const hasWarnings = stats.hasWarnings();
					const hasErrors = stats.hasErrors();

					if (!(hasWarnings || hasErrors)) {
						if (rebuildCompile) {
							console.log(
								`=== ${webappName} rebuild complete start! `,
								stats.endTime - stats.startTime + 'ms! stats info: ==='
							);
							console.log(stats.toString());
							console.log(`=== ${webappName} rebuild complete end! ===`);
							utils.triggerRefresh();
						} else {
							console.log(`=== ${webappName} build success start! stats info: ===`);
							console.log(stats.toString());
							console.log(`=== ${webappName} build success end! ===`);
						}
					} else {
						if (hasWarnings) {
							console.log(`=== ${webappName} WARNINGS start! stats info: ===`);
							console.log(stats.toString());
							console.log(`=== ${webappName} WARNINGS end! ===`);
						}

						if (hasErrors) {
							console.log('=== ERRORS start ===');
							console.log(stats.toString());
							console.log('=== ERRORS end ===');
						}
					}

					if (!rebuildCompile) {
						rebuildCompile = true;
						console.log(
							`**************** ${webappName} total compile time: ${Date.now() - global.startCompile[tplKey]
							}ms **************** `
						);
					}

					resolve();
				}
			}
		);
	});
};
