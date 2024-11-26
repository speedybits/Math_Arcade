const assert = require('assert');
const { Given, When, Then } = require('@cucumber/cucumber');

When('I click the left third of the screen', async function () {
    await page.evaluate(() => {
        window.moveCannon('left');
    });
    
    await page.waitForFunction(() => 
        window.currentCannonPosition === 'left'
    , { timeout: 1000 });
});

When('I click the middle third of the screen', async function () {
    await page.evaluate(() => {
        window.moveCannon('center');
    });
    
    await page.waitForFunction(() => 
        window.currentCannonPosition === 'center'
    , { timeout: 1000 });
});

When('I click the right third of the screen', async function () {
    await page.evaluate(() => {
        window.moveCannon('right');
    });
    
    await page.waitForFunction(() => 
        window.currentCannonPosition === 'right'
    , { timeout: 1000 });
});

Then('the cannon should move to the left position', async function () {
    const position = await page.waitForFunction(() => 
        window.currentCannonPosition === 'left'
    , { timeout: 1000 });
    assert.ok(position, 'Cannon should be in left position');
});

Then('the cannon should stay in its current position', async function () {
    const initialPosition = await page.evaluate(() => window.currentCannonPosition);
    await page.waitForTimeout(100); // Brief wait to check for unwanted movement
    const finalPosition = await page.evaluate(() => window.currentCannonPosition);
    assert.strictEqual(initialPosition, finalPosition, 'Cannon should maintain position');
});

Then('the cannon should move to the right position', async function () {
    const position = await page.waitForFunction(() => 
        window.currentCannonPosition === 'right'
    , { timeout: 1000 });
    assert.ok(position, 'Cannon should be in right position');
});

When('I start a new game', async function() {
    await page.evaluate(() => {
        window.startGame();
    });
    
    try {
        await page.waitForFunction(() => 
            window.gameStarted === true
        , { timeout: 5000 });
    } catch (error) {
        throw new Error('Game failed to initialize within 5 seconds');
    }
});

Given('I am at Level {int}', async function(level) {
    await page.evaluate((targetLevel) => {
        window.setLevel(targetLevel);
    }, level);
    
    await page.waitForFunction(
        (expectedLevel) => window.difficultyLevel === expectedLevel,
        { timeout: 2000 },
        level
    );
});

Then('I should only see multiplication problems with {string}', async function(multiplier) {
    const problemsValid = await page.evaluate((expectedMultiplier) => {
        return window.activeAliens.every(alien => 
            alien.factor1.toString() === expectedMultiplier || 
            alien.factor2.toString() === expectedMultiplier
        );
    }, multiplier);
    assert.ok(problemsValid, `All problems should include ${multiplier}`);
});

Then('the aliens should descend at the base speed', async function() {
    const speedCorrect = await page.evaluate(() => 
        Math.abs(window.descentSpeed - window.INITIAL_DESCENT_SPEED) < 0.1
    );
    assert.ok(speedCorrect, 'Aliens should move at base speed');
});

When('I correctly solve problems for {int} seconds', async function(seconds) {
    await page.evaluate(async (time) => {
        const startTime = Date.now();
        while (Date.now() - startTime < time * 1000) {
            const alien = window.activeAliens[0];
            if (!alien) {
                throw new Error('No active aliens found to shoot at');
            }
            window.shootAnswer(alien.factor1 * alien.factor2, alien);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }, seconds);
});

When('I don\'t miss any problems', async function() {
    await page.evaluate(() => {
        window.clearMissedFacts();
    });
});

Then('I should advance to Level {int}', async function(level) {
    await page.waitForFunction(
        (expectedLevel) => window.difficultyLevel === expectedLevel,
        { timeout: 5000 },
        level
    );
});
