module.exports = {
    default: {
        requireModule: ['ts-node/register'],
        require: ['features/step_definitions/*.js'],
        format: ['progress-bar', 'html:cucumber-report.html'],
        publishQuiet: true
    }
}
