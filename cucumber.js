module.exports = {
    default: {
        requireModule: ['@cucumber/cucumber'],
        require: ['features/step_definitions/*.js'],
        format: ['progress-bar', 'html:cucumber-report.html'],
        formatOptions: { snippetInterface: 'async-await' }
    }
}
