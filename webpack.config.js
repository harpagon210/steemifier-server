const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const config = {
  context: __dirname + '/src',
  entry: {
    'handler': './handler.js',
    'db': './db.js',
    'models/Content': './models/Content.js'
  },
  externals: [
    'sc2-sdk',
    'secure-random',
    'speakingurl',
    'bs58',
    'mongoose',
    'fs',
    'node-fetch'
  ],
  output: {
    path: __dirname + '/dist',
    filename: '[name].js',
    library: 'handler',
    libraryTarget: 'commonjs2'
  },
  resolve: {
    extensions: ['.js'],
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: [
          "babel-loader",
          "eslint-loader",
        ],
      }
    ],
  },
  plugins: [
    new CopyWebpackPlugin([
      {from: 'serverless.yml', to: 'serverless.yml'},
      {from: 'variables.env', to: 'variables.env'},
    ]),
  ]
};

if (process.env.NODE_ENV === 'production') {
  config.devtool = '#cheap-module-source-map';

  config.plugins = (config.plugins || []).concat([
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: '"production"'
      }
    }),
    new webpack.optimize.UglifyJsPlugin({
      sourceMap: true,
      compress: {
        warnings: false
      }
    }),
    new webpack.LoaderOptionsPlugin({
      minimize: true
    })
  ]);
}

module.exports = config;
