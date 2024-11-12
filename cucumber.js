module.exports = {
    default: {
        requireModule: ['ts-node/register'],
        require: ['features/step_definitions/*.js'],
        format: ['progress-bar', 'html:cucumber-report.html'],
        formatOptions: {"snippetInterface": "synchronous"},
        publishQuiet: true
    },
    asteroids: {
        requireModule: ['ts-node/register'],
        require: ['features/step_definitions/math_asteroids_steps.js'],
        format: ['progress-bar', 'html:cucumber-report-asteroids.html'],
        tags: '@math-asteroids',
        publishQuiet: true
    },
    invaders: {
        requireModule: ['ts-node/register'],
        require: ['features/step_definitions/math_invaders_steps.js'],
        format: ['progress-bar', 'html:cucumber-report-invaders.html'],
        tags: '@math-invaders',
        publishQuiet: true
    }
}
