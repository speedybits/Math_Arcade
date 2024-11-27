require('@babel/register')({
  extensions: ['.js', '.jsx', '.ts', '.tsx'],
  ignore: [/node_modules/]
});

module.exports = {
  default: {
    requireModule: ['@babel/register'],
    require: ['features/step_definitions/*.js'],
    publishQuiet: true
  }
};
