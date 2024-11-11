const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const { chromium } = require('playwright');
const assert = require('assert');

let browser;
let page;
let gameStartTime;

Before(async function () {
    browser = await chromium.launch();
    page = await browser.newPage();
    await page.goto('http://localhost:8080/math_invaders.html');
});

After(async function () {
    await browser.close();
});

Given('I am playing Math Invaders', async function () {
    await page.click('#startButton');
    gameStartTime = Date.now();
});

Given('I have played for less than {int} seconds', async function (seconds) {
    // Wait until game is in the correct time window
    while ((Date.now() - gameStartTime) < seconds * 1000) {
        await page.waitForTimeout(100);
    }
});

Given('I have played between {int} and {int} seconds', async function (min, max) {
    // Wait until game reaches minimum time
    while ((Date.now() - gameStartTime) < min * 1000) {
        await page.waitForTimeout(100);
    }
});

Given('I have played for more than {int} seconds', async function (seconds) {
    // Wait until game reaches required time
    while ((Date.now() - gameStartTime) < seconds * 1000) {
        await page.waitForTimeout(100);
    }
});

When('I generate a multiplication problem', async function () {
    // The game automatically generates problems
    await page.waitForTimeout(1000); // Wait for problem to appear
});

Then('I should see a problem with two numbers', async function () {
    const aliens = await page.evaluate(() => {
        return window.activeAliens.length > 0;
    });
    assert.strictEqual(aliens, true);
});

Then('the numbers should be between {int} and {int}', async function (min, max) {
    const validNumbers = await page.evaluate((min, max) => {
        return window.activeAliens.every(alien => 
            alien.factor1 >= min && alien.factor1 <= max &&
            alien.factor2 >= min && alien.factor2 <= max
        );
    }, min, max);
    assert.strictEqual(validNumbers, true);
});

Given('I have previously missed the problem {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate((f1, f2) => {
        window.missedFacts.push({ factor1: f1, factor2: f2, exposureCount: 3 });
        localStorage.setItem('mathInvaders_missedFacts', JSON.stringify(window.missedFacts));
    }, factor1, factor2);
});

When('this problem appears again', async function () {
    // Wait for the problem to appear
    await page.waitForFunction(() => {
        return window.activeAliens.some(alien => 
            alien.factor1 === parseInt(this.lastProblem.split('×')[0].trim()) &&
            alien.factor2 === parseInt(this.lastProblem.split('×')[1].trim())
        );
    });
});

Then('it should be displayed as an orange alien', async function () {
    const isOrange = await page.evaluate(() => {
        const alien = window.activeAliens[0];
        return alien.isMissed === true;
    });
    assert.strictEqual(isOrange, true);
});

When('I press the down arrow', async function () {
    await page.keyboard.press('ArrowDown');
});

Then('the aliens should descend {int} times faster', async function (multiplier) {
    const speedMultiplier = await page.evaluate(() => {
        return window.isFastDescent ? window.FAST_DESCENT_MULTIPLIER : 1;
    });
    assert.strictEqual(speedMultiplier, multiplier);
});
