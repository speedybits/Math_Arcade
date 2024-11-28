require('@babel/register')({
  extensions: ['.js', '.jsx', '.ts', '.tsx'],
  ignore: [/node_modules/]
});

let common = [
  '--publish-quiet',
  '--require @babel/register',
  '--require features/step_definitions/**/*.js'
].join(' ');

module.exports = {
  default: common,
  mathInvaders: [
    common,
    'features/math_invaders.feature',
  ].join(' ')
};
