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

When('I press the Start Game button', async function () {
    await page.evaluate(() => {
        window.startGame();
    });
    await page.waitForFunction(() => 
        window.gameStarted === true
    , { timeout: 5000 });
});

Then('an alien should appear within {int} seconds', async function (seconds) {
    const alienAppeared = await page.waitForFunction(() => 
        window.activeAliens && window.activeAliens.length > 0
    , { timeout: seconds * 1000 });
    assert.ok(alienAppeared, 'Alien should appear');
});

When('an alien appears', async function () {
    await page.waitForFunction(() => 
        window.activeAliens && window.activeAliens.length > 0
    , { timeout: 5000 });
});

Then('it appears in either the left, center or right position', async function () {
    const validPosition = await page.evaluate(() => {
        const alien = window.activeAliens[0];
        return ['left', 'center', 'right'].includes(alien.position);
    });
    assert.ok(validPosition, 'Alien should appear in valid position');
});

Then('it descends toward the bottom of the screen', async function () {
    const descending = await page.evaluate(() => {
        const alien = window.activeAliens[0];
        const initialY = alien.y;
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(alien.y > initialY);
            }, 500);
        });
    });
    assert.ok(descending, 'Alien should be descending');
});

When('the game starts', async function () {
    await page.evaluate(() => {
        window.startGame();
    });
    await page.waitForFunction(() => 
        window.gameStarted === true
    , { timeout: 5000 });
});

Then('I should see multiple math problems descending', async function () {
    const multipleAliens = await page.waitForFunction(() => 
        window.activeAliens && window.activeAliens.length > 1
    , { timeout: 5000 });
    assert.ok(multipleAliens, 'Multiple aliens should be present');
});

Then('they should maintain proper spacing between each other', async function () {
    const properSpacing = await page.evaluate(() => {
        const aliens = window.activeAliens;
        for (let i = 0; i < aliens.length - 1; i++) {
            const spacing = Math.abs(aliens[i].y - aliens[i + 1].y);
            if (spacing < window.MIN_ALIEN_SPACING) return false;
        }
        return true;
    });
    assert.ok(properSpacing, 'Aliens should maintain minimum spacing');
});

Then('I should be able to solve any problem that aligns with my cannon', async function () {
    const canSolve = await page.evaluate(() => {
        const alignedAlien = window.activeAliens.find(alien => 
            alien.position === window.currentCannonPosition
        );
        return alignedAlien && alignedAlien.answerChoices && alignedAlien.answerChoices.length > 0;
    });
    assert.ok(canSolve, 'Should be able to solve aligned problems');
});

When('there is an alien with the problem {string} above the cannon', async function (problem) {
    await page.evaluate((problemStr) => {
        const [factor1, factor2] = problemStr.split('×').map(n => parseInt(n.trim()));
        window.spawnAlien(factor1, factor2, window.currentCannonPosition);
    }, problem);
});

Then('I should see {int} answer circles below the alien', async function (numCircles) {
    const circles = await page.evaluate(() => {
        return window.activeAliens[0].answerChoices.length;
    });
    assert.strictEqual(circles, numCircles, `Should see ${numCircles} answer circles`);
});

Then('one of them should contain {string}', async function (answer) {
    const hasAnswer = await page.evaluate((expectedAnswer) => {
        return window.activeAliens[0].answerChoices.includes(parseInt(expectedAnswer));
    }, answer);
    assert.ok(hasAnswer, `Answer choices should include ${answer}`);
});

When('I click any answer circle', async function () {
    await page.evaluate(() => {
        const alien = window.activeAliens[0];
        const answer = alien.answerChoices[0];
        window.shootAnswer(answer, alien);
    });
});

Then('that answer should be fired at the alien', async function () {
    const fired = await page.evaluate(() => {
        return window.activeBullets && window.activeBullets.length > 0;
    });
    assert.ok(fired, 'Answer should be fired as bullet');
});

Then('the cannon should move to the middle position', async function () {
    const position = await page.waitForFunction(() => 
        window.currentCannonPosition === 'center'
    , { timeout: 1000 });
    assert.ok(position, 'Cannon should be in middle position');
});

Then('I should see {int} answer circles centered below the math problem', async function (numCircles) {
    const circlesValid = await page.evaluate((expected) => {
        const alien = window.activeAliens[0];
        return alien.answerChoices.length === expected && 
               alien.answerChoicesPositioned;
    }, numCircles);
    assert.ok(circlesValid, `Should see ${numCircles} centered answer circles`);
});

Then('the middle answer should be directly beneath the problem', async function () {
    const aligned = await page.evaluate(() => {
        const alien = window.activeAliens[0];
        const middleAnswerX = alien.answerChoices[1].x;
        return Math.abs(middleAnswerX - alien.x) < 5; // 5px tolerance
    });
    assert.ok(aligned, 'Middle answer should align with problem');
});

Then('the other answers should be evenly spaced to either side', async function () {
    const evenlySpaced = await page.evaluate(() => {
        const alien = window.activeAliens[0];
        const choices = alien.answerChoices;
        const spacing1 = Math.abs(choices[1].x - choices[0].x);
        const spacing2 = Math.abs(choices[2].x - choices[1].x);
        return Math.abs(spacing1 - spacing2) < 5; // 5px tolerance
    });
    assert.ok(evenlySpaced, 'Answer choices should be evenly spaced');
});

Then('the circles should move down the screen as the alien does', async function () {
    const moving = await page.evaluate(() => {
        const alien = window.activeAliens[0];
        const initialY = alien.answerChoices[0].y;
        return new Promise(resolve => {
            setTimeout(() => {
                const newY = alien.answerChoices[0].y;
                resolve(newY > initialY);
            }, 500);
        });
    });
    assert.ok(moving, 'Answer circles should move with alien');
});

When('there are no aliens above the cannon', async function () {
    await page.evaluate(() => {
        window.activeAliens = window.activeAliens.filter(alien => 
            alien.position !== window.currentCannonPosition
        );
    });
});

Then('there should be no answer circles visible', async function () {
    const noCircles = await page.evaluate(() => {
        const alignedAlien = window.activeAliens.find(alien => 
            alien.position === window.currentCannonPosition
        );
        return !alignedAlien || !alignedAlien.answerChoices || 
               alignedAlien.answerChoices.length === 0;
    });
    assert.ok(noCircles, 'No answer circles should be visible');
});
